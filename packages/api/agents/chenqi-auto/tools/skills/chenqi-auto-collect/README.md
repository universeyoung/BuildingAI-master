# 辰启-自动采集 (chenqi-auto-collect)

> v0.1 - 1688 详情页深度采集 + 主图去重扁平化 + 写回飞书 + 触发翻译

详细说明见 [SKILL.md](SKILL.md)。

## 快速上手

```bash
# 1. 环境自检
python scripts/setup_check.py
# → 8/8 [OK] 通过即可

# 2. 拉一批 C_TODO 处理（最常用）
python scripts/run.py poll --max 5
# → 串行处理最多 5 条 C_TODO

# 3. 单条调试模式
python scripts/run.py next --batch <id>
# → 输出商品 URL + EXTRACT_JS 脚本，让 sub-agent 抓取
python scripts/run.py feed --batch <id> --result feed.json
# → 喂回结果，自动加工写回飞书
```

## 主要文件

| 文件 | 作用 |
|---|---|
| `scripts/run.py` | 状态机主入口（poll/next/feed/status/list）|
| `scripts/setup_check.py` | 8 项前置检查 |
| `lib/crawler_detail.py` | 4 块 EXTRACT_JS（基础/SKU 维度/点击抓图/物理属性）|
| `lib/enricher.py` | 主图 hash 去重 + 上限 10 + 扁平化 |
| `lib/image_validator.py` | URL 清洗 + 三级校验 |
| `lib/ai_estimator.py` | 视觉指令模板（仅供下游核价复用，本环节不调） |
| `lib/parsers.py` | 单位标准化（g/cm/¥）|
| `lib/lark_io.py` | 飞书读写 |
| `config/collect_rules.yaml` | 间隔/重试/上限/选择器优先级 |

## 与上下游技能的契约

**上游契约（选品）**：
- 飞书表已存在 `采集状态=C_TODO` 的记录
- 必填字段：`SKU编号`、`1688商品ID`、`源链接`

**下游契约（翻译）**：
- 写回后同时点亮 3 个下游入口信号：`翻译状态=T_TODO` + `图片状态=I_TODO` + `核价状态=P_TODO`（三者并行）
- 翻译技能可读：`中文商品名`、`中文详情描述`、`材质`、`规格-颜色`、`规格-尺码`

## 设计原则

1. **抢占式状态机**：`C_TODO → C_DOING → C_DONE/C_FAILED`，多 Agent 并发安全
2. **主图去重扁平化**：1 商品 N SKU 按主图 hash 去重，最多 10 条
3. **失败立刻止血**：滑块/登录页直接降级，不重试不刷量
4. **本地 JSON 快照**：写飞书前先存 `output/sku_<offer_id>_<batch>.json`，可断点续跑
5. **复用选品技能模式**：状态机/CLI/lark_io 全对称，降低维护成本
