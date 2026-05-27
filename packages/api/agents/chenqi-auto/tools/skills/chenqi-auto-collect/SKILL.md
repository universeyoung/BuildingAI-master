---
name: chenqi-auto-collect
description: 辰启-自动采集 v0.3.1。从 1688 详情页深度采集商品字段并写回飞书多维表，C_DONE 时同时点亮 3 个下游入口信号（翻译 T_TODO / 图片 I_TODO / 核价 P_TODO，三者并行）。核心特性：(1)消费选品技能写入的 C_TODO 入口信号；(2)抢占式状态机 C_TODO→C_DOING→C_DONE/C_FAILED 防重；(3)主图 URL 去重的智能扁平化（不靠规格名维度，按主图 hash 去重，1 商品最多 10 条 SKU）；(4)主图三级校验（清洗缩略后缀+可达性+尺寸≥600）；(5)重量/尺寸优先取「商品件重尺」表（按 SKU 颜色分行的物流强制填写数据，强可信），fallback 用「商品属性」表 + 单位智能推断（无单位且数值>50 自动÷10），仍缺失则留 None 给下游核价做视觉估算（v0.2 删除瞎填的类目规则路径）；(6)1688 反爬友好（串行 60s 间隔+复用 Chrome 登录态+滑块即降级）；(7)失败事件流水+本地 JSON 快照。当用户说「执行辰启-自动采集」「开始采集商品」「采集 C_TODO」「跑下一批采集」时触发。前置：(1) chenqi-lark-setup 已跑过且 base_info.json 存在；(2) 选品技能已写入 ≥1 条 C_TODO 记录；(3) 当前账号 Chrome 已登录 1688；(4) Python 3.10+。
---

# 辰启-自动采集 (chenqi-auto-collect) v0.3.1

## 一、定位

**消费 `采集状态=C_TODO` 的 SKU，从 1688 详情页深度采集 → 主图去重扁平化 → 写回飞书 → 触发下游翻译**

- 上游：选品技能（chenqi-product-sourcing）写入并置 `采集状态=C_TODO`
- 下游：写完后**同时**点亮 3 个入口信号（互不依赖，并行触发）：
  - `翻译状态=T_TODO` → chenqi-auto-translate
  - `图片状态=I_TODO` → chenqi-image-process
  - `核价状态=P_TODO` → chenqi-pricing（None 字段由其自跑视觉兜底）

## 二、状态流转

```
飞书表某 SKU：选品状态=S_DONE，采集状态=C_TODO
        ↓ run.py poll
   抢占：C_TODO → C_DOING（防重）+ 写「采集开始时间」
         ↓ run.py next
    输出：商品 URL + 2 步 JS 指令（v0.3 精简：4 步 → 2 步）
         ↓ Agent spawn browser（按顺序在同 tab 跑 2 步 JS）
        ↓ run.py feed --result <json>
   解析：
     ├─ enricher 主图去重（hash） + 上限 10 条
     ├─ parsers 单位标准化（g/cm/¥）
     ├─ image_validator 校验主图（清洗+可达+尺寸）
     ├─ ai_estimator 重量/尺寸缺失兜底
     └─ lark_io 改写原行第 1 条 SKU + 新增 N-1 条
        ↓
   原行：采集状态=C_DONE + 翻译状态=T_TODO + 图片状态=I_TODO + 核价状态=P_TODO
   新增行：同上 4 个状态字段（继承所有上游字段）
        ↓ sleep 60s
        ↓ 下一条
```

**失败终态**：`采集状态=C_FAILED` + 写「失败事件流水」表 + 写「最近失败原因/时间/阶段」字段

## 三、CLI 入口

```bash
# 主命令（5 个子命令对称选品技能）
python scripts/run.py poll                        # 拉取所有 C_TODO，串行处理；批次失败立刻止血
python scripts/run.py next --batch <id>           # 取下一条 SKU，输出 URL + JS 脚本
python scripts/run.py feed --batch <id> --result <json_file>  # 喂回 sub-agent 抓取结果
python scripts/run.py status --batch <id>        # 查看批次状态
python scripts/run.py list                        # 列所有批次
```

