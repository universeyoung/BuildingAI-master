# Ozon Rich Content (attr 11254) 权威调试指南

> **文档版本**：v1.0  
> **验证日期**：2026-05-03  
> **验证账号**：辰启 Ozon 新店铺 Client `3900040`  
> **验证结果**：91/91 SKU 全部通过 Rich Content 校验，0 erased  
> **作者**：辰启-Ozon 自动化团队

---

## 1. 背景与问题

辰启项目自动上架 Ozon 商品时，`attribute_id=11254`（Rich Content / Описание Rich-контентом）属性始终被 Ozon 静默清空，错误描述：

```
erased_attribute_value: Rich-контент JSON не соответствует шаблону. 
Проверьте код в песочнице https://rich-content.ozon.ru/sandbox
```

历经 **5 个版本（v1-v5b）** 调试，所有看似合理的模板都被擦除，包括：
- `tileM` + `raShowcase` 多块组合
- `raShowcase` + `billboard` 单块循环
- 直接 copy 自 docs.ozon.ru 文档示例

直到 **v5c** 通过浏览器实时访问官方沙箱拿到默认示例 JSON 才彻底定位根因。

---

## 2. 根因总结（4 个致命错误）

| ❌ 错误写法 | ✅ 正确写法 | 后果 |
|---|---|---|
| 缺少根级 `"version": 0.3` | 必填 `"version": 0.3` | **直接判定为非法模板** |
| `"title": "字符串"` | `"title": {"items":[{"type":"text","content":"..."}]}` | 类型不符 schema |
| `"text": {"content": ["..."]}` | `"text": {"items":[{"type":"text","content":"..."}]}` | 同上 |
| 用 `width`/`height` 数值 | 用 `position`/`positionMobile` 枚举 | width/height 字段不在 schema |

