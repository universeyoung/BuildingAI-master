---
name: chenqi-product-sourcing
description: 辰启 v1.0 选品调研工作流（S_ 状态前缀）。从 1688 选出符合跨境上架条件的 SKU，按状态机规范写入飞书「商品全生命周期」表，并通过置 `采集状态=C_TODO` 触发下游采集环节。3 种触发模式：(1) cron 定时任务（自然语言提示词解析为关键词/数量/价格区间/品类排除/店铺链接 5 维参数）；(2) 用户手动指令；(3) 兜底专业市场调研（俄区趋势 + Ozon/WB热销榜 + 蓝海识别 + 1688跨境榜 4 路综合，24h 关键词池缓存）。爬虫走 Accio browser sub-agent 复用 Chrome 登录态，列表页提取 9 字段（商品ID/标题/链接/主图/价格/月销/店铺/店龄/起订量），详情字段留给采集环节。当用户说「执行辰启-选品」「开始选品」「跑 chenqi-product-sourcing」「选品调研」「按关键词选品」「按店铺链接选品」时触发。前置：(1) chenqi-lark-setup 已跑过且 output/base_info.json 存在；(2) Schema 版本必须匹配（v3.1.0+，含 9 个 S_ 状态字段）；(3) 当前账号 Chrome 已登录 1688；(4) Python 3.10+。不适用于：采集详情数据（用 chenqi-auto-collect）；阿里巴巴国际站选品（数据源仅 1688）。
version: 1.0.0
---

# 辰启-选品调研 Skill v1.0

跨境电商上架流水线的第 2 个技能（位于飞书建表协议层之后），负责"无中生有"——从零产出符合上架条件的候选 SKU。

## 何时使用

- cron 定时任务定期补给 SKU（推荐：每 20 分钟选 3 条）
- 用户临时手动选品（输入关键词或店铺链接）
- 用户给"开始选品"模糊指令时由 Agent 兜底调研

## 触发短语

- 执行辰启-选品 / 开始选品
- 选品调研 / 按关键词选品 / 按店铺链接选品
- 跑 chenqi-product-sourcing

---

## 输入：cron prompt 写法

Agent 用 LLM 把自然语言解析成 5 个结构化字段：

| 字段 | 类型 | 默认 | 示例提示词写法 |
|---|---|---|---|
| 关键词 | str \| None | None（触发兜底调研） | "夏季女装连衣裙" |
| 数量 | int | 3 | "选 5 条" |
| 价格区间(¥) | (min, max) \| None | None | "采购价 30-100" |
| 品类排除 | List[str] | [] | "不要电子产品和易碎品" |
| 店铺链接 | str \| None | None | "https://shop123.1688.com/" |

**完整提示词例**：
```
夏季女装连衣裙，选 5 条，采购价 30-100，不要电子产品和易碎品
```

**店铺模式优先级**：店铺链接 + 关键词同时给 → 在店铺内按关键词二次过滤（方案 ①）。

**模糊指令**：只说"开始选品"→ 进入兜底调研。

---

## 兜底调研（4 路综合）

仅在 cron prompt 既无关键词也无店铺链接时触发。

| 路径 | 数据源 | 工具 |
|---|---|---|
| 1. 俄区市场趋势 | 节日 / 季节 / 热点 | web_search |
| 2. Ozon / WB 热销榜 | ozon.ru/category/best, wildberries.ru/best | browser sub-agent |
| 3. 蓝海识别 | Ozon/WB 上 SKU 数 < 50 但销量稳定的细分 | browser sub-agent |
| 4. 1688 跨境榜 | 1688 跨境出口频道热销/新品 | web_fetch |

LLM 综合 4 路结果产出 10-20 个候选关键词，写入 `output/research_cache.json`，**24h 内有效**。每次跑从池中"未在 used_today 里"的随机抽 1 个。

---

## 数据源 + 爬虫

- **唯一数据源**：1688（不用阿里巴巴国际站）
- **方式**：spawn `browser` sub-agent 控制 Accio Chrome
- **登录态**：复用主 Chrome 已登录的 1688 cookie
- **滑块策略**：方案 A——出现滑块直接标记 `S_FAILED_CAPTCHA`，写入失败事件；整批触发滑块时下次 cron 延迟 1 小时

### 列表页提取 9 字段

| # | 字段 | 用途 |
|---|---|---|
| 1 | 1688商品ID | 去重唯一键 |
| 2 | 中文标题 | LLM 判断品类相关性 |
| 3 | 1688链接 | 给采集环节 |
| 4 | 主图URL | 给图片处理环节 |
| 5 | 价格区间 | 筛选 + 反推核价 |
| 6 | 月销量 | 热度判断 |
| 7 | 店铺名 + 店铺链接 | 店铺筛选 |
| 8 | 店龄(天) | 信誉判断 |
| 9 | 起订量 | 物流成本预估 |

详情字段（重量/尺寸/材质/规格主图/详情描述）**留给采集环节**——选品阶段拿不到也不强求。

