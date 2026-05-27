---
name: chenqi-image-process
description: 辰启-自动图片处理 v0.2。从飞书「商品全生命周期」表 I_TODO 行抢占 1 个 record，按 type_id 路由到 5 个 profile（electronics_audio 完整 + default_universal 完整 + electronics_small / home_textile / fashion_apparel 占位骨架），用 attr_values 精确数据 + LLM 提炼生动文案双源构建 8 张 Ozon 商品图的 prompt（俄文+主体保真锚定句+反幻觉禁令）。**v0.2 颜色保真**：reference_images 第一位放飞书「规格主图URL」作颜色锚点 + 多角度图组（总 ≤11 张），「规格-颜色」中文字段通过 COLOR_ZH2RU 查表转俄语（30+ 常见色含玫瑰金/香槟/沙漠金）灌入 prompt，解决同 SPU 多 SKU 颜色漂移问题。调 image_edit 一次性出 8 张 3:4 (900×1200)，把 Accio CDN URL 直接写飞书「主图1直链~主图8直链」（text 字段），状态置 I_DONE → 触发 L_TODO。每次会话只跑 1 个 record（image_edit 8 次串行）。当用户说「执行辰启-图片处理」「跑下一个图片」「图片 I_TODO」「auto-image」时触发。前置：(1) chenqi-lark-setup ≥v3.3.0 已跑过且 base_info.json 存在；(2) chenqi-auto-collect ≥v0.3.x 已写入 ≥1 条 I_TODO 图片记录（含「规格主图URL」+「规格-颜色」+「采集多角度图组URL」≥3 张 URL）；(3) Accio image_edit 工具可用；(4) Python 3.10+；(5) lark-cli 当前账号绑定。
---

# 辰启-自动图片处理 v0.2（profile 路由 + 双源文案 + 规格主图锚点 + 多角度参考）

## v0.2 更新（2026-05-18）

针对 v0.1 实战暴露的**颜色漂移问题**（同 SPU 多 SKU 不同颜色生成图出错）做 3 处定点优化：

| # | 改动 | 文件 | 解决的问题 |
|---|------|------|-----------|
| 1 | **规格主图作颜色锚点**：reference_images 第一位放飞书「规格主图URL」，后接多角度图组 | `scripts/preempt.py` + `scripts/gen_images.py` | image_edit 优先参考第一张图的色彩/材质，颜色还原准确 |
| 2 | **颜色直查飞书「规格-颜色」字段**：通过 COLOR_ZH2RU 中→俄查表（30+ 常见色含玫瑰金/香槟/沙漠金等），不再扫描俄语标题词根 | `lib/prompt_builder.py` + `scripts/prepare_prompts.py` | 标题不含颜色词时不再为空；不再扫到品牌名等噪声 |
| 3 | reference_images 数组上限 11（1 锚点 + 10 角度），≤ image_edit API 上限 14 | `scripts/gen_images.py` | 防止 1688 多角度图组超量导致 API 截断 |

**回退路径**：把 `reference_images` 列表手动改回 `gallery[:8]`、`color_zh` 参数传空字串即可回到 v0.1 行为。

**数据契约**（飞书「商品全生命周期」表字段，v0.2 新增依赖）：
- 「规格主图URL」（url 类型）：每个 SKU record 的彩色锚点图，由 chenqi-auto-collect ≥v0.3.x 写入
- 「规格-颜色」（text 类型）：中文颜色名（如「黑色」「玫瑰金」），同样由采集环节写入

---

# 辰启-自动图片处理 v0.1（profile 路由 + 双源文案 + 多角度参考）

## 项目定位

把 chenqi-auto-collect 落进飞书的 I_TODO 行（含「采集多角度图组URL」≥3 张 1688 主图 URL）转成 8 张 Ozon 上架规范图片（3:4 / 900×1200 / 俄文营销文案 / 主体 100% 保留），URL 写飞书供下游 chenqi-listing 上架使用。

**1 record = 1 张飞书行 = 1 个 SKU**（不是 SPU，因为不同 SKU 的颜色不同需要各自出图）。**1 次会话只跑 1 个 record**（image_edit 8 次串行 ≈ 4-6 分钟）。

## 核心流程（cron 触发新会话后 agent 自动执行）

7 步编排：

