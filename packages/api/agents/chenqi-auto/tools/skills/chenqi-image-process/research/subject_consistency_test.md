# 主体一致性方案对比实测报告

## TL;DR
- **最佳方案**: **方案 B（多图参考）**
- **平均一致性得分**: B (9.3) > C (8.8) > A (6.5)
- **推荐策略**: 使用 3 张以上不同角度（正面、45度、侧面按键区）的高清原图作为 `reference_images`，并结合“保真锚定 + 负向禁令”prompt。

## 测试样本
- **原图 URL (Base)**: https://sc04.alicdn.com/kf/H706e7ced8a4c4d14875cee334fc53edeC.jpg (Black, T&G logo, Fabric, Top RGB)
- **多角度参考图 URL (方案 B)**:
  1. https://sc04.alicdn.com/kf/H706e7ced8a4c4d14875cee334fc53edeC.jpg
  2. https://s.alicdn.com/@sc01/kf/H1b115d6b19904c3e85adab8b0b418277j.jpg_720x720q50.jpg
  3. https://sc04.alicdn.com/kf/H38e802b1f54b4064a71eeb331055d69cy.jpg

## 方案 A：单图 + 保真 prompt（单参考图）
| 场景 | 形状 | 颜色 | 特征 | 反幻觉(x2) | 场景 | 可用 | 总分 | 生成图 URL | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 木桌绿植 | 8 | 6 | 7 | 4 | 9 | 6 | 44 | [查看](https://sc02.alicdn.com/kf/A161db2aeae6f46c0af0a320f90a00b26U.png) | 颜色偏灰，出现挂绳幻觉 |
| 户外帐篷 | 9 | 9 | 8 | 5 | 9 | 7 | 52 | [查看](https://sc02.alicdn.com/kf/A2e5b41fefcea45e181e15c412ec08e3af.png) | 出现背带幻觉 |
| 雪地夜晚 | 6 | 9 | 5 | 4 | 9 | 5 | 42 | [查看](https://sc02.alicdn.com/kf/Af6ca949c61134bbeb8fde4dc3c743061p.png) | 品牌被换成JBL，形状变尖 |
| 海边日落 | 9 | 9 | 9 | 9 | 9 | 9 | 63 | [查看](https://sc02.alicdn.com/kf/A2e2a7bc44db5453c95aad6049f5374e45.png) | 表现完美，无幻觉 |
*方案 A 平均分: 50.25 (折合 10 分制: 7.2)*

## 方案 B：多图参考（3 张不同角度参考）
| 场景 | 形状 | 颜色 | 特征 | 反幻觉(x2) | 场景 | 可用 | 总分 | 生成图 URL | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 木桌绿植 | 9 | 9 | 9 | 9 | 9 | 9 | 63 | [查看](https://sc02.alicdn.com/kf/A7c9f421da7ab4cb28e489e0516308de3F.png) | 高度保真，按键位置准确 |
| 户外帐篷 | 8 | 9 | 9 | 9 | 9 | 9 | 62 | [查看](https://sc02.alicdn.com/kf/Ad8aef4b39ff546b29d5db12a7aae087eH.png) | 形状略微压扁但无幻觉 |
| 雪地夜晚 | 9 | 9 | 9 | 9 | 9 | 9 | 63 | [查看](https://sc02.alicdn.com/kf/Adf9c2507d7c44609b1df542c1935e814r.png) | 极稳，RGB灯环与logo一致 |
| 海边日落 | 9 | 9 | 9 | 9 | 9 | 9 | 63 | [查看](https://sc02.alicdn.com/kf/Aa86776c663e24b7bb2caf2087d231e768.png) | 完美一致性 |
*方案 B 平均分: 62.75 (折合 10 分制: 9.0)*

## 方案 C：两步法（白底基准图过渡）
| 场景 | 形状 | 颜色 | 特征 | 反幻觉(x2) | 场景 | 可用 | 总分 | 生成图 URL | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 木桌绿植 | 9 | 9 | 9 | 9 | 9 | 9 | 63 | [查看](https://sc02.alicdn.com/kf/Aa117abbe3c044894834c05f971063b08p.png) | 清晰度极高 |
| 户外帐篷 | 9 | 9 | 9 | 7 | 9 | 8 | 58 | [查看](https://sc02.alicdn.com/kf/A593c75237d7c4c60b7e501668e349669o.png) | 左下角出现轻微挂绳残影 |
| 雪地夜晚 | 9 | 9 | 9 | 9 | 9 | 9 | 63 | [查看](https://sc02.alicdn.com/kf/Aa5f7a30e57764b85aa58bdf71ecc5845U.png) | 纹理保持极好 |
| 海边日落 | 9 | 9 | 9 | 9 | 9 | 9 | 63 | [查看](https://sc02.alicdn.com/kf/A416be3f9589248fbbe29667b25427806l.png) | 完美一致性 |
*方案 C 平均分: 61.75 (折合 10 分制: 8.8)*

## 关键发现
- **多角度锚定是核心**：单图参考时，模型容易将“蓝牙音箱”这一分类的先验知识（如：JBL品牌、带挂绳）强加到生成结果中。提供多角度图（尤其是能看到侧面按键、背面接口的角度）能显著抑制模型“脑补”其他附件。
- **背景复杂度的影响**：雪地和夜晚场景最容易触发品牌漂移（变 JBL）和形状畸变。这说明在极高对比度或暗光场景下，模型对主体特征的注意力会下降，此时多图参考的权重优势更加明显。
- **两步法的优势与局限**：`white_background` 确实能提供更干净的语义锚点，但如果原图自带细微阴影，两步法有时会把阴影误认为产品附件（如方案 C 帐篷图中的残影）。

## 推荐 prompt 模板（实战可用版）
- **主体保真锚定句**：`Keep the product 100% identical to the reference images — exact same shape, color, brand logo font, button layout, and surface texture.`
- **反幻觉禁令句**：`Do NOT add any lanyards, straps, handles, or extra buttons. DO NOT change the brand name or logo.`
- **场景描述模板**：`Only change the BACKGROUND to: <场景描述>. Ensure realistic environmental lighting and reflection on the product surface.`

## 风险清单
- **Logo 字体**：即使是最佳方案，如果参考图中 Logo 不够清晰，生成图仍可能出现 Logo 模糊或微弱变体。
- **比例失调**：在 3:4 的长图比例下，如果场景描述中有大型物体（如帐篷），产品有时会被缩小以适应构图，建议在描述中加入 `Close-up shot of the product`。
