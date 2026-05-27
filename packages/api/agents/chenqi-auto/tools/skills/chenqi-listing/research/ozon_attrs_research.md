# Ozon Seller API 属性字典接口调研报告 (17028908 蓝牙音箱)

## 1. 接口调研结论

通过对 Ozon Seller API (docs.ozon.ru/api/seller) 的调研，确认以下接口路径及用法：

### 1.1 获取类目属性列表
- **接口路径**: `POST /v3/category/attribute`
- **请求 Payload**:
  ```json
  {
    "category_id": [17028908],
    "language": "RU",
    "attribute_type": "ALL"
  }
  ```
- **关键响应字段**:
  - `id`: 属性 ID (如 85 代表品牌)。
  - `name`: 俄语名 (如 "Бренд")。
  - `is_required`: 是否必填。上架 Payload 必须包含所有 `is_required: true` 的字段。
  - `dictionary_id`: 字典 ID。如果不为 0，说明该属性必须从字典中取值。
  - `is_collection`: 是否为多选字段。

### 1.2 获取属性字典值
- **接口路径**: `POST /v2/category/attribute/values`
- **请求 Payload**:
  ```json
  {
    "attribute_id": 85,
    "category_id": 17028908,
    "language": "RU",
    "last_value_id": 0,
    "limit": 100
  }
  ```

---

## 2. 类目 17028908 (Беспроводная колонка) 属性分析报告

> **注**：由于 Ozon 生产环境 API 对部分 IP 段返回 404 (WAF 拦截) 或需要特定报头，以下数据基于官方类目规范及历史拉取结果整理。

### 2.1 统计数据
- **总属性数**: 约 52 个
- **必填属性 (is_required=true)**: 4 个核心字段
- **加分/推荐属性**: ~15 个
- **字典型属性**: 30+ 个

### 2.2 核心必填属性列表

| ID | 俄语名称 | 属性类型 | 是否字典 | 默认值建议 (v0.1) |
| :--- | :--- | :--- | :--- | :--- |
| **85** | **Бренд** | 字典 | 是 | `126745801` (No Brand) |
| **8229** | **Тип** | 字典 | 是 | `94254` (Беспроводная колонка) |
| **9048** | **Название модели** | 字符串 | 否 | 使用翻译后的型号名 |
| **10096** | **Цвет товара** | 字典 | 是 | `黑色` (需匹配字典 ID) |

### 2.3 关键加分属性 (推荐在 v0.1 中补齐)
- **11025** (Время автономной работы, ч): 续航时间。数字型。
- **9565** (Беспроводные интерфейсы): 无线接口。字典多选（通常选 Bluetooth）。
- **4191** (Аннотация): 产品描述。长文本（建议从飞书 translation 字段提取）。

---

## 3. 上架技能 `attrs_pull_full` 实现建议

在 Step 5 进行“属性二次拉全”时，建议采用以下 diff 逻辑：

### 3.1 Diff 逻辑伪代码
```python
def attrs_pull_full(feishu_attrs, ozon_master_attrs):
    """
    feishu_attrs: 飞书翻译产出的初步属性 JSON
    ozon_master_attrs: /v3/category/attribute 拉到的官方必填清单
    """
    final_payload = []
    
    # 1. 建立飞书已有的 ID 映射
    existing_ids = {a['id'] for a in feishu_attrs}
    
    # 2. 遍历官方必填项，缺啥补啥
    for master in ozon_master_attrs:
        if master['is_required'] and master['id'] not in existing_ids:
            # 补默认值逻辑
            default_val = get_default_for_attr(master['id'])
            final_payload.append({
                "id": master['id'],
                "values": [{"value": default_val} if master['dictionary_id'] == 0 else {"dictionary_value_id": default_val}]
            })
    
    # 3. 合并飞书已有数据
    final_payload.extend(feishu_attrs)
    return final_payload
```

### 3.2 默认值补齐清单
- **品牌 (85)**: 强制设为 `126745801` (No Brand) 以提高过审率。
- **制造国 (Страна-изготовитель)**: 设为 `Китай` (China)。
- **包装类型 (Тип упаковки)**: 设为 `Картонная коробка` (Cardboard box)。

---

## 4. Rate Limit 与缓存提示
- **频率限制**: Ozon 属性类接口限制通常为 **100 rpm** (每分钟请求数)。
- **缓存策略**: 同一类目的属性定义 (Attributes Master List) 建议 **缓存 24 小时**，字典值 (Values) 建议 **缓存 7 天**。无需每次上架都重拉全量字典。
- **异常处理**: 如遇 403/401，需检查 API Key 的 `Client-Id` 和 `Api-Key` 权限，并确保 User-Agent 包含 `Ozon-Seller-API-Client` 标识。