```
1. preempt              → 抢占 1 个 I_TODO record → I_DOING + 锁
                        → 输出 batch/<batch_id>/context.json（reference_images / attr_values / type_id 等）
2. route_profile        → 按 type_id 选 profile（5 选 1）→ context 加 profile_name
3. prepare_prompts      → 把 attr_values + 8 位置模板拼成 phase=prompts 阶段
                        → 输出 prompts.jsonl（每行 1 张图 = 1 个 prompt 任务）
                        → 信号：[NEED_LLM_FLAVOR] 表示要 agent 跑 LLM 生成生动文案
4. agent_llm_flavor     → agent 读 prompts.jsonl，对 8 张图各输出 1 段俄文文案 → flavor.jsonl
5. gen_images           → 串行调 image_edit 8 次（reference_images ≥3 张 + 3:4 + complex_generation）
                        → 输出 image_urls.json（8 个 Accio CDN URL）
                        → 失败可断点续跑（已成功的 idx 跳过）
6. finalize             → 写飞书「主图1直链~主图8直链」+ 图片状态=I_DONE → 触发 L_TODO=L_TODO
                        → 失败 → I_FAILED + 失败事件流水表 + 备注 JSON
```

每个 batch 落在 `batch/<batch_id>/`，batch_id 格式 `I_<record_id>_<YYYYMMDD_HHMMSS>`。

## 字段约定

**输入字段**（采集 + 翻译环节已写入）：
- 采集：`1688商品ID / 规格-颜色 / 中文商品名 / 采集多角度图组URL / 图片状态`
- 翻译：`俄语标题 / 俄语描述 / 俄语属性JSON / Ozon类目ID / 类目路径 / 一级类目`
- `采集多角度图组URL`（text 字段，JSON 数组字符串，存 ≥3 张 1688 主图 URL）
- `图片状态`（select，I_TODO 是触发信号）

**翻译前置依赖**：图片技能消费翻译产物（俄语标题/描述/Ozon类目ID）。如果某 record `Ozon类目ID` 为空 → 抢占后立刻打回 I_TODO 并退出（exit 4），等翻译技能补完再跑。

**回写字段**（图片技能写入）：
- `主图1直链 ~ 主图8直链`（**text** 类型，存 Accio CDN 公开 URL）
- `图片状态`（I_DOING → I_DONE / I_FAILED）
- `图片开始时间`（datetime，毫秒 int）
- `图片直链已验证`（checkbox）
- `失败次数 / 备注`（失败时写）
- `上架状态` = `L_TODO`（成功时点亮，触发 chenqi-listing）

**v0.1 不写**：`主图N预览`（attachment 类型，需先 file-upload 拿 token，v0.1 跳过——所有下游消费都基于 text URL）。

## 标准执行步骤（agent 必须按顺序跑）

### Step 1: preempt（抢占 1 个 I_TODO record）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-image-process/scripts/preempt.py
```

作用：
- 飞书全表扫 → 拿到所有 `图片状态=I_TODO` record
- 按 record_id 排序取首条 → upsert 改 `图片状态=I_DOING` + `图片开始时间=now`
- 读全部输入字段 → 落 `batch/<BATCH_ID>/context.json`

退出码：
- `0` → 成功 → 继续 Step 2
- `2` → I_TODO 已空 → 结束会话（cron 下次再跑）
- `4` → 翻译未完成（俄语字段空） → 已自动打回 I_TODO，等翻译跑完
- `1` → 异常 → 停止

输出末尾必看：
- `BATCH_ID=I_<...>` ← 后续每 step 都要传

### Step 2: route_profile（按 type_id 选 profile）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-image-process/scripts/route_profile.py --batch-id <BATCH_ID>
```

作用：读 `context.json` 里的 `cat_id`（飞书 `Ozon类目ID` 字段，**不是 type_id**——type_id 没回写飞书） → 查 `profiles/__init__.py` 的硬编码 cat_id 映射表 → 写 `context.json` 的 `profile_name` 字段。

5 个 profile：
| profile_name | 完成度 | 适用 cat_id 示例 |
|---|---|---|
| `electronics_audio` | **完整**（v0.1 标杆） | 17028908 蓝牙音箱 / 各类音箱耳机 |
| `electronics_small` | 占位骨架 | 充电器 / 数据线 / 小家电（v0.2 补） |
| `home_textile` | 占位骨架 | 床品 / 毛巾 / 抱枕（v0.2 补） |
| `fashion_apparel` | 占位骨架 | 服装 / 鞋帽（v0.2 补） |
| `default_universal` | **完整**（任意类目兜底） | 其他全部，含手机壳等 |

骨架 profile 直接走 `default_universal` 同款模板，仅占位等后续按需扩展。

