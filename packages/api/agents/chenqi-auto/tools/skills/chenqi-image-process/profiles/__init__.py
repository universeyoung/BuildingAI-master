# -*- coding: utf-8 -*-
"""profile 路由表：cat_id → profile_name。

key = Ozon 类目 ID（飞书「Ozon类目ID」字段，已由 chenqi-auto-translate 写入）。
未命中 → default_universal。

5 个 profile：
  - electronics_audio: 完整（v0.1 标杆，蓝牙音箱/耳机/桌面音响）
  - electronics_small: 占位骨架（v0.2 完善，充电器/数据线/小家电）
  - home_textile:      占位骨架（v0.2 完善，床品/毛巾/抱枕）
  - fashion_apparel:   占位骨架（v0.2 完善，服装/鞋帽）
  - default_universal: 完整（任意类目兜底）
"""

# cat_id → profile_name
CAT_ID_TO_PROFILE = {
    # ---- electronics_audio ----
    17028908: "electronics_audio",  # Компьютерная акустика（计算机音响）
    # 后续按需扩展（蓝牙音箱/便携音响/头戴耳机/真无线/有线耳机的 cat_id 续上）
}

DEFAULT_PROFILE = "default_universal"


def route(cat_id) -> str:
    """根据 cat_id 路由到 profile_name。

    Args:
        cat_id: 飞书「Ozon类目ID」字段（text，但内容是数字字符串）。

    Returns:
        profile_name 字符串。
    """
    if cat_id is None or cat_id == "":
        return DEFAULT_PROFILE
    try:
        cid = int(str(cat_id).strip())
    except (TypeError, ValueError):
        return DEFAULT_PROFILE
    return CAT_ID_TO_PROFILE.get(cid, DEFAULT_PROFILE)


def load_profile(profile_name: str) -> dict:
    """动态导入 profile 模块返回其 PROFILE dict。"""
    import importlib
    if profile_name not in (
        "electronics_audio",
        "electronics_small",
        "home_textile",
        "fashion_apparel",
        "default_universal",
    ):
        profile_name = DEFAULT_PROFILE
    mod = importlib.import_module(f"profiles.{profile_name}")
    return getattr(mod, "PROFILE")
