# -*- coding: utf-8 -*-
"""
_chenqi_common.lark_batch
==========================

封装"批量更新/批量创建"的兼容层。

历史背景（教训 #19，2026-05-13 下午）：
  lark-cli 在某次升级中移除了 `+record-batch-update` 和 `+record-batch-create`
  命令，只保留单条的 `+record-upsert`。原本各技能里大量调用 batch 接口的
  代码（采集 / 选品 / 翻译 / 建表 共 16 处）全部被破坏。

本模块通过循环单条 upsert 模拟原 batch 行为，兼容旧 API：
  - batch_update_records(): payload {"record_id_list": [...], "patch": {...}}
  - batch_create_records(): payload {"fields": [...名字], "rows": [[...值]]}

性能取舍：
  - 单条 upsert 比 batch 慢（每条 1 次 lark-cli 进程启动 + 1 次 HTTP）
  - 已加 `time.sleep(0.05)` 间隔，避免飞书 QPS 限流
  - 原 batch 单次 50 条现在变 50 次单条调用，约慢 30~50 倍
  - 对采集场景（一次写 1-10 条）影响可接受；对选品 50 条入库会从 1s → 30s

使用方式：
  from _chenqi_common.lark_batch import batch_update_records, batch_create_records

  batch_update_records(
      lark_cli_path, base_token, table_id,
      record_id_list=["recAAA", "recBBB"],
      patch={"采集状态": "C_DONE"},
  )

  result = batch_create_records(
      lark_cli_path, base_token, table_id,
      fields=["1688商品ID", "中文商品名"],
      rows=[["123", "充电宝"], ["456", "数据线"]],
  )
  # result = {"record_id_list": ["recXXX", "recYYY"]}

API 错误处理：
  - 任何一条失败立即抛 LarkBatchError，不做"部分成功"半推半就
  - 错误信息包含失败时已成功的条数 + 失败的 record_id / row_index，方便重试
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from typing import Any, Sequence


__all__ = [
    "LarkBatchError",
    "batch_update_records",
    "batch_create_records",
]


# 飞书 QPS 限流缓冲：每条单 upsert 之间 sleep（秒）
# 飞书官方限制 100 QPS，sleep 0.05s = 20 QPS 远低于上限
_PER_CALL_SLEEP = 0.05


class LarkBatchError(RuntimeError):
    def __init__(self, message: str, *, succeeded: int = 0, failed_ref: Any = None):
        super().__init__(message)
        self.succeeded = succeeded
        self.failed_ref = failed_ref


def _build_cmd(
    lark_cli_path: str,
    sub: str,
    *,
    base_token: str,
    table_id: str,
    record_id: str | None,
    json_payload: dict,
    as_bot: bool = True,
) -> list[str]:
    cmd = [lark_cli_path, "base", sub]
    cmd += ["--as", "bot" if as_bot else "user"]
    cmd += ["--base-token", base_token, "--table-id", table_id]
    if record_id:
        cmd += ["--record-id", record_id]
    cmd += ["--json", json.dumps(json_payload, ensure_ascii=False)]
    return cmd


def _run_single(cmd: list[str], *, timeout: int = 30) -> dict:
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
    )
    if r.returncode != 0:
        raise LarkBatchError(
            f"lark-cli upsert failed: exit={r.returncode}\n"
            f"  stderr: {(r.stderr or '')[:600]}\n"
            f"  stdout: {(r.stdout or '')[:200]}"
        )
    out = (r.stdout or "").strip()
    if not out:
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        # lark-cli 偶尔返回非 JSON（成功消息），不抛异常返回空 dict
        return {"_raw": out}


def batch_update_records(
    lark_cli_path: str,
    base_token: str,
    table_id: str,
    *,
    record_id_list: Sequence[str],
    patch: dict[str, Any],
    as_bot: bool = True,
    timeout: int = 30,
    verbose: bool = False,
) -> dict:
    """
    批量更新（兼容旧 +record-batch-update 的 payload 形态）。

    实际行为：循环对每个 record_id 调 +record-upsert（带 --record-id）。

    Returns:
      {"updated_count": N, "record_id_list": [...]}（兼容旧返回）
    """
    if not record_id_list:
        return {"updated_count": 0, "record_id_list": []}
    if not isinstance(patch, dict) or not patch:
        raise LarkBatchError("batch_update_records: patch 不能为空 dict")

    succeeded: list[str] = []
    for idx, rid in enumerate(record_id_list):
        cmd = _build_cmd(
            lark_cli_path, "+record-upsert",
            base_token=base_token, table_id=table_id,
            record_id=rid,
            json_payload=patch,  # upsert 的 --json 是 record 字段对象本身
            as_bot=as_bot,
        )
        try:
            _run_single(cmd, timeout=timeout)
        except LarkBatchError as e:
            raise LarkBatchError(
                f"batch_update_records 在第 {idx + 1}/{len(record_id_list)} 条失败 "
                f"(record_id={rid}): {e}",
                succeeded=len(succeeded),
                failed_ref=rid,
            ) from e
        succeeded.append(rid)
        if verbose:
            print(f"    [upsert] {idx + 1}/{len(record_id_list)} {rid}", file=sys.stderr)
        if idx < len(record_id_list) - 1:
            time.sleep(_PER_CALL_SLEEP)

    return {"updated_count": len(succeeded), "record_id_list": succeeded}


def batch_create_records(
    lark_cli_path: str,
    base_token: str,
    table_id: str,
    *,
    fields: Sequence[str],
    rows: Sequence[Sequence[Any]],
    as_bot: bool = True,
    timeout: int = 30,
    verbose: bool = False,
) -> dict:
    """
    批量创建（兼容旧 +record-batch-create 的 payload 形态）。

    输入：
      fields: 列名顺序，如 ["1688商品ID", "中文商品名"]
      rows:   二维数组，每行 len 必须等于 len(fields)

    实际行为：每行 zip(fields, row) 成 dict，循环调 +record-upsert（不带 --record-id 即 create）。

    Returns:
      {"created_count": N, "record_id_list": [...]}（兼容旧返回结构）
    """
    if not rows:
        return {"created_count": 0, "record_id_list": []}
    field_list = list(fields)
    if not field_list:
        raise LarkBatchError("batch_create_records: fields 不能为空")

    created_ids: list[str] = []
    for idx, row in enumerate(rows):
        if len(row) != len(field_list):
            raise LarkBatchError(
                f"batch_create_records 第 {idx + 1} 行列数不匹配: "
                f"row len={len(row)} ≠ fields len={len(field_list)}"
            )
        # 跳过全 None 的行（防止飞书报"空记录"错）
        record_obj: dict[str, Any] = {}
        for k, v in zip(field_list, row):
            if v is None:
                continue
            # 空字符串也保留（飞书会写入 ""，业务可能依赖此清空效果）
            record_obj[k] = v
        if not record_obj:
            if verbose:
                print(f"    [create] {idx + 1}/{len(rows)} skip 全空行", file=sys.stderr)
            continue

        cmd = _build_cmd(
            lark_cli_path, "+record-upsert",
            base_token=base_token, table_id=table_id,
            record_id=None,
            json_payload=record_obj,
            as_bot=as_bot,
        )
        try:
            data = _run_single(cmd, timeout=timeout)
        except LarkBatchError as e:
            raise LarkBatchError(
                f"batch_create_records 在第 {idx + 1}/{len(rows)} 行失败: {e}",
                succeeded=len(created_ids),
                failed_ref=idx,
            ) from e

        # +record-upsert 返回 {"record": {"record_id": "rec...", "fields": {...}}}
        rid = ""
        if isinstance(data, dict):
            rec = data.get("record") or data
            rid = rec.get("record_id") or rec.get("recordId") or ""
        if rid:
            created_ids.append(rid)
        if verbose:
            print(f"    [create] {idx + 1}/{len(rows)} → {rid or '<no-id>'}", file=sys.stderr)
        if idx < len(rows) - 1:
            time.sleep(_PER_CALL_SLEEP)

    return {"created_count": len(created_ids), "record_id_list": created_ids}