### Step 3: prepare_prompts（拼 8 张图的 prompt 骨架）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-image-process/scripts/prepare_prompts.py --batch-id <BATCH_ID>
```

作用：按 profile 的 8 个位置模板，把 `attr_values`（精确数据，如 「Bluetooth 5.3 / 10W / 1200mAh」）+ profile 风格关键词（「深色氛围/大字/RGB」） 拼成 8 段 prompt 骨架，落 `prompts.jsonl`。

每行格式（8 行）：
```json
{"idx": 1, "position": "main_with_text", "skeleton": "<俄文 prompt 骨架>", "ref_count": 8, "needs_flavor": true}
```

输出末尾会有 `[NEED_LLM_FLAVOR]` 信号 → 进 Step 4。

### Step 4: agent_llm_flavor（agent 读 prompts.jsonl 输出生动文案）

读：
```bash
cat agent-core/skills/chenqi-image-process/batch/<BATCH_ID>/prompts.jsonl
```

每行带 `skeleton`（已含 attr_values 精确参数 + 位置语义指令）。agent 任务：**对每行的 `position` 输出一段 5-15 字的俄文营销标语 / 场景描述**（提炼商品的生动卖点），覆盖 8 个位置。

输出到 `batch/<BATCH_ID>/flavor.jsonl`：
```json
{"idx": 1, "flavor_ru": "Звук, который трогает сердце"}
{"idx": 2, "flavor_ru": "Идеальный спутник для дома"}
...
```

格式约束：
- 8 行（idx 1-8 全覆盖）
- `flavor_ru` 必须俄文 / 不超过 15 字 / 无 emoji / 无英文混用（除品牌名）
- 不要 markdown / 代码块 / 解释，只输出 jsonl

### Step 5: gen_images（串行调 image_edit 8 次）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-image-process/scripts/gen_images.py --batch-id <BATCH_ID>
```

作用：
- 读 `prompts.jsonl` + `flavor.jsonl` → 拼最终 prompt（skeleton + flavor + 主体保真锚定句 + 反幻觉禁令）
- 串行调 `image_edit` 8 次（reference_images = 全部多角度图 / aspect_ratio="3:4" / task_type="complex_generation"）
- 写 `image_urls.json`（idx → Accio CDN URL）
- 幂等：重跑跳过 `image_urls.json` 已有 idx

**注意**：image_edit 是 agent 工具不是 Python API。本脚本会输出每张图的「待执行 prompt」到 stdout，**让 agent 用 image_edit 工具调一次拿 URL，然后 agent 用 sessions_send 把 URL 喂回脚本**——或者更简单：
- v0.1 采用「**脚本 dry-run 输出 8 个 prompt + reference_images 列表 → agent 用 image_edit 8 次调 → 收集 8 URL 写到 image_urls.json → 再继续**」的半自动模式
- 详细 sub-step 见下方「Step 5 细节」

### Step 6: finalize（写飞书 + 触发下游）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-image-process/scripts/finalize.py --batch-id <BATCH_ID>
```

作用：
- 读 `image_urls.json`（必须 8 张全有）
- 飞书 record-upsert：写 `主图1直链~主图8直链` + `图片状态=I_DONE` + `图片直链已验证=true` + `上架状态=L_TODO`
- 失败兜底：缺张时 `图片状态=I_FAILED` + 写「失败事件流水」表 + 「备注」字段 JSON

退出码：
- `0` → I_DONE 成功
- `3` → I_FAILED（缺张/超时/工具报错）
- `1` → 异常

## Step 5 细节（半自动 image_edit 调用）

由于 image_edit 是 agent 工具不是 Python API，Step 5 拆成 3 个 sub-step：

### Step 5a: gen_images.py --dry-run（输出待执行任务清单）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-image-process/scripts/gen_images.py --batch-id <BATCH_ID> --dry-run
```

输出 stdout 8 行清单（每张图的最终 prompt + reference_images 列表）：
```
[TASK 1/8] position=main_with_text
  reference_images: ["https://cbu01.alicdn.com/...","..."]
  prompt: "<俄文最终 prompt>"
  aspect_ratio: 3:4
  task_type: complex_generation
[TASK 2/8] ...
```

### Step 5b: agent 调 image_edit 8 次

```python
image_edit(
    prompt="<TASK 1 prompt>",
    reference_images=["...","..."],
    aspect_ratio="3:4",
    task_type="complex_generation",
)
# → 返回 URL，如 https://cdn.accio.com/.../xxx.jpg
```

8 张可以**并行 4 张+串行 2 批**或**全串行**。失败的 idx 重试 1 次，仍失败留空跳到下一张。

把 8 个 URL 写到 `batch/<BATCH_ID>/image_urls.json`：
```json
{"1": "https://cdn.accio.com/...1.jpg", "2": "https://cdn.accio.com/...2.jpg", ...}
```

