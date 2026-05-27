# -*- coding: utf-8 -*-
"""default_universal profile：任何类目的兜底 profile。

设计原则：
- 与 electronics_audio 同样 8 个位置定义，但场景描述去类目专属化
- 文案模板用通用语义（不绑定 audio 关键词）
- LLM flavor 阶段会按商品 attr_values 自动调整
"""

PROFILE = {
    "name": "default_universal",
    "category_label_ru": "Универсальный товар",
    "style_keywords": [
        "干净简洁背景（clean minimalist background）",
        "柔和打光（soft even lighting）",
        "高质感（premium feel）",
        "现代构图（modern composition）",
    ],
    "global_subject_anchor": (
        "ВАЖНО: сохрани форму, пропорции, цвет, материал, узор и все детали товара ровно как на референсных изображениях. "
        "Не добавляй несуществующие элементы. Не меняй цвет или форму."
    ),
    "global_negative": (
        "NO watermark, NO website URL, NO QR code, NO unrelated objects, "
        "NO fake brands, NO English text mixed with Russian"
    ),
    "positions": [
        {
            "idx": 1,
            "key": "main_with_text",
            "role_ru": "Главное изображение с заголовком",
            "scene_zh": "纯净浅色或深色背景 + 商品居中 + 大字俄文卖点",
            "composition": "subject centered on clean background, large bold Russian headline at top, premium minimalist style",
            "flavor_hint": "5-12 字俄文卖点",
        },
        {
            "idx": 2,
            "key": "scene_home",
            "role_ru": "Сцена использования",
            "scene_zh": "商品在自然使用环境中（家居/办公/休闲）",
            "composition": "natural lifestyle scene showing product in its use environment, soft warm lighting",
            "flavor_hint": "生活场景描述",
        },
        {
            "idx": 3,
            "key": "scene_lifestyle",
            "role_ru": "Образ жизни",
            "scene_zh": "另一个生活场景（与位置 2 不同环境）",
            "composition": "alternative lifestyle context, different background and mood from position 2",
            "flavor_hint": "另一种使用情境",
        },
        {
            "idx": 4,
            "key": "multi_angle",
            "role_ru": "4 ракурса детально",
            "scene_zh": "4 宫格：正面 / 侧面 / 背面 / 细节特写",
            "composition": "2x2 grid: front / side / back / detail closeup, clean background, small Russian labels",
            "flavor_hint": "无（标签由模板写死）",
            "static_labels_ru": ["Спереди", "Сбоку", "Сзади", "Деталь"],
        },
        {
            "idx": 5,
            "key": "features_grid",
            "role_ru": "Сетка особенностей",
            "scene_zh": "4 宫格 icon + 大字（按 attr_values 提炼 4 个核心卖点）",
            "composition": "2x2 feature grid with bold icons, large Russian numbers/keywords per cell",
            "flavor_hint": "4 个核心特性（由 attr_values 提取）",
            "static_anchor_attrs": [],  # 不预设，全靠 attr_values 提炼
        },
        {
            "idx": 6,
            "key": "spec_table",
            "role_ru": "Таблица характеристик",
            "scene_zh": "商品左侧 + 俄文规格表右侧（材质/尺寸/重量/颜色/包装）",
            "composition": "product on left, specifications table on right with Russian labels, clean elegant layout",
            "flavor_hint": "无（规格由 attr_values 提取）",
        },
        {
            "idx": 7,
            "key": "accessories",
            "role_ru": "Полная комплектация",
            "scene_zh": "俯视 flat-lay：商品 + 全部配件 / 包装 / 说明书",
            "composition": "top-down flat lay: product with all accessories, packaging, manual",
            "flavor_hint": "「Полный комплект」",
        },
        {
            "idx": 8,
            "key": "brand_promise",
            "role_ru": "Гарантия и доставка",
            "scene_zh": "3 个徽章：质量保证 + 快速发货 + 售后保障",
            "composition": "3 trust badges (quality / fast shipping / support), clean modern layout",
            "flavor_hint": "「Качество」「Быстрая доставка」「Поддержка」",
        },
    ],
}