> **关键认知**：Ozon 官方英文文档 (docs.ozon.ru/global/en/...) 给的示例 JSON **不完整且部分字段错误**，唯一的权威来源是 [https://rich-content.ozon.ru/sandbox](https://rich-content.ozon.ru/sandbox) 的实时校验器。

---

## 3. 权威 Schema (v0.3)

### 3.1 根节点

```json
{
  "content": [ /* widget 数组 */ ],
  "version": 0.3
}
```

- `content` 是 widget 数组（一个或多个）
- `version` **必填**，浮点数 `0.3`（不要写成字符串 `"0.3"`）

### 3.2 文本结构（title / text 通用）

**所有标题和正文都必须用 `items` 嵌套结构**，禁止用裸字符串：

```json
{
  "items": [
    {"type": "text", "content": "你的文本"}
  ],
  "size": "size4",
  "align": "left",
  "color": "color1"
}
```

| 字段 | 取值 | 含义 |
|---|---|---|
| `items[].type` | `"text"` | 唯一可用类型 |
| `items[].content` | string | 实际文本内容 |
| `size` | `size1` ~ `size5` | 字号（1=最大，5=最小，标题用 size4，正文 size2） |
| `align` | `left` / `center` / `right` | 对齐 |
| `color` | `color1` ~ `color7` | 颜色（color1=深色主文字） |

### 3.3 widget 类型清单（已验证可用）

| widgetName | type | 用途 |
|---|---|---|
| `raTextBlock` | — | 标题 + 正文段落 |
| `raShowcase` | `roll` | 多张图片轮播展示 |
| `raShowcase` | `billboard` | 单张大图通栏 |
| `list` | — | 项目符号 / 编号列表 |

### 3.4 raShowcase 图片块

```json
{
  "widgetName": "raShowcase",
  "type": "roll",
  "blocks": [
    {
      "imgLink": "",
      "img": {
        "src": "https://cdn.example.com/image.jpg",
        "srcMobile": "https://cdn.example.com/image.jpg",
        "alt": "",
        "position": "width_full",
        "positionMobile": "width_full"
      }
    }
  ]
}
```

**禁止字段**（用了会被擦）：
- ❌ `width` / `height` (数值)
- ❌ `widthMobile` / `heightMobile` (数值)

**必填字段**：
- ✅ `src` / `srcMobile`（HTTPS URL，建议用 Ozon 已托管的图，不接受 1688 原图）
- ✅ `position` / `positionMobile`（枚举）

`position` 可选值：
- `width_full`（通栏）
- `width_half`（半宽）
- `width_third`（三分之一）

### 3.5 list 项目列表

```json
{
  "widgetName": "list",
  "theme": "bullet",
  "blocks": [
    {
      "text": {
        "items": [{"type": "text", "content": "卖点 1"}],
        "size": "size2",
        "align": "left",
        "color": "color1"
      }
    }
  ]
}
```

`theme` 可选 `bullet`（圆点）/ `numeric`（数字编号）。

---

## 4. 完整可直接复用模板（辰启生产版）

下面是辰启项目实际投产并 100% 通过校验的三段式模板（标题 + 图片轮播 + 卖点列表）：

```json
{
  "content": [
    {
      "widgetName": "raTextBlock",
      "title": {
        "items": [{"type": "text", "content": "О товаре"}],
        "size": "size4",
        "align": "left",
        "color": "color1"
      },
      "text": {
        "items": [{"type": "text", "content": "Качественный товар по выгодной цене. Быстрая доставка из Китая."}],
        "size": "size2",
        "align": "left",
        "color": "color1"
      }
    },
    {
      "widgetName": "raShowcase",
      "type": "roll",
      "blocks": [
        {
          "imgLink": "",
          "img": {
            "src": "https://cdn1.ozone.ru/s3/multimedia-1-c/your-image-1.jpg",
            "srcMobile": "https://cdn1.ozone.ru/s3/multimedia-1-c/your-image-1.jpg",
            "alt": "",
            "position": "width_full",
            "positionMobile": "width_full"
          }
        },
        {
          "imgLink": "",
          "img": {
            "src": "https://cdn1.ozone.ru/s3/multimedia-1-c/your-image-2.jpg",
            "srcMobile": "https://cdn1.ozone.ru/s3/multimedia-1-c/your-image-2.jpg",
            "alt": "",
            "position": "width_full",
            "positionMobile": "width_full"
          }
        }
      ]
    },
    {
      "widgetName": "list",
      "theme": "bullet",
      "blocks": [
        {
          "text": {
            "items": [{"type": "text", "content": "Премиум качество и надёжность"}],
            "size": "size2",
            "align": "left",
            "color": "color1"
          }
        },
        {
          "text": {
            "items": [{"type": "text", "content": "Современный стильный дизайн"}],
            "size": "size2",
            "align": "left",
            "color": "color1"
          }
        },
        {
          "text": {
            "items": [{"type": "text", "content": "Удобство в использовании"}],
            "size": "size2",
            "align": "left",
            "color": "color1"
          }
        },
        {
          "text": {
            "items": [{"type": "text", "content": "Быстрая доставка по всей России"}],
            "size": "size2",
            "align": "left",
            "color": "color1"
          }
        }
      ]
    }
  ],
  "version": 0.3
}
```

---

## 5. 生产级 Python 实现

完整代码位于 [smart_listing_engine_v5.py](smart_listing_engine_v5.py) `build_rich_content()` 函数（约第 80-130 行）：

```python
import json

RICH_CAPTIONS = [
    ("Премиум качество", "Высококачественные материалы обеспечивают надёжность."),
    # ... 更多文案
]

def build_rich_content(images):
    """
    Ozon 官方沙箱权威模板 (rich-content.ozon.ru/sandbox 验证通过)
    
    布局: 1 个标题文本块 + N 张图片(raShowcase roll) + 末尾卖点列表
    """
    if not images:
        return ""
    
    widgets = []
    
    # 1. 头部标题块
    widgets.append({
        "widgetName": "raTextBlock",
        "title": {
            "items": [{"type": "text", "content": "О товаре"}],
            "size": "size4", "align": "left", "color": "color1"
        },
        "text": {
            "items": [{"type": "text", "content": "Качественный товар по выгодной цене. Быстрая доставка из Китая."}],
            "size": "size2", "align": "left", "color": "color1"
        }
    })
    
    # 2. 多张图片轮播
    valid_imgs = [u for u in images[:8] if u]
    if valid_imgs:
        widgets.append({
            "widgetName": "raShowcase",
            "type": "roll",
            "blocks": [{
                "imgLink": "",
                "img": {
                    "src": img,
                    "srcMobile": img,
                    "alt": "",
                    "position": "width_full",
                    "positionMobile": "width_full"
                }
            } for img in valid_imgs]
        })
    
    # 3. 卖点列表
    widgets.append({
        "widgetName": "list",
        "theme": "bullet",
        "blocks": [
            {"text": {"items": [{"type": "text", "content": txt}],
                      "size": "size2", "align": "left", "color": "color1"}}
            for txt in [
                "Премиум качество и надёжность",
                "Современный стильный дизайн",
                "Удобство в использовании",
                "Быстрая доставка по всей России",
            ]
        ]
    })
    
    # 关键: version 必填, 否则 100% 被擦
    return json.dumps({"content": widgets, "version": 0.3}, ensure_ascii=False)
```

### 5.1 提交到 Ozon API

```python
payload = {
    "attributes": [
        # ... 其他属性
        {
            "complex_id": 0,
            "id": 11254,  # Rich Content 属性 ID
            "values": [{"value": build_rich_content(images)}]
        }
    ],
    # ... 其他字段
}

# POST /v3/product/import
# Headers: Client-Id, Api-Key, Content-Type: application/json
# Body: {"items": [payload]}
```

### 5.2 校验是否被擦除

提交后调 `/v1/product/import/info` 拿 task_id 的处理结果：

```python
import urllib.request, json, time

time.sleep(15)  # 等 Ozon 异步处理
req = urllib.request.Request(
    'https://api-seller.ozon.ru/v1/product/import/info',
    data=json.dumps({'task_id': task_id}).encode(),
    headers={'Client-Id': '3900040', 'Api-Key': 'xxx', 'Content-Type': 'application/json'}
)
result = json.loads(urllib.request.urlopen(req).read())
errors = result['result']['items'][0].get('errors', [])

# 检查 attr 11254 是否在错误列表
rc_errs = [e for e in errors if e.get('attribute_id') == 11254]
if rc_errs:
    print(f"❌ Rich Content 被擦除: {rc_errs[0]['description']}")
else:
    print("✅ Rich Content 通过校验")
```

---

## 6. 调试工作流（推荐）

调试新模板时遵循以下流程：

```
1. 浏览器打开 https://rich-content.ozon.ru/sandbox (登录卖家账号)
   ↓
2. 把候选 JSON 粘贴到左侧编辑器
   ↓
3. 看右侧渲染区是否正常显示，沙箱是否报错
   ↓
4. 沙箱通过后，用单条 SKU 实测 (offer_id 加 _test 后缀)
   ↓
5. 等 15 秒后调 /v1/product/import/info 查 task_id
   ↓
6. 确认 errors 中无 attribute_id=11254 的项
   ↓
7. 通过后再批量推送
```

> **重要**：`web_fetch` 抓沙箱无效（页面是 SPA + 卖家登录态），必须用真实浏览器（推荐通过 sub-agent `browser` 操作）。

---

## 7. 常见错误与排查

| 错误现象 | 可能原因 | 排查方法 |
|---|---|---|
| `erased_attribute_value` 11254 | 缺 `version` 字段 | 检查根节点是否有 `"version": 0.3` |
| 同上 | title/text 是字符串 | 改成 `{"items":[{"type":"text","content":"..."}]}` |
| 同上 | img 用了 width/height | 删除数值字段，改用 position 枚举 |
| 图片不显示 | src 是 1688 原图 | 先把图上传到 Ozon CDN，或用其它公网 HTTPS |
| 沙箱通过但 API 还擦 | JSON 序列化时中文 escape | 用 `json.dumps(..., ensure_ascii=False)` |
| 提交后 status 一直 pending | Ozon 处理队列拥堵 | 等 30-60 秒再查 task_id |

---

## 8. 辰启项目实战数据

| 指标 | v4 / v5b（错误版） | v5c（正确版） |
|---|---|---|
| Rich Content 接受率 | **0/91 (0%)** | **91/91 (100%)** |
| 富内容渲染情况 | 全部空白 | 完整三段式呈现 |
| 商品 status | imported（但 RC 字段空） | imported + RC 完整 |
| Ozon 平均评分 | 7.5 | 8.5-9.5（预估，需 1-3 小时刷新） |

完整批次数据：
- 进度文件：[rollout_v5_progress.json](rollout_v5_progress.json)
- 校验结果：[rollout_v5c_verify_FINAL.json](rollout_v5c_verify_FINAL.json)
- 商品清单：[rollout_v5c_products.json](rollout_v5c_products.json)

---

## 9. 关键链接

- **Ozon Rich Content 沙箱**：[https://rich-content.ozon.ru/sandbox](https://rich-content.ozon.ru/sandbox) （唯一权威 schema 来源）
- **Ozon API 文档**：[https://api-seller.ozon.ru](https://api-seller.ozon.ru)
- **辰启 Ozon 飞书表**：[商品处理流](https://bcnkniiuopck.feishu.cn/base/RXe7bdI8zaVswvsJkHIc53JHn9d)
- **辰启 Ozon 避坑指南**：[辰启-Ozon全链路避坑指南.md](辰启-Ozon全链路避坑指南.md)

---

## 10. 维护说明

本指南基于 Rich Content schema **v0.3** 编写。Ozon 平台升级 schema 版本时（如 v0.4），需要：

1. 用浏览器访问沙箱获取新版默认示例
2. 对比字段差异，更新本文档第 3 节 schema 描述
3. 更新 [smart_listing_engine_v5.py](smart_listing_engine_v5.py) 中 `build_rich_content()` 函数
4. 用单条 SKU 实测验证后再批量推送

> 本文档已同步到长期记忆 [MEMORY.md](C:\Users\Administrator.DESKTOP-068VNB6\.accio\accounts\1758738633\agents\DID-F456DA-39F456DAU1777414-7512-899DD7\agent-core\MEMORY.md) §5，所有团队 Agent 自动加载。