### Step 5c: gen_images.py --verify（校验 8 张全有）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-image-process/scripts/gen_images.py --batch-id <BATCH_ID> --verify
```

退出码：
- `0` → 8 张全有 → 进 Step 6 finalize
- `2` → 缺张 → agent 看 stderr 提示重补哪几张 idx，再回 Step 5b

## CDN 持久化策略

Accio image_edit 返回的 URL **是公网可访问的 CDN URL**（项目历史经验沉淀，见 MEMORY 教训 #17）。v0.1 直接写飞书 text 字段，**不做 OSS 二次保存**。

后续如果发现失效再加 OSS 兜底（v0.2 待办）。

## profile 设计文档

**electronics_audio**（蓝牙音箱标杆，沿用 ozon_visual_pattern.md）：

| idx | position | 内容 | 位置语义 |
|---|---|---|---|
| 1 | main_with_text | 主体正面 + 大字俄文卖点（深色氛围 + RGB） | 列表页转化器 |
| 2 | scene_home | 客厅书桌氛围场景（暖光氛围灯 + 木桌） | 家用代入感 |
| 3 | scene_outdoor | 户外露营场景（草地+夕阳+营地灯） | 便携属性 |
| 4 | multi_angle | 4 角度细节（正面+45 度+侧面按键+底部接口） | 看完整结构 |
| 5 | features_grid | 4 宫格特性（防水/续航/蓝牙 5.3/RGB） | 一图看尽 |
| 6 | spec_table | 俄文规格表（功率/续航/蓝牙/重量/防水） | 参数党 |
| 7 | accessories | 全配件平铺（音箱+充电线+说明书+礼盒） | 期待管理 |
| 8 | brand_promise | 品牌承诺（保修+正品+发货承诺） | 信任锁单 |

**default_universal**（兜底）：与 electronics_audio 同样 8 位置定义但「内容」改为通用商品语义（详见 `profiles/default_universal.py`）。

## 端到端测试约定

v0.1 自验：
1. **electronics_audio profile** → record `recvjfOd45Gfjf`（pid=656984749857，P6 蓝牙音箱）—— 翻译已完成可直接跑
2. ⏸ **default_universal profile** → record `recvjrUHUGcRWO`（pid=771439617715，黑色手机壳）—— 翻译未完成，v0.1 跳过；等翻译技能补完后下次跑

跑通验收（仅 audio profile）：
- ☑ 飞书 8 个直链字段全填
- ☑ Accio CDN URL 全部 200 OK
- ☑ 图片状态 = I_DONE
- ☑ 上架状态 = L_TODO（下游可见）
- ☑ 主体一致性人眼 ≥ 8/10（参考采集环节多角度图）

## 重大教训累积（沿用项目 MEMORY）

复用 chenqi-auto-translate / chenqi-auto-collect 的 lark-cli 调用范式 + `_chenqi_common` 公共模块。本技能新增教训留待 v0.1 跑通后沉淀。

## 文件结构

```
chenqi-image-process/
├── SKILL.md                              # 本文件
├── lib/
│   ├── state.py                          # 状态枚举
│   ├── lark_io.py                        # 飞书 IO 薄封装（复用 collect 的 _run）
│   ├── profile_router.py                 # type_id → profile_name 路由
│   ├── prompt_builder.py                 # attr_values + flavor → 最终 prompt
│   ├── image_gen.py                      # image_edit 调用包装（dry-run + verify）
│   └── ozon_visual_lib.py                # 8 位置 schema + 主体保真锚定句模板
├── profiles/
│   ├── __init__.py                       # 路由表
│   ├── electronics_audio.py              # 完整 profile
│   ├── default_universal.py              # 完整兜底
│   ├── electronics_small.py              # 占位骨架
│   ├── home_textile.py                   # 占位骨架
│   └── fashion_apparel.py                # 占位骨架
├── scripts/
│   ├── preempt.py                        # Step 1
│   ├── route_profile.py                  # Step 2
│   ├── prepare_prompts.py                # Step 3
│   ├── gen_images.py                     # Step 5（含 --dry-run / --verify）
│   └── finalize.py                       # Step 6
├── batch/<BATCH_ID>/
│   ├── context.json                      # Step 1 输出
│   ├── prompts.jsonl                     # Step 3 输出
│   ├── flavor.jsonl                      # Step 4 输出
│   └── image_urls.json                   # Step 5b 输出
├── cache/                                # （v0.1 暂留空，v0.2 用于 prompt 模板缓存）
└── research/                             # 调研报告（已有，不动）
```