## 四、2 步 EXTRACT_JS（v0.3 精简，详情页抓取）

| # | 脚本 | 抓取目标 | 兜底 |
|---|---|---|---|
| 1 | **extract_3in1.js** （v0.3 合并段，约 17KB）| 一发 4 段：basics（标题/描述/商品 ID）+ sku_dims（维度+SKU 列表+按钮 price_in_dom）+ attrs（属性表）+ main_gallery（主图轮播 ≤8 张大图 URL）| 描述空→截断标题 200 字；无 SKU→单 SKU 模式；attrs 缺失→留空给下游核价 |
| 2 | **click_one_sku.js** + **grab_main_image.js** + **grab_sku_price.js** （click_loop 循环执行，每 SKU 1 轮）| 切换 SKU → 抓主图 URL（用于按 hash 去重）+ 实时价（兜底）| 单 SKU click 失败重试 1 次→ skip |

**为什么 4 步压成 2 步**（教训 #11、#19、#20）：
1. 减少 sub-agent 多次 console+read 复读：原 4 块 JS = 4 次 evaluate + 4 次 read 工具调用 = sub-agent 上下文炸裂
2. v0.3 改进：basics/sku_dims/attrs/main_gallery 4 段都是页面静态 DOM，可以一次 IIFE 抓完返回单 dict
3. click_loop 必须独立：要真实点击切 SKU 后等 DOM settle 再抓，物理上无法和静态 extract 合并

**SKU 价格双源**（教训 #21）：
- **主源 = `extract_3in1.sku_dims.options[].price_in_dom`** ← SKU 按钮自带角标（静态 DOM，跟着 SKU 走，最稳）
- **兜底 = `grab_sku_price.js` 抓 `#mainPrice`** ← 1688 改版后该区域不再随 SKU 切换刷新（只显示 SPU 起始价），仅当 dom 路径无值时使用
- enricher.py:_resolve_price 三级回退顺序为 dom → click → ladder

**主图 8 张轮播**（v0.3）：
- `extract_3in1.main_gallery.urls` 直接抓页面顶部主图轮播组（不靠 click，不靠 SKU），最多 8 张大图
- 写入飞书「采集多角度图组URL」JSON 数组字段，给 chenqi-image-process 当 reference_images 用

## 五、主图去重扁平化（核心算法）

```
输入：所有 SKU 维度组合（可能 30 个）
       例：颜色5 × 尺码6 = 30 SKU

  1. 遍历 SKU → 点击 → 抓主图 URL
  2. URL 清洗（去 _60x60/_sum/_.webp 等缩略后缀，去 query 参数）
  3. 按清洗后 URL 做 hash 去重
       → 5 个独立颜色 × 6 个尺码 = 5 张主图（颜色变图，尺码不变图）
  4. 每张唯一主图保留 1 个代表 SKU（取维度组合中第 1 个）
  5. 数量上限：≤10 全保留；>10 截断前 10 + 写日志
```

去重判据是**主图 URL hash**，不是规格名。这是 v0.1 的核心创新。

## 六、主图三级校验

| 级别 | 检查 | 不通过处理 |
|---|---|---|
| L1 协议清洗 | 去缩略后缀（`_sum.jpg/_60x60.jpg/_.webp/_.heic`、`?x-oss-process=...`）| - |
| L2 可达性 | HEAD 请求返回 200 + Content-Length > 5KB | 重试 1 次 → 仍 fail 标 IMAGE_UNREACHABLE |
| L3 尺寸 | 下载头部 8KB parse 出 width >= 600 | 标 IMAGE_THUMBNAIL |

任意一级失败 → 整个商品 `采集状态=C_FAILED` + 写失败事件流水（图片是下游生图锚点，不能将就）。

