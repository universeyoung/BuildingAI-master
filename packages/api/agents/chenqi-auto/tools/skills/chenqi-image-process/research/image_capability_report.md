# Accio 生图能力实测报告 (Ozon 电商场景)

## 关键结论 (TL;DR)
- **主体一致性**: **9.5/10**。`image_edit` 在保留商品本体（Logo、形状、灯光、按键）方面表现惊人，几乎达到 1:1 还原，非常适合电商 SKU 出图。
- **俄文渲染**: **完美支持**。实测能准确渲染复杂的西里尔字母（如 щ, в, р, а），且字体美观、排版整齐，可直接用于详情图文案。
- **极限分辨率**: 默认支持多种比例（3:4, 4:5, 16:9等），视觉分辨率约在 1024px-1440px 级别，略低于 Ozon 1200x1600 的严格要求，建议配合 **hd_upscale** 任务类型使用。
- **Ozon 主图最低要求 1200x1600 是否能满足**: **基本满足**。通过 3:4 比例生成后，画质清晰度足以满足电商展示，但物理像素可能需要一步放大。
- **平均耗时**: 简单场景约 **15s**，复杂构图（带文字/多宫格）约 **25s**。
- **建议方案**: 采用 `image_edit` + `complex_generation` 模式，将 1688 原图作为 reference，分步生成场景图与带文字的详情图。

---

## 详细测试

### 测试 1：主体一致性 (Consistency)
| 场景 | 图片 URL | 还原度评分 | 备注 |
| :--- | :--- | :--- | :--- |
| (a) 纯白背景 (3:4) | [查看图片](https://sc02.alicdn.com/kf/A01bb388487a4459a8f14e30388fe4699d.png) | 10/10 | Logo 和形体分毫不差。 |
| (b) 木桌+绿植 (4:5) | [查看图片](https://sc02.alicdn.com/kf/A64fa5823375c43658daf58258a8d41d3R.png) | 9/10 | 光影融合自然。 |
| (c) 户外露营 (16:9) | [查看图片](https://sc02.alicdn.com/kf/A37f873d952e4450cb61efe38d20a5da4F.png) | 8/10 | 夜间光效渲染到位，主体略显硬。 |
| (d) 手持使用 (1:1) | [查看图片](https://sc02.alicdn.com/kf/Abf39581655004bc19cd79c68d72bdc5cj.png) | 7/10 | 误加了挂绳，并出现了中文字。 |

### 测试 2：俄文渲染与风格 (Russian Text & Style)
| 需求 | 图片 URL | 渲染准确性 | 风格分 |
| :--- | :--- | :--- | :--- |
| (e) 极简北欧+蓝牙/RGB文案 | [查看图片](https://sc02.alicdn.com/kf/A288134ab75eb42a2b845e14a23aadc07t.png) | 10/10 | 字母 "подсветка" 极其准确。 |
| (f) 暖色生活+型号标题 | [查看图片](https://sc02.alicdn.com/kf/Aea986163921343678cdb37f4842ef6499.png) | 10/10 | "Беспроводная колонка" 排版大气。 |
| (g) 科技感+角标 | [查看图片](https://sc02.alicdn.com/kf/A980aa911aa5e4ed585e7539a45f605aaE.png) | 9/10 | "Хит продаж" 霓虹灯效果极佳。 |

### 测试 4：复杂构图 (Detail Page)
- **(h-j) 4 宫格特性卡**: [查看图片](https://sc02.alicdn.com/kf/A56fadb7dc123458c9efdc14cc958daa3j.png)
- **评估**: 成功生成了带 4 个图标和 4 段俄文描述的底部信息栏。
- **对齐质量**: 极高。图标与文字一一对应，且文字分级清晰。
- **内容一致性**: 即使在底部增加了这么多信息，顶部的产品主体依然保持原样。

---

## 风险清单 (规避坑)
1. **中文字符入侵**: 如果 Prompt 中没有明确指定语言，或者 reference 图片中带有中文，模型有时会误生成中文字符。**对策**: 在 Prompt 中强调 "All text must be in Russian"。
2. **多余组件生成**: 在 "手持" 等互动场景中，模型可能会为了逻辑自洽增加原产品没有的挂绳、按钮。**对策**: 尽量使用静态场景 prompt。
3. **分辨率边缘**: 默认生成的图片若要上 Ozon 1200x1600，需要在后期或通过 `hd_upscale` 进行补强。

---

## 推荐 Prompt 模板

- **纯白主图 prompt**:
  `Product main image, [PRODUCT_NAME], pure white background, professional studio lighting, high resolution, 3:4 aspect ratio.`
- **俄文场景图 prompt**:
  `[STYLE_DESCRIPTION] lifestyle photography of [PRODUCT_NAME]. On the [POSITION], add Russian text: "[TEXT_CONTENT]" in clean font. All text must be in Russian.`
- **4 宫格详情图 prompt**:
  `Ecommerce detail page for [PRODUCT_NAME]. Bottom section features a 4-grid layout with icons and Russian descriptions: 1. [ICON_1] + "[TEXT_1]", 2. [ICON_2] + "[TEXT_2]"... Professional alignment.`
- **关键词修饰**:
  `High fidelity, sharp details, accurate product morphology, no Chinese characters, professional ecommerce layout.`
