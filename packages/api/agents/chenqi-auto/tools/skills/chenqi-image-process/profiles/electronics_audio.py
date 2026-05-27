# -*- coding: utf-8 -*-
"""electronics_audio profile：便携蓝牙音箱 / 桌面音响 / 耳机标杆 profile。

8 张图位置定义沿用 research/ozon_visual_pattern.md 调研结论。
"""

PROFILE = {
    "name": "electronics_audio",
    "category_label_ru": "Аудио и электроника",
    "style_keywords": [
        "深色氛围（dark moody background）",
        "戏剧化光照（dramatic lighting）",
        "RGB 灯效（subtle RGB accent）",
        "高对比度（high contrast）",
        "未来感（futuristic）",
    ],
    "global_subject_anchor": (
        "ВАЖНО: сохрани форму, пропорции, цвет, логотип и все детали товара ровно как на референсных изображениях. "
        "Не добавляй несуществующие кнопки/индикаторы/порты. Не меняй форму корпуса."
    ),
    "global_negative": (
        "NO watermark, NO website URL, NO QR code, NO multiple identical products, "
        "NO unrelated objects, NO fake brands, NO English text mixed with Russian"
    ),
    "positions": [
        # 位置 1：主图带文字（列表页转化器）
        {
            "idx": 1,
            "key": "main_with_text",
            "role_ru": "Главное изображение с крупным заголовком",
            "scene_zh": "纯深色背景 + 商品居中 45 度 + 大字俄文卖点（左上或右上）+ RGB 氛围光晕",
            "composition": "subject centered, slight 45° angle, large bold Russian headline at top, dark moody backdrop with subtle RGB rim light",
            "flavor_hint": "5-12 字俄文卖点（如「Звук, который трогает»）",
        },
        # 位置 2：家居场景
        {
            "idx": 2,
            "key": "scene_home",
            "role_ru": "Домашняя сцена использования",
            "scene_zh": "客厅或书桌氛围 + 暖光氛围灯 + 木桌质感 + 商品自然摆放（30 度俯视）",
            "composition": "warm cozy living room or desk scene, wooden surface, ambient warm lighting, product naturally placed, 30° top-down view",
            "flavor_hint": "家用场景描述（「Идеальный спутник для дома」）",
        },
        # 位置 3：户外场景（突出便携属性）
        {
            "idx": 3,
            "key": "scene_outdoor",
            "role_ru": "Сцена на открытом воздухе",
            "scene_zh": "草地或营地夕阳 + 营地灯 + 商品挂在帐篷边或放在岩石上 + 自然光",
            "composition": "outdoor camping scene, sunset golden hour lighting, product on rock or hanging by tent, natural softlight",
            "flavor_hint": "便携/户外语义（「Музыка везде с тобой」）",
        },
        # 位置 4：多角度细节（4 宫格内合）
        {
            "idx": 4,
            "key": "multi_angle",
            "role_ru": "4 ракурса детально",
            "scene_zh": "4 宫格构图：左上正面 / 右上 45 度 / 左下侧面按键区 / 右下底部接口；纯深色背景；每格小标签",
            "composition": "2x2 grid composition: front view / 45° angle / side button area / bottom ports, dark background, small Russian labels under each cell",
            "flavor_hint": "无（4 个小标签由模板写死）",
            "static_labels_ru": ["Спереди", "Сбоку", "Кнопки", "Разъёмы"],
        },
        # 位置 5：4 宫格特性（一图看尽）
        {
            "idx": 5,
            "key": "features_grid",
            "role_ru": "Сетка ключевых характеристик",
            "scene_zh": "4 宫格 icon + 大字数据：防水/续航/蓝牙版本/RGB（每格 1 个 icon + 1 行俄文数字 + 1 行俄文说明）",
            "composition": "2x2 feature grid with bold icons, large Russian numbers per cell, dark backdrop, modern flat icon style",
            "flavor_hint": "4 个特性（每个 1 行俄文 + 数字，由 attr_values 提取）",
            "static_anchor_attrs": ["防水", "续航", "蓝牙", "RGB"],
        },
        # 位置 6：俄文规格表
        {
            "idx": 6,
            "key": "spec_table",
            "role_ru": "Таблица технических характеристик",
            "scene_zh": "深色背景 + 商品左侧立 / 右侧俄文规格表（功率/续航/蓝牙/重量/防水）",
            "composition": "product on left, technical specifications table on right with Russian labels and values, dark elegant background",
            "flavor_hint": "无（规格由 attr_values 提取）",
        },
        # 位置 7：全配件平铺
        {
            "idx": 7,
            "key": "accessories",
            "role_ru": "Полная комплектация",
            "scene_zh": "俯视 flat-lay 平铺：商品 + 充电线 + 说明书 + 礼盒；浅色或纯白背景增强结构感",
            "composition": "top-down flat lay shot: product + charging cable + user manual + gift box, clean light background",
            "flavor_hint": "「Полный комплект для подарка」",
        },
        # 位置 8：品牌承诺/信任锁单
        {
            "idx": 8,
            "key": "brand_promise",
            "role_ru": "Гарантия и обязательства",
            "scene_zh": "深色背景 + 3 个图标徽章（保修/正品/快速发货）+ 俄文说明",
            "composition": "dark background with 3 trust badges (warranty / authentic / fast shipping), Russian text labels, clean modern layout",
            "flavor_hint": "「Гарантия 12 месяцев」「Оригинальный товар」「Быстрая доставка」",
        },
    ],
}