## 七、重量/尺寸字段优先级（v0.2 5c 重大变更）

```
1. pack.by_color[匹配颜色]    强可信  ← 「商品件重尺」物流强制填
2. pack.default                中可信  ← pack 表第一行
3. attrs + 单位智能推断        弱可信  ← 「商品属性」商家自填
                                       无单位且数值>50 自动÷10
                                       （解决 86 写成 8.6 的漏小数点问题）
4. 留 None 写飞书              ← 下游核价（chenqi-pricing）做视觉估算
```

**已删除路径（v0.2 5c）：**
- ❌ `apply_category_rules` —— 关键词查表瞎填（蓝牙音箱=500g 那种）
- ❌ `apply_default_fallback` —— yaml default 瞎填
- ❌ `config/category_rules.yaml` 文件本身（防止新设备复用时复活）

**视觉估算的归宿（5c-2 端到端验证后再次锁定）：**
本采集环节**绝不**调视觉。`estimate_missing()` 永远返回 `needs_vision=False / vision_instruction=None`，
重量/尺寸缺失就让飞书空着，`采集状态=C_DONE` 照常写完；
3 个下游状态（翻译/图片/核价）一起点亮 *_TODO，由各自的下游技能并行消费。

后续 **chenqi-pricing（核价）** 模块自行扫描飞书 `重量(g)/长(cm)/宽(cm)/高(cm)` 为 None 的行，
调用本模块导出的 `ai_estimator.make_vision_instruction` + `consume_vision_result` 模板做视觉估算。
理由：核价是物流费计算的临界点，视觉决策权放那里——
- 采集只填 deterministic 数据（pack 抓到 / attrs 单位推断），保持快速 & 可重跑
- 模糊估算的成本和决策权都在核价，避免重复视觉调用

## 八、反爬策略

| 项 | 设置 |
|---|---|
| 单 SKU 间隔 | 60s |
| 详情页等待 | 关键 DOM 元素出现（不固定 sleep）+ 5s 上限 |
| 选项点击后等待 | 1-2s（图片刷新）|
| 失败重试 | 2 次（10s/30s 指数退避）|
| 滑块/登录页 | 立即降级 C_FAILED + 不重试（避免被打更狠）|
| 登录态 | 复用 Chrome（sub-agent 自动继承）|

## 八-bis、Sub-agent 输出契约（**必读**，避免静默错误）

`run.py next` 输出的 agent_text 给 sub-agent (browser) 看，sub-agent 跑完 2 步 JS 后必须把结果保存为 JSON 文件喂给 `run.py feed --raw <file>`。

### 输出 JSON 必须严格遵守的 schema

```json
{
  "record_id": "recXXX",
  "captured_at": "<ISO 时间戳>",
  "basics":      { ...extract_3in1.basics 段原样...   },
  "sku_dims":    { ...extract_3in1.sku_dims 段原样... },
  "attrs":       { ...extract_3in1.attrs 段原样...    },
  "main_gallery":{ "ok":true, "urls":[...], "count":N, "meta":{...} },
  "click_loop": [
    {
      "opt_text": "黑色",
      "dim_id": 0, "opt_id": 0,
      "click_ok": true,
      "main_image": { ...grab_main_image.js 完整 dict 平铺... },
      "sku_price":  { ...grab_sku_price.js 完整 dict 平铺... }
    }
  ]
}
```

### 关键纪律（sub-agent 偷懒的 3 个常见坑）

| 错误模式 | 危害 | 正确做法 |
|---|---|---|
| 把 step1 (`extract_3in1`) 的返回包一层 `{"extract_3in1": {...}}` | enricher 找不到 basics/sku_dims/attrs/main_gallery 全 None | **平铺到顶层**，4 个 key 直接放最外层 |
| 把 grab_main_image.js 的返回只摘 `image_url` 字段进 `main_image: "url..."` | enricher 期望 dict（含 candidates 等兜底字段）→ TypeError | **完整 dict 平铺**，不要只摘子字段 |
| 把 grab_sku_price.js 的返回只摘 `price_text + ladder_text` 进 `sku_price` | 教训 #21 真实坑：`price/ok/source/all_numbers/debug` 全丢，无法看清 grab_sku_price 实际返回什么 → 排查极困难 | **完整 dict 平铺**，所有 ok/price/source/all_numbers/debug/root_text_preview 字段全保留 |

