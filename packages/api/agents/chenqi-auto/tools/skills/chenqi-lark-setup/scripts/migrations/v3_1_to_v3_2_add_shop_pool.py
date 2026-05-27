# -*- coding: utf-8 -*-
"""
Migration: v3.1.0 -> v3.2.0
============================

新增「店铺账号池」表（11 字段），用于支撑多店铺凭证池：
  - 店铺ID / 店铺名称 / client_id / api_key
  - 每日配额 / 今日已用 / 优先级 / 状态
  - 最后切店时间 / 备注 / 计数日期

下游技能（chenqi-auto-translate / chenqi-listing 等）通过
`_chenqi_common.shop_pool` 模块读写本表，按 Ozon 平台 BJ 凌晨 3 点
配额刷新规则做配额管理。
"""
import sys
from pathlib import Path

# 把 skill 根目录加 sys.path（让 schema. / lib. 能 import）
_SKILL_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_SKILL_ROOT) not in sys.path:
    sys.path.insert(0, str(_SKILL_ROOT))

from lib.lark_io import create_table_with_fields, list_tables  # noqa: E402
from schema.tables import TABLE_SHOP_POOL, compute_fields_hash  # noqa: E402


# === migration 契约（version_history.py 定义） ===
FROM_VERSION = "v3.1.0"
TO_VERSION = "v3.2.0"
DESCRIPTION = "新增「店铺账号池」表 11 字段（多店铺凭证池基础设施）"

TABLE_NAME = TABLE_SHOP_POOL["name"]


def migrate(base_info: dict, lark_cli_path: str) -> dict:
    """
    幂等执行：如果「店铺账号池」表已存在于 base_info.tables，跳过建表，仅刷新元数据。
    """
    base_token = base_info["base_token"]
    tables = base_info.setdefault("tables", {})

    if TABLE_NAME in tables:
        existing_tid = tables[TABLE_NAME].get("table_id")
        print(f"  [skip] 「{TABLE_NAME}」表已存在于 base_info (table_id={existing_tid})，跳过建表")
    else:
        # 第二道幂等保护：飞书侧实查，防止 base_info 不一致导致重复建表
        remote_tables = list_tables(lark_cli_path, base_token)
        remote_match = next(
            (t for t in remote_tables if t.get("name") == TABLE_NAME), None
        )
        if remote_match:
            tid = remote_match.get("table_id") or remote_match.get("id")
            print(f"  [recover] 飞书侧已有「{TABLE_NAME}」(table_id={tid})，"
                  f"补回 base_info 但不重新建字段")
            tables[TABLE_NAME] = {
                "table_id": tid,
                "field_count": "unknown(recovered)",
                "fields": {},
                "_warn": "base_info 与飞书不同步，已自动 recover；建议手工核对字段映射",
            }
        else:
            print(f"  [step] 创建表「{TABLE_NAME}」+ {len(TABLE_SHOP_POOL['fields'])} 字段")
            table_id, name_to_id = create_table_with_fields(
                lark_cli_path, base_token, TABLE_SHOP_POOL,
            )
            tables[TABLE_NAME] = {
                "table_id": table_id,
                "field_count": len(name_to_id),
                "fields": name_to_id,
            }
            print(f"  [OK] table_id={table_id}, fields={len(name_to_id)}")

    # 刷新 fields_hash（schema 整体校验）
    base_info["fields_hash"] = compute_fields_hash()
    return base_info
