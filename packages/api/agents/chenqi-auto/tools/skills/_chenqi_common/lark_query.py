# -*- coding: utf-8 -*-
"""
辰启系列 - 飞书 Bitable 查询适配层
====================================

历史背景（教训 #20，2026-05-13）：
  J2 适配 batch 命令砍切后不久，又发现 lark-cli `+record-list` 自身被瘦身：
  砍掉 `--field-id / --filter / --page-token` 三个 flag，只剩
  `--as / --base-token / --table-id / --view-id / --limit / --offset / --dry-run`。

  替代品 `+data-query` 走 LiteQuery JSON DSL，但属于聚合查询接口
  (dimensions/measures，OLAP 概念)，不是 record-list 的对等替代，
  协议无文档、瞎试代价高。

  本封装策略：纯客户端实现。底层只调 `+record-list` 裸拉全表（带 --offset
  分页），select/filter/sort 都在 Python 侧完成。所有 caller 通过本封装查表，
  未来 lark-cli 再变只改这一处。

主要 API
--------
- query_records(cli, base_token, table_id, *,
                select=None, filter=None, sort=None,
                limit=None, page_size=500, view_id=None,
                exclude_record_ids=None, timeout=60, verbose=False)
    通用查询，返回 list[dict]，每个 dict = {"record_id": str, "fields": {字段名: 值}}

- find_first(cli, base_token, table_id, *,
             select=None, filter=None, sort=None, page_size=500,
             view_id=None, exclude_record_ids=None, timeout=60, verbose=False)
    返回符合 filter 的第一条 record；找不到返回 None。

filter 语法
-----------
filter 是一个 callable: (fields_dict) -> bool
  例：
    lambda f: _norm_select(f.get("采集状态")) == "C_TODO"
    lambda f: _norm_select(f.get("翻译状态")) in {"T_TODO", "T_FAILED"}

  这种"客户端 lambda"比 DSL 字符串更灵活、可读性更好，且本就在 Python
  里跑，没有反序列化开销。

  如果想要"DSL 风格"声明式 filter，可以另外做一个简单的 dict-spec
  → callable 编译器，但目前所有 caller 都自己写 lambda 即可。

sort 语法
---------
sort 是 list[(field_name, "asc"|"desc")]，按列表顺序优先级递减。
  例：
    [("失败次数", "asc"), ("更新时间", "desc")]

字段值归一化辅助
----------------
- normalize_text(v) -> str：抽 plain text（兼容 list[{text:...}] 富文本结构）
- normalize_select(v) -> str：抽单选 value/text
- normalize_link(v) -> str：抽链接 link 字段
- normalize_int(v, default=0) -> int

返回结构
--------
[
  {
    "record_id": "recXXX",
    "fields": {"字段名": 原始值, ...}  # 仅含 select 的字段（select=None 全字段）
  },
  ...
]
"""

from __future__ import annotations

import json
import os
import subprocess
from typing import Any, Callable, Iterable, Optional


class LarkQueryError(RuntimeError):
    pass


# ============ 内部工具 ============

def _run_list(
    cli: str,
    base_token: str,
    table_id: str,
    *,
    limit: int,
    offset: int,
    view_id: str | None = None,
    timeout: int = 60,
) -> dict:
    """单次裸拉 record-list，返回 raw data 字典（含 fields/data/record_id_list/has_more）"""
    cmd = [
        cli, "base", "+record-list",
        "--as", "bot",
        "--base-token", base_token,
        "--table-id", table_id,
        "--limit", str(limit),
        "--offset", str(offset),
    ]
    if view_id:
        cmd.extend(["--view-id", view_id])

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True,
            env=env, encoding="utf-8", errors="replace",
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise LarkQueryError(f"+record-list 超时 (timeout={timeout}s, table={table_id})")

    if proc.returncode != 0:
        merged = ((proc.stderr or "") + (proc.stdout or "")).lower()
        hint = ""
        if "91403" in merged or "permission" in merged or "403" in merged:
            hint = " [ROOT_CAUSE] bot 对 base 无权限，到飞书 web 把 lark-cli 应用加为协作者。不要改 CLI/timeout/封装方式。"
        elif "91402" in merged or "table not found" in merged:
            hint = " [ROOT_CAUSE] table_id 在该 base 不存在，base_info.json 跟 base 不匹配。"
        raise LarkQueryError(
            f"+record-list exit={proc.returncode}:{hint} {proc.stderr[:400] or proc.stdout[:400]}"
        )

    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise LarkQueryError(f"+record-list 返回非 JSON: {e} | head={proc.stdout[:200]}")

    if not out.get("ok"):
        err = out.get("error", {})
        raise LarkQueryError(f"+record-list ok=false: {err}")

    data = out.get("data", {})
    return data


def _row_to_fields(row: list, fields_order: list[str]) -> dict[str, Any]:
    """row 是字段值数组（与 fields_order 同序），转成字段名 → 值 字典"""
    return {name: (row[i] if i < len(row) else None) for i, name in enumerate(fields_order)}


# ============ 字段值归一化 ============

def normalize_text(v: Any) -> str:
    """从富文本/纯文本/None 抽 plain text"""
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        # [{type:"text", text:"..."}] 或 [{text:"...", link:"..."}]
        parts = []
        for item in v:
            if isinstance(item, dict):
                t = item.get("text") or item.get("name") or ""
                if t:
                    parts.append(str(t))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    if isinstance(v, dict):
        return v.get("text") or v.get("name") or v.get("value") or ""
    return str(v)