---

## 过滤规则（config/filters.yaml）

| 规则 | 默认值 | 可被 cron prompt 覆盖 |
|---|---|---|
| 采购价上限(¥) | 150 | ✅ |
| 重量上限(kg) | 1.0 | ❌（列表页拿不到，跳过） |
| 月销下限 | 50 | ❌ |
| 店龄下限(天) | 30 | ❌ |
| 默认数量 | 3 | ✅ |
| 默认时间窗(分钟) | 20 | ✅ |
| 黑名单类目 | 16 项 | ✅（追加） |

### 默认黑名单 16 类（基于 Ozon 跨境官方禁售 + 国际物流通用禁运清单）

1. 食品 / 保健品（清关复杂 + 保质期）
2. 化妆品 / 护肤品（俄海关需 EAC 认证）
3. 药品 / 医疗器械
4. 婴幼儿用品（食品类 + 玩具，需 EAC + 安全认证）
5. 易碎品（玻璃 / 陶瓷，物流损坏率高）
6. 锂电池 / 充电宝（航空禁运）
7. 香水 / 含酒精液体（危险品）
8. 仿牌 / 品牌商品（知识产权）
9. 武器 / 仿真枪 / 刀具
10. 成人用品
11. 宗教用品
12. 实木家具 / 大件（体积超限）
13. 二手商品
14. 古董 / 文物（出口管制）
15. 活体动植物（检疫）
16. 烟草 / 电子烟

---

## 去重策略（方案 A+）

- 跑前一次性拉「商品全生命周期」表的 `1688商品ID` 列 → 内存 set
- 本批选品对比内存集合，匹配跳过
- 写入时无重复（不依赖飞书报错）
- **API 消耗：每批 ≤ 25 次**（拉去重列表 ~20 + 写入 ≤5 条）

---

## 状态机

```
S_TODO → S_DOING → S_DONE / S_FAILED
            ↓
       同时置 采集状态 = C_TODO  ⭐入口信号
```

每条 SKU 创建时立即写 `选品状态=S_DOING`，写完飞书后置 `S_DONE` + `C_TODO`。

---

## 主流程（4 步）

```powershell
# 1. 自检
python scripts/setup_check.py

# 2. 主入口（cron 或手动都从这里跑）
python scripts/run.py --prompt "夏季女装连衣裙，选 3 条"
# 或：
python scripts/run.py     # 进入兜底调研

# 3. 验证（可选）
python scripts/verify.py --batch <批次编号>
```

---

## 文件结构

```
chenqi-product-sourcing/
├── SKILL.md                      # 本文档
├── README.md
├── config/
│   ├── filters.yaml              # 过滤规则 + 黑名单 + 默认值
│   └── cron_prompt_examples.md   # cron 提示词写法范例
├── scripts/
│   ├── setup_check.py
│   ├── run.py                    # 主入口
│   └── verify.py
├── lib/
│   ├── lark_io.py                # 飞书读写
│   ├── prompt_parser.py          # cron prompt 解析
│   ├── research.py               # 兜底调研 + 缓存
│   ├── crawler_1688.py           # browser sub-agent 爬虫
│   ├── filter.py                 # 过滤规则应用
│   └── state_machine.py          # 状态机
└── output/
    ├── research_cache.json       # 关键词池（24h 滚动）
    └── runs/YYYYMMDD/HHMMSS.log
```

---

## 协议：与 chenqi-lark-setup 的握手

启动时**必须**：
1. 读 `../chenqi-lark-setup/output/base_info.json`（如不存在 → 报错"先跑 chenqi-lark-setup"）
2. 比对其中 `schema_version` ≥ `v3.1.0`（如不匹配 → 报错"schema 过期，重跑 chenqi-lark-setup"）
3. 比对 `fields_hash` 与本地预期 hash（如不一致 → 警告但允许继续）

---

## 故障排查

| 现象 | 原因 | 解法 |
|---|---|---|
| `base_info.json not found` | 没跑 chenqi-lark-setup | 先跑建表技能 |
| `schema version too old` | base 是 v3.0.0 没有 S_ 字段 | 升级 chenqi-lark-setup 到 v3.1.0 重建/扩字段 |
| `1688 滑块验证` | 反爬 | 标记 SOURCING_CAPTCHA，下次 cron 延迟 1h |
| `兜底调研无关键词` | 4 路调研全失败 | 检查 web_search 配额；填充 fallback 关键词池 |
| `店铺链接打不开` | 店铺已下线/链接错 | 标记 SOURCING_SHOP_LINK_INVALID，跳过 |
| `搜不到结果` | 关键词太冷门 | 标记 SOURCING_NO_RESULT，从池中换词 |

---

## 不适用场景

- **采集商品详情**：用 `chenqi-auto-collect`
- **阿里巴巴国际站选品**：本技能数据源仅 1688
- **批量补录历史 SKU**：本技能产出新 SKU，不用于回填
