# -*- coding: utf-8 -*-
"""
Migration: v3.2.1 -> v3.3.0
============================

给「商品全生命周期」表追加 1 个 text 字段：
  - 「采集多角度图组URL」  text（存 JSON 数组字符串）

存储约定：
  - 1688 详情页 3-8 张白底/多角度大图，下载后上传到 Accio CDN 拿公开 URL
  - 字段值 = JSON 数组字符串，例如 '["https://cdn.accio.com/xxx.jpg", ...]'
  - 下游 chenqi-image-process v0.1 直接 json.loads 喂给 image_edit 的 reference_images
    （多角度参考是消除"商品本体跑偏"幻觉的唯一确定解，实测 9.0/10）

历史背景：
  - 早期版本曾用 attachment 类型，但发现 image_edit 工具吃公开 URL 而非飞书内部链接，
    走 attachment 反而要二次下载，故改用 text 存 CDN URL 数组。
  - migration 自带"删除旧 attachment 字段（含同名）→ 创建 text 字段"的修复路径，
    保证已经跑过早期版本的 base 也能平滑升级。

幂等性：
  - base_info 已有正确 type 的 field_id → skip
  - 物理已存在但是 attachment 类型 → 先 +field-delete → +field-create
  - 物理已存在且是 text 类型 → 仅回写 base_info
  - 都不存在 → 直接 +field-create
"""
import sys
from pathlib import Path

_SKILL_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_SKILL_ROOT) not in sys.path:
    sys.path.insert(0, str(_SKILL_ROOT))

import json  # noqa: E402
import time  # noqa: E402

from lib.lark_io import lark, run, fid, AS_BOT, strip_meta  # noqa: E402
from schema.tables import compute_fields_hash, f_text  # noqa: E402


# === migration 契约 ===
FROM_VERSION = "v3.2.1"
TO_VERSION = "v3.3.0"
DESCRIPTION = "「商品全生命周期」追加 text 字段「采集多角度图组URL」（存 CDN URL JSON 数组）"

TABLE_NAME = "商品全生命周期"
NEW_FIELD_NAME = "采集多角度图组URL"
LEGACY_FIELD_NAMES = ["采集多角度图组"]  # 早期 attachment 版本字段名，遇到要清理

# text 字段在飞书 API 里 type=1，统一通过 strip_meta 处理 schema dict


def _list_fields(lark_cli_path: str, base_token: str, table_id: str) -> dict:
    # 用 lark_io.list_all_fields 自动分页（lark-cli 默认 100 条上限）
    from lib.lark_io import list_all_fields
    items = list_all_fields(lark_cli_path, base_token, table_id)
    out = {}
    for f in items:
        name = f.get("field_name") or f.get("name")
        if name:
            out[name] = {
                "field_id": fid(f),
                "type": f.get("type"),
                "raw": f,
            }
    return out


def _delete_field(lark_cli_path: str, base_token: str, table_id: str, field_id: str, label: str):
    print(f"  [step] +field-delete 删除旧字段「{label}」 (field_id={field_id})")
    run(lark(
        lark_cli_path, "+field-delete", *AS_BOT,
        "--base-token", base_token,
        "--table-id", table_id,
        "--field-id", field_id,
        "--yes",  # lark-cli 把 field-delete 标为高风险，需显式确认
    ))
    time.sleep(0.5)


def _create_text_field(lark_cli_path: str, base_token: str, table_id: str, name: str) -> str:
    f_payload = strip_meta(f_text(name))
    print(f"  [step] +field-create text 字段「{name}」  payload={f_payload}")
    create_resp = run(lark(
        lark_cli_path, "+field-create", *AS_BOT,
        "--base-token", base_token,
        "--table-id", table_id,
        "--json", json.dumps(f_payload, ensure_ascii=False),
    ))
    new_id = fid(create_resp.get("field", {})) or fid(create_resp)
    if not new_id:
        raise RuntimeError(f"+field-create 未返回 field_id: {create_resp}")
    time.sleep(0.5)
    return new_id


def migrate(base_info: dict, lark_cli_path: str) -> dict:
    base_token = base_info["base_token"]
    tables = base_info.setdefault("tables", {})

    lifecycle_table = tables.get(TABLE_NAME)
    if not lifecycle_table:
        raise RuntimeError(f"[v3.3.0 migration] 缺「{TABLE_NAME}」表")

    table_id = lifecycle_table["table_id"]
    fields = lifecycle_table.setdefault("fields", {})

    # ---- 拉飞书真实字段列表 ----
    print(f"  [step] 拉「{TABLE_NAME}」字段列表")
    physical = _list_fields(lark_cli_path, base_token, table_id)

    # ---- 清理早期 attachment 同含义字段 ----
    for legacy_name in LEGACY_FIELD_NAMES:
        if legacy_name in physical:
            legacy_id = physical[legacy_name]["field_id"]
            legacy_type = physical[legacy_name]["type"]
            print(f"  [legacy] 发现旧字段「{legacy_name}」 type={legacy_type}，删除以避免冲突")
            _delete_field(lark_cli_path, base_token, table_id, legacy_id, legacy_name)
        # 同时清理 base_info 残留
        if legacy_name in fields:
            print(f"  [legacy] 清理 base_info 残留「{legacy_name}」")
            fields.pop(legacy_name, None)

    # ---- 重新拉一次（删过字段后） ----
    physical = _list_fields(lark_cli_path, base_token, table_id)

    # ---- 处理目标 NEW_FIELD_NAME ----
    if NEW_FIELD_NAME in physical:
        existing_type = physical[NEW_FIELD_NAME]["type"]
        existing_id = physical[NEW_FIELD_NAME]["field_id"]
        if existing_type == 1:  # text
            print(f"  [skip] 字段「{NEW_FIELD_NAME}」已存在且 type=1 (text)，回写 base_info")
            fields[NEW_FIELD_NAME] = existing_id
        else:
            print(f"  [fix] 字段「{NEW_FIELD_NAME}」已存在但 type={existing_type} ≠ text(1)，删除重建")
            _delete_field(lark_cli_path, base_token, table_id, existing_id, NEW_FIELD_NAME)
            new_id = _create_text_field(lark_cli_path, base_token, table_id, NEW_FIELD_NAME)
            print(f"  [OK] 重建成功 field_id={new_id}")
            fields[NEW_FIELD_NAME] = new_id
    else:
        new_id = _create_text_field(lark_cli_path, base_token, table_id, NEW_FIELD_NAME)
        print(f"  [OK] 创建成功 field_id={new_id}")
        fields[NEW_FIELD_NAME] = new_id

    base_info["fields_hash"] = compute_fields_hash()
    return base_info
