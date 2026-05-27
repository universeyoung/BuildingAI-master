# -*- coding: utf-8 -*-
"""home_textile profile：占位骨架（v0.2 完善）。

床品 / 毛巾 / 抱枕等。当前直接 fallback 到 default_universal。
"""
from .default_universal import PROFILE as _UNIVERSAL_PROFILE

PROFILE = dict(_UNIVERSAL_PROFILE)
PROFILE["name"] = "home_textile"
PROFILE["category_label_ru"] = "Домашний текстиль"
