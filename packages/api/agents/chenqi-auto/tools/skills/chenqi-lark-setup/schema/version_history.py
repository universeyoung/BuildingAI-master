# -*- coding: utf-8 -*-
"""
Schema 版本历史 + 迁移注册表
============================

每一次 schema 升级都要：
  1. 在 schema/tables.py 改 SCHEMA_VERSION
  2. 在 scripts/migrations/ 下加一个迁移脚本（命名规范见下方）
  3. 在本文件 MIGRATIONS 列表追加一行（必须按版本顺序）

迁移脚本命名规范：
  scripts/migrations/v{from}_to_v{to}_{slug}.py
  例：v3_1_to_v3_2_add_shop_pool.py

迁移脚本契约（每个文件必须暴露）：
  FROM_VERSION: str   # 例 "v3.1.0"
  TO_VERSION:   str   # 例 "v3.2.0"
  DESCRIPTION:  str   # 一句话说明
  def migrate(base_info: dict, lark_cli_path: str) -> dict:
      \"\"\"
      入参：
        base_info     - output/base_info.json 的反序列化字典
        lark_cli_path - lark-cli.cmd 完整路径
      执行：
        - 调 lark-cli 改飞书 base 结构（建表/加字段/补选项）
        - 修改 base_info（加 tables.xxx 元数据等），但**不要写盘**
      返回：
        修改后的 base_info（由 migrate 主入口统一写盘 + 刷新 schema_version）
      失败：
        抛异常，主入口会捕获并提示用户，不会污染 base_info.schema_version
      \"\"\"
"""

# 注册表：(from_version, to_version, module_name)
# 模块名是 scripts.migrations.<module_name>，不带 .py 后缀
# 必须按版本严格升序排列
MIGRATIONS = [
    ("v3.1.0", "v3.2.0", "v3_1_to_v3_2_add_shop_pool"),
    ("v3.2.0", "v3.2.1", "v3_2_to_v3_2_1_add_translate_codes"),
    ("v3.2.1", "v3.3.0", "v3_2_1_to_v3_3_add_collect_gallery"),
]


def get_migration_path(from_version: str, to_version: str):
    """
    返回从 from_version 到 to_version 需要依次跑的迁移列表。
    如果 from_version == to_version，返回空列表（无需迁移）。
    如果链路不通（中间断版本 / 目标版本不存在），抛 ValueError。
    """
    if from_version == to_version:
        return []

    # 按顺序找起点
    chain = []
    cursor = from_version
    for f, t, mod in MIGRATIONS:
        if f != cursor:
            continue
        chain.append((f, t, mod))
        cursor = t
        if cursor == to_version:
            return chain

    if not chain:
        raise ValueError(
            f"未找到从 {from_version} 出发的迁移路径。"
            f"请检查 schema/version_history.py 的 MIGRATIONS 注册表。"
        )
    raise ValueError(
        f"迁移链路不完整：从 {from_version} 只能走到 {cursor}，"
        f"无法到达目标 {to_version}。"
    )


def list_known_versions():
    """所有已知版本（含起点和终点），按出现顺序"""
    versions = []
    for f, t, _ in MIGRATIONS:
        if f not in versions:
            versions.append(f)
        if t not in versions:
            versions.append(t)
    return versions
