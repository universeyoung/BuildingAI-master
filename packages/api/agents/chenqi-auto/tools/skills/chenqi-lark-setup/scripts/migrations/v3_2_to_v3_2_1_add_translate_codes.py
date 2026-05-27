# -*- coding: utf-8 -*-
"""
Migration: v3.2.0 -> v3.2.1
============================

给「失败事件流水」表的「错误码」单选字段，追加 3 个翻译阶段失败码：
  - TRANSLATE_OZON_API_FAIL       Ozon API 调用失败/限流耗尽
  - TRANSLATE_CATEGORY_NOMATCH    类目匹配置信度 < 0.7
  - TRANSLATE_DICT_VALUE_NOMATCH  必填属性的字典值无法匹配

为下游 chenqi-auto-translate 的 M3-M5 提供失败码落地通道。
"""
import sys
from pathlib import Path

# 把 skill 根目录加 sys.path
_SKILL_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_SKILL_ROOT) not in sys.path:
    sys.path.insert(0, str(_SKILL_ROOT))

from lib.lark_io import append_select_options, get_field  # noqa: E402
from schema.tables import compute_fields_hash  # noqa: E402


# === migration 契约（version_history.py 定义） ===
FROM_VERSION = "v3.2.0"
TO_VERSION = "v3.2.1"
DESCRIPTION = "「失败事件流水.错误码」追加 3 个翻译阶段失败码（OZON_API/CATEGORY/DICT_VALUE）"

TABLE_NAME = "失败事件流水"
FIELD_NAME = "错误码"

NEW_OPTIONS = [
    {"name": "TRANSLATE_OZON_API_FAIL",      "color": 11},  # 红
    {"name": "TRANSLATE_CATEGORY_NOMATCH",   "color": 11},
    {"name": "TRANSLATE_DICT_VALUE_NOMATCH", "color": 11},
]


def migrate(base_info: dict, lark_cli_path: str) -> dict:
    """
    幂等执行：
      - 拉「错误码」字段当前 options
      - 缺哪个补哪个；全有则 skip
      - 不动 base_info 里 tables.失败事件流水 的字段映射（field_id 不变）
    """
    base_token = base_info["base_token"]
    tables = base_info.setdefault("tables", {})

    fail_table = tables.get(TABLE_NAME)
    if not fail_table:
        raise RuntimeError(
            f"[v3.2.1 migration] base_info.tables 里没有「{TABLE_NAME}」，"
            f"请确认 base 已建表（v3.0+ schema 应已包含）。"
        )

    fields = fail_table.get("fields") or {}
    if not isinstance(fields, dict):
        raise RuntimeError(
            f"[v3.2.1 migration] tables.{TABLE_NAME}.fields 不是 dict，"
            f"无法定位「{FIELD_NAME}」字段 ID。"
        )
    field_id = fields.get(FIELD_NAME)
    if not field_id:
        raise RuntimeError(
            f"[v3.2.1 migration] 找不到字段「{FIELD_NAME}」的 field_id。"
            f"现有字段：{list(fields.keys())}"
        )
    table_id = fail_table["table_id"]

    print(f"  [step] 拉「{TABLE_NAME}.{FIELD_NAME}」(field_id={field_id}) 当前选项")
    field = get_field(lark_cli_path, base_token, table_id, field_id)
    # v3 API：options 直接平铺在 field 顶层（不是 property.options）
    current_count = len(field.get("options") or [])
    print(f"  [info] 当前已有 {current_count} 个选项")

    print(f"  [step] 追加 3 个翻译阶段失败码（幂等）")
    added = append_select_options(
        lark_cli_path, base_token, table_id, field_id, NEW_OPTIONS,
    )
    if added:
        print(f"  [OK] 已新增 {len(added)} 个选项：{added}")
    else:
        print(f"  [skip] 3 个选项均已存在，无需新增")

    # 刷新 fields_hash（schema 整体校验）
    base_info["fields_hash"] = compute_fields_hash()
    return base_info