def normalize_select(v: Any) -> str:
    """单选/多选 → 字符串（多选取第一个）"""
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, list) and v:
        item = v[0]
        if isinstance(item, dict):
            return item.get("text") or item.get("value") or ""
        return str(item)
    if isinstance(v, dict):
        return v.get("value") or v.get("text") or ""
    return str(v)


def normalize_link(v: Any) -> str:
    """链接字段 → URL 字符串"""
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, dict):
        return v.get("link") or v.get("url") or v.get("text") or ""
    if isinstance(v, list) and v:
        item = v[0]
        if isinstance(item, dict):
            return item.get("link") or item.get("url") or item.get("text") or ""
    return str(v)


def normalize_int(v: Any, default: int = 0) -> int:
    if v in (None, "", []):
        return default
    if isinstance(v, (int, float)):
        return int(v)
    try:
        return int(str(v).strip())
    except (ValueError, TypeError):
        return default


# ============ 公共 API ============

def query_records(
    cli: str,
    base_token: str,
    table_id: str,
    *,
    select: Optional[Iterable[str]] = None,
    filter: Optional[Callable[[dict], bool]] = None,  # noqa: A002
    sort: Optional[list[tuple[str, str]]] = None,
    limit: Optional[int] = None,
    page_size: int = 500,
    view_id: Optional[str] = None,
    exclude_record_ids: Optional[Iterable[str]] = None,
    timeout: int = 60,
    verbose: bool = False,
) -> list[dict]:
    """
    通用查表 - 裸拉所有页 + 客户端 filter/sort/limit。

    参数：
      cli            : lark-cli 可执行路径
      base_token     : 飞书 base_token
      table_id       : 表 id
      select         : 要保留的字段名列表；None 表示全字段
      filter         : (fields_dict) -> bool；None 表示不过滤
      sort           : [("字段名", "asc"|"desc"), ...]；None 表示不排序
      limit          : 客户端最终输出的最大条数；None 表示不截断
      page_size      : 单页 lark-cli --limit 大小（默认 500，飞书上限通常 500）
      view_id        : 飞书视图 id（可选）
      exclude_record_ids : 跳过这些 record_id（典型用法：跳过 __SCHEMA__ 行）
      timeout        : 单次 lark-cli 调用超时秒数
      verbose        : True 时打印进度

    返回：
      list[dict]，每个 dict = {"record_id": str, "fields": {字段名: 原始值, ...}}
    """
    select_set = set(select) if select else None
    exclude_set = set(exclude_record_ids) if exclude_record_ids else set()

    out: list[dict] = []
    offset = 0
    page = 0

    while True:
        page += 1
        if verbose:
            print(f"  $ query_records page={page} offset={offset} limit={page_size}")

        data = _run_list(
            cli, base_token, table_id,
            limit=page_size, offset=offset,
            view_id=view_id, timeout=timeout,
        )

        all_fields = data.get("fields") or []
        rows = data.get("data") or []
        rids = data.get("record_id_list") or []

        for i, row in enumerate(rows):
            rid = rids[i] if i < len(rids) else None
            if not rid or rid in exclude_set:
                continue
            fields_dict = _row_to_fields(row, all_fields)
            if filter is not None and not filter(fields_dict):
                continue
            if select_set is not None:
                fields_dict = {k: v for k, v in fields_dict.items() if k in select_set}
            out.append({"record_id": rid, "fields": fields_dict})
            # 客户端 limit 早停（仅在不需要 sort 时安全）
            if limit is not None and sort is None and len(out) >= limit:
                if verbose:
                    print(f"  $ query_records hit limit={limit}, early stop")
                _maybe_sort_and_truncate(out, sort, limit)
                return out

        if not data.get("has_more"):
            break
        if not rows:
            break
        offset += len(rows)

    _maybe_sort_and_truncate(out, sort, limit)
    if verbose:
        print(f"  $ query_records final count={len(out)}")
    return out


def _maybe_sort_and_truncate(
    items: list[dict],
    sort: Optional[list[tuple[str, str]]],
    limit: Optional[int],
) -> None:
    """原地 sort + truncate"""
    if sort:
        # 多键排序：按 sort 列表逆序应用 stable sort
        for field_name, order in reversed(sort):
            reverse = (order or "asc").lower() == "desc"

            def keyfunc(item: dict, _f=field_name):
                v = item["fields"].get(_f)
                # 数字优先按数字、字符串按字符串
                if isinstance(v, (int, float)):
                    return (0, v)
                if isinstance(v, str):
                    return (1, v)
                return (2, normalize_text(v))

            items.sort(key=keyfunc, reverse=reverse)
    if limit is not None and len(items) > limit:
        del items[limit:]


def find_first(
    cli: str,
    base_token: str,
    table_id: str,
    *,
    select: Optional[Iterable[str]] = None,
    filter: Optional[Callable[[dict], bool]] = None,  # noqa: A002
    sort: Optional[list[tuple[str, str]]] = None,
    page_size: int = 500,
    view_id: Optional[str] = None,
    exclude_record_ids: Optional[Iterable[str]] = None,
    timeout: int = 60,
    verbose: bool = False,
) -> Optional[dict]:
    """查到符合 filter 的第一条；找不到返回 None"""
    items = query_records(
        cli, base_token, table_id,
        select=select, filter=filter, sort=sort, limit=1,
        page_size=page_size, view_id=view_id,
        exclude_record_ids=exclude_record_ids, timeout=timeout, verbose=verbose,
    )
    return items[0] if items else None


# ============ 便捷常量 ============
SCHEMA_RECORD_IDS_DEFAULT = {"__SCHEMA__"}  # 占位；实际 caller 应传具体 record_id