**核心原则**：**只要 JS 函数返回的就完整平铺**——sub-agent 不要做字段裁剪。enricher 自己会按需读取，多写不会出错，少写会让排查变成考古。

### 单步 console 输出过大的处理

`browser_evaluate_javascript` 默认会把返回值通过 console 串回来。如果 extract_3in1 这种返回 30KB+ 的脚本：
- ❌ 不要再 `console.log(result)` 多打一遍（双倍上下文炸裂）
- ✅ 用 `var r = ...; r` 让 evaluate 直接返回 result，sub-agent 收到后直接写入 JSON 文件再 read 回来读，不要把 30KB JSON 内联到对话上下文

## 九、目录结构

```
chenqi-auto-collect/
├── SKILL.md                     ← 本文件
├── README.md                    ← 开发者快速上手
├── config/
│   └── collect_rules.yaml       ← 间隔/重试/上限10/选择器优先级
│   # category_rules.yaml 已在 v0.2 (5c) 删除（瞎填路径）
├── references/
│   ├── category-rules.md        ← 原始文档保留
│   └── v24.2_legacy_SKILL.md    ← v24.2 设计文档（参考）
├── scripts/
│   ├── setup_check.py           ← 环境自检 8 项
│   └── run.py                   ⭐ 状态机 CLI
└── lib/
    ├── lark_io.py               ← 飞书读写（采集字段映射 + 失败码降级）
    ├── crawler_detail.py        ⭐ 2 步 EXTRACT_JS 编排（v0.3 4→2 步精简）
    ├── parsers.py               ← 单位标准化（g/cm/¥）
    ├── enricher.py              ⭐ 主图去重 + 上限10 + 扁平化
    ├── image_validator.py       ← URL 清洗 + 三级校验
    └── ai_estimator.py          ← 视觉指令模板（仅供下游核价复用，本环节不调）
```

## 十、调用前置

1. `chenqi-lark-setup` 已跑过 → `output/base_info.json` 存在
2. 选品已写入 ≥1 条 `采集状态=C_TODO` 记录
3. 当前账号 Chrome 已登录 1688（cookie 复用到 sub-agent）
4. lark-cli 在 PATH

跑 `scripts/setup_check.py`，8/8 通过即可开干。

## 十一、不适用场景

- ❌ 非 1688 商品采集（Taobao/Tmall/AliExpress 选择器不同）
- ❌ 直接绕过状态机批量插入（破坏抢占式语义，可能重复处理）
- ❌ 单条 SKU > 10 维度组合的强制全采集（用上限 10 保护）

## 十二、版本

- **v0.3.1** - 2026-05-13 - **价格 selector 漂移修复**（教训 #21）：1688 改版后 `#mainPrice` 主价区不再随 SKU 切换刷新，`_resolve_price` 三级回退顺序反转为 dom→click→ladder；enricher 兼容 `image_url`/`url` 两种 key
- **v0.3** - 2026-05-13 - **build_instructions 4 步压成 2 步**：extract_3in1（basics+sku_dims+attrs+main_gallery 一发完成）+ click_loop；新增 sub-agent 输出契约章；agent_text 短一半
- **v0.2 (5c-3)** - 2026-05-12 - C_DONE 时同时点亮 T_TODO/I_TODO/P_TODO 3 个下游入口；删 category_rules 瞎填路径；估算决策权移交核价
- **v0.1** - 2026-05-11 - 重写自 v24.2，对齐飞书 v3.1.0 schema，主图去重扁平化为核心创新
