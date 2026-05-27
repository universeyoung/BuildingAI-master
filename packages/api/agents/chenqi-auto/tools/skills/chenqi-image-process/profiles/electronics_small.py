# -*- coding: utf-8 -*-
"""electronics_small profile：占位骨架（v0.2 完善）。

充电器 / 数据线 / 充电宝 / 小家电等。当前直接 fallback 到 default_universal。
"""
from .default_universal import PROFILE as _UNIVERSAL_PROFILE

PROFILE = dict(_UNIVERSAL_PROFILE)
PROFILE["name"] = "electronics_small"
PROFILE["category_label_ru"] = "Электроника (мелкая)"
# v0.2 占位：复用 default_universal 全部位置设计
