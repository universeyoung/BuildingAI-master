# Ozon /v1/description-category/attribute 真实接口实测报告
> 2026-05-13 黄龙真调验证。覆盖 sub-agent 推测稿，sub-agent 字典 ID 全错。

## 接口 1：拿类目树
```
POST https://api-seller.ozon.ru/v1/description-category/tree
Headers: Client-Id, Api-Key, Content-Type: application/json
Body: {"language": "RU"}
返回: 692 KB 完整三级树
```

## 接口 2：拿类目属性清单
```
POST https://api-seller.ozon.ru/v1/description-category/attribute
Body: {"description_category_id": 17028908, "type_id": 95320, "language": "RU"}
[!!] type_id 必传且 > 0，否则 400 Bad Request
```

## 接口 3：拿字典值（分页）
```
POST https://api-seller.ozon.ru/v1/description-category/attribute/values
Body: {"description_category_id": 17028908, "type_id": 95320, "attribute_id": 85, "language": "RU", "last_value_id": 0, "limit": 100}
返回 result[] + has_next，分页用 last_value_id = 上一页最后一条 id
```

## 接口 4：字典值搜索（推荐用这个）
```
POST https://api-seller.ozon.ru/v1/description-category/attribute/values/search
Body: {"description_category_id": 17028908, "type_id": 95320, "attribute_id": 85, "value": "Без бренда", "limit": 20}
- 比分页快得多（品牌字典 5000+ 条），优先用搜索
```

---

## 类目结构发现
- `description_category_id=17028908` 是**中间类目**「Акустика и колонки」
- 下面 10 个 type 各对应不同子品（蓝牙音箱 / 智能音箱 / 卡拉 OK / Soundbar 等）
- 上架 payload 必传 `description_category_id` + `type_id` 二者

### 17028908 的 10 个 type
| type_id | type_name |
|---|---|
| **95320** | **Беспроводная колонка**（蓝牙音箱 ← 我们用这个）|
| 95305 | Саундбар |
| 95304 | Домашний кинотеатр |
| 95318 | Компьютерная акустика |
| 95319? | Музыкальный центр |
| 96488 | Магнитола |
| 96489 | Музыкальный центр |
| 447870437 | Умная колонка |
| 970682682 | Кассетный плеер |
| 970863449 | Караоке-система |
| 971450163 | Запчасть для умной колонки |

---

## 蓝牙音箱真实 53 属性

| 维度 | 数量 |
|---|---|
| 总属性 | **53** |
| 必填 (is_required=true) | **3** |
| 字典型 (dictionary_id>0) | **24** |
| Aspect (聚合维度) | **2** |

### 3 个必填属性
| ID | 名称 | 类型 | 字典 ID | 默认值 (实测) |
|---|---|---|---|---|
| 85 | Бренд | String | 28732849 | **126745801** = "Нет бренда" |
| 8229 | Тип | String | 1960 | **95320** = "Беспроводная колонка" |
| 9048 | Название модели | String | 0（自由文本）| 用翻译产出的型号 |

### 推荐补齐的高价值非必填
| ID | 名称 | 类型 | 字典 ID | 推荐值 |
|---|---|---|---|---|
| 10096 | Цвет товара (颜色) | String collection | 1494 | 黑色=**61574** |
| 4389 | Страна-изготовитель | String collection | 1935 | Китай=**90296** |
| 4191 | Аннотация (描述) | String | 0 | 翻译产出长描述 |
| 11254 | Rich-контент JSON | String | 0 | RC schema_v2 模板 |
| 4383 | Вес товара, г | Decimal | 0 | 420（核价产出）|
| 4382 | Размеры, мм | String | 0 | "120x120x120" |
| 6020 | Время автономной работы, ч | Decimal | 0 | 翻译产出 |
| 5520 | RMS Вт | Decimal | 0 | 翻译产出 |
| 4429 | Емкость аккумулятора, мАч | Decimal | 0 | 翻译产出 |

---

## sub-agent 推测 vs 真实对比（教训 #31）

| 字段 | sub-agent | 真实 | 差异 |
|---|---|---|---|
| type_id | 94254 | **95320** | ❌ |
| 总属性 | 52 | **53** | 蒙得近 |
| 必填数 | 4 | **3** | ❌ |
| 品牌 dict | 287 | **28732849** | ❌ |
| 品牌 No Brand id | 126745801 | **126745801** | ✅ 蒙对 |
| 类型 dict | 298 | **1960** | ❌ |
| 颜色 dict | 245 | **1494** | ❌ |

**教训**：**API 字典 ID 不能推测，必须真调**。任何 sub-agent 报告里的字典 ID 都不能信，写代码前必须 verified。

---

## v0.1 实现要点

### 默认值字典（4 个常用，先硬编码后扩 cache）
```python
DEFAULTS_BLUETOOTH_SPEAKER = {
    85: 126745801,    # Бренд: Нет бренда
    8229: 95320,      # Тип: Беспроводная колонка
    10096: 61574,     # Цвет: черный
    4389: 90296,      # Страна: Китай
}
```

### attrs_pull_full 推荐流程
1. 调 `/v1/description-category/attribute` 拿 53 个 attrs 元数据
2. diff 飞书翻译产出（`俄语属性JSON` 字段）vs 必填 3 个
3. 缺的用搜索接口 `/v1/description-category/attribute/values/search` 查默认值
4. 添加 attribute_id=11254 (Rich Content) + 4191 (描述) + 4383 (重量) + 4382 (尺寸)
5. 最终 payload 至少 8-10 条 attrs

### 缓存策略
- attrs 元数据：缓存 24 小时（按 description_category_id+type_id 缓存到本地 JSON）
- 字典值：只 cache 已查询过的，按 attr_id+search_query 索引
- 默认值（No Brand/Китай 等）：硬编码常量

### Rate limit 实测
- 连续调 50+ 次 SSL 被强迫断（10054），需 `time.sleep(0.5)` 节流
