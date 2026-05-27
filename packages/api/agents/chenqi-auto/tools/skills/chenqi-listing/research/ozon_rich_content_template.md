# Ozon Rich Content (schema_v2) 调研报告

## 1. 核心参数确认
- **Attribute ID**: `11254` (富内容/Rich Content)。
- **JSON 版本**: 目前通用 `version: 0.2` 或直接以 `{"content": [...]}` 数组形式提交。Ozon 后台编辑器导出的格式默认为 schema_v2。
- **字符长度限制**: 
  - 普通文本描述 (Attribute 4191) 限制为 6000 字符。
  - **Rich Content (Attribute 11254)** 的 JSON 字符串长度限制通常为 **10,000 - 15,000 字符**（具体视商品类目而定，建议控制在 10k 以内以保证兼容性）。

## 2. 常用 Widget 列表及结构
| Widget 名称 | 用途 | 核心 JSON 子结构示例 |
| :--- | :--- | :--- |
| `raShowcaseChess` | 橱窗/大图 (支持单图或多图拼贴) | `{"blocks": [{"img": {"src": "URL"}}]}` |
| `raTextBlock` | 文本块 (支持标题、正文、列表) | `{"text": {"theme": "title", "content": ["文本"]}}` |
| `raTable` | 参数表格 | `{"title": "标题", "rows": [{"cells": [{"text": ["key"]}, {"text": ["val"]}]}]}` |
| `raTitleBlock` | 纯标题块 | `{"title": "标题内容", "size": "size7"}` |

## 3. 模板实现逻辑 (伪代码)
在 `build_payload` 阶段，通过字符串模板替换占位符生成最终 JSON。

```python
import json

def build_rich_content(data):
    # 1. 读取模板文件
    with open("rc_template.json", "r", encoding="utf-8") as f:
        template_str = f.read()
    
    # 2. 准备变量映射
    replacements = {
        "{{HEAD_IMG}}": data['head_img'],
        "{{TITLE}}": data['title'],
        "{{BULLET1}}": data['bullet1'],
        "{{BULLET2}}": data['bullet2'],
        "{{BULLET3}}": data['bullet3'],
        "{{IMG1}}": data['images'][0],
        # ... 循环处理 8 张详情图和参数表
    }
    
    # 3. 渲染模板
    for placeholder, value in replacements.items():
        template_str = template_str.replace(placeholder, value)
    
    # 4. 封装进 attribute_id=11254
    return {
        "complex_attributes": [],
        "attributes": [
            {
                "id": 11254,
                "values": [{"value": template_str}]
            }
        ]
    }
```

## 4. 注意事项
1. **图片地址**: 必须是 Ozon 认可的 CDN 地址或公网可访问的长久链接。
2. **俄语转义**: JSON 字符串中的俄语字符建议保持 UTF-8 或进行标准转义，避免乱码。
3. **嵌套限制**: `schema_v2` 不支持深层嵌套，所有组件应平铺在 `content` 数组中。
