# -*- coding: utf-8 -*-
"""fashion_apparel profile：占位骨架（v0.2 完善）。

服装 / 鞋帽 / 配饰。当前直接 fallback 到 default_universal。
"""
from .default_universal import PROFILE as _UNIVERSAL_PROFILE

PROFILE = dict(_UNIVERSAL_PROFILE)
PROFILE["name"] = "fashion_apparel"
PROFILE["category_label_ru"] = "Одежда и аксессуары"
