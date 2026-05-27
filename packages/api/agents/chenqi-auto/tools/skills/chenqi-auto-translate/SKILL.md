---
name: chenqi-auto-translate
description: 辰启-自动翻译 v0.2。从飞书「商品全生命周期」表 T_TODO 行中按 1688商品ID 聚合 1 个 SPU，整组迁移 T_DOING；两阶段 LLM（phase1 看 top3 类目骨架选 1 个 → phase2 拉对应字典填必填+加分项属性）；agent 输出俄语标题/描述/属性 JSON；finalize 入库 T_DONE 或 T_FAILED；SEO 缓存缺失时自动通过 browser sub-agent 爬 Ozon 预热。每次会话只跑 1 个 SPU（含 1~10 个 SKU 子行）。v0.2 解决 v0.1 两个问题：(1) 类目错位（BM25 词根歧义把音箱召到车载音响）；(2) 加分项被丢弃（一个类目应有 20-30 属性，v0.1 只填必填，丢搜索曝光）。当用户说「执行辰启-自动翻译」「跑下一个翻译」「翻译 T_TODO」「auto-translate」时触发。前置：(1) chenqi-lark-setup 已跑过且 base_info.json 存在；(2) chenqi-auto-collect 已写入 ≥1 条 T_TODO 翻译记录；(3) Python 3.10+；(4) lark-cli 当前账号绑定。
---

# 辰启-自动翻译 v0.2（双修：phase1 选类目 + phase2 填属性）

## 项目定位

把 chenqi-auto-collect 落进飞书「商品全生命周期」表的 T_TODO 行（中文标题/描述/材质/规格 + 调研关键词 + 1688商品ID + Ozon类目ID）翻译成 Ozon 俄语电商规范文案，并完成属性映射，结果回写飞书供下游核价/上架使用。

**1 SPU = 1 个 1688商品ID**（同 product_id 的多 SKU 子行共享商品文本，仅颜色/尺寸/重量/尺寸维度不同）。**1 次会话只跑 1 个 SPU**（多 SKU 共享回写）。

## 核心流程（cron 触发新会话后 agent 自动执行）

v0.2 把 v0.1 的 6 步扩到 7 步，关键改动是把 1 次 LLM 拆成 2 次：

```
1. prepare --phase 1     → 锁 SPU + top3 类目骨架（不展开 options）→ phase1_prompts.jsonl
   └ 若 SEO 池空         → 看 NEED_SEO_WARMUP 信号 → Step 1.5 SEO 自动预热分支
2a. agent 读 phase1_prompts.jsonl → 输出 category_choice → category_choice.jsonl
2b. prepare --phase 2 --chosen-cat-id X --chosen-type-id Y --reuse-batch-id Z --include-doing
                         → 拉选中类目的完整属性字典(必填+加分项)→ phase2_prompts.jsonl
3. agent 读 phase2_prompts.jsonl → 输出完整翻译 JSON → outputs.jsonl
4. finalize.py           → parse_and_finalize → quality_check → 飞书 T_DONE / T_FAILED
```

每个 batch 落在 `batch/<batch_id>/`，phase1 / phase2 共享同一 batch_id（用 `--reuse-batch-id` 复用）。

## 字段约定

- **1 行 = 1 SKU**（不是 1 SPU），primary key = `SKU编号`
- 同 SPU 多 SKU 靠 `1688商品ID` 聚合
- SPU 共享字段（取首行）：`中文商品名 / 中文详情描述 / 材质 / 一级类目 / 类目路径`
- SKU 维度字段（不送 LLM，仅落 meta）：`规格-颜色 / 规格-尺码 / 重量(g) / 长(cm) / 宽(cm) / 高(cm)`
- 关键输入信号：`调研关键词`（品类匹配核心信号，重要！）

回写的共享字段（finalize 全 SKU 同写）：
- `俄语标题 / 俄语描述 / Ozon类目ID / 类目路径 / 一级类目`
- `俄语属性JSON / 命中SEO词 / 命中术语`
- `翻译状态`（T_DONE / T_FAILED）

失败时另写：`最近失败原因 / 最近失败阶段 / 最近失败时间 / 失败次数`，并写「失败事件流水」表（每 SKU 一行）。

## 标准执行步骤（agent 必须按顺序跑）

### Step 1: prepare phase=1（锁 SPU + 输出类目骨架）

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-auto-translate/scripts/prepare.py --phase 1
```

phase=1 的作用：
- 飞书锁 1 个 SPU 进 T_DOING
- 跑 BM25 类目召回 → 拿 top10 候选
- **只对 top3** 拉 ozon_attrs 算「必填属性数 / 加分项数 / 样本字段名」骨架信息（不展开 options，省时省 token）
- 输出 `phase1_prompts.jsonl` 让 LLM **只回答类目选择**

退出码：
- `0` → 成功落 batch（继续 Step 2a）
- `2` → T_TODO 已空（结束会话，cron 下次再跑）
- `1` → 异常（停止报错）

输出末尾必读：
- 必看 `BATCH_ID=T_<...>` ← 后续每个 step 都要传
- 必看末尾的 `[NEXT] LLM 读 phase1_prompts.jsonl ...` 模板，会给出下一步 prepare phase=2 的精确命令
- phase=1 **不会**触发 SEO 预热（SEO 在 phase=2 才需要）
- **必看是否出现 `NEED_EXPAND` warning** → 出现就进 Step 1.5

### Step 1.5: 类目扩词自动调用（仅当 prep 报 NEED_EXPAND 时）

phase=1 / phase=2 prep 都会触发。出现下列任一信号即必须执行：
- 终端 warning 含 `NEED_EXPAND: 类目扩词缓存未命中`
- `agent-core/skills/chenqi-auto-translate/cache/_pending_expand/` 目录下有 .json 文件

**1.5-1 列出所有待处理信号文件**：

```bash
ls agent-core/skills/chenqi-auto-translate/cache/_pending_expand/
```

**1.5-2 对每个信号文件依次处理**（一般 1 SPU 1 个）：

读信号文件全文：
```bash
cat agent-core/skills/chenqi-auto-translate/cache/_pending_expand/<SIGNAL_FILE>.json
```

文件结构：
```json
{
  "zh_title": "...",
  "zh_cat_path": "...",
  "zh_keywords": [...],
  "zh_extras": "...",
  "system_prompt": "<给 LLM 的 system>",
  "user_prompt": "<给 LLM 的 user>",
  "hint": "agent 流程提示"
}
```

**1.5-3 agent 直接用 system_prompt + user_prompt 调 LLM**（你自己，Accio 环境内置）。

要求 LLM 输出**严格 JSON 数组**（俄语关键词，4-8 个），形如：
```json
["портативная колонка", "беспроводная колонка", "Bluetooth динамик", "мини колонка"]
```

**重要约束**：
- ❌ 不要在扩词里塞**跨类目歧义高频词**（如 `ручка/палка/коробка/штука`）—— 会污染末段加权把召回拉到错类目
- ✅ 围绕**该商品真实品类的同义词/近义词/俄语电商常用词**，每个词尽量 1-3 个 token

**1.5-4 调 Python 把扩词写入缓存**（用 cqe.save_expansion）：

```bash
PYTHONIOENCODING=utf-8 python -c "
import sys
sys.path.insert(0, 'agent-core/skills/chenqi-auto-translate/lib')
import category_query_expander as cqe
import json
ru_keywords = json.loads('<LLM_OUTPUT_JSON>')  # 上一步 LLM 输出的数组
cqe.save_expansion(
    cache_dir='agent-core/skills/chenqi-auto-translate/cache',
    zh_title='<ZH_TITLE_FROM_SIGNAL>',
    zh_cat_path='<ZH_CAT_PATH_FROM_SIGNAL>',
    ru_keywords=ru_keywords,
    source='llm',
)
print('[OK] expansion saved')
"
```

**1.5-5 删除信号文件**：
```bash
rm agent-core/skills/chenqi-auto-translate/cache/_pending_expand/<SIGNAL_FILE>.json
```

**1.5-6 重跑 phase=1**（复用 batch_id + include-doing）：
```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-auto-translate/scripts/prepare.py \
  --phase 1 \
  --product-id <PRODUCT_ID> \
  --reuse-batch-id <BATCH_ID> \
  --include-doing
```

这次会从缓存读到扩词 → 类目召回更准 → top10 候选质量提升。重跑成功（无 NEED_EXPAND warning）后进 Step 2a。

**为什么强制走这步**：扩词显著提升小众类目召回准确率（俄语形容词阴阳性+复数变化导致原始 ru_title 命中率低）。跳过这步会导致选错类目，下游属性填错，最终 Ozon 拒收。

### Step 2a: agent 输出类目选择（phase1 LLM）

读 phase1 prompt：
```bash
cat agent-core/skills/chenqi-auto-translate/batch/<BATCH_ID>/phase1_prompts.jsonl
```

按 prompt 输出**单个 JSON**（无 markdown），仅含 category_choice：
```json
{"category_choice": {"cat_id": <int>, "type_id": <int>}, "rationale": "<1 句话简述选这个类目的原因>"}
```

写到 `batch/<BATCH_ID>/category_choice.jsonl`：
```json
{"row_id":"<product_id>","output":{"category_choice":{"cat_id":17028908,"type_id":95320},"rationale":"商品是便携蓝牙音箱，路径 Электроника/Акустика 最贴合，排除 BM25 把 колонк 误召的车载音响 91916"}}
```

**重要**：phase1 prompt 给的是 top3 骨架（cat_id+type_id+path+req_count+bonus_count+sample 字段名）。LLM 必须排除 BM25 噪声候选（如「便携音箱」误召的 `Колонки автомобильные` 车载音响、`Стойки садовые` 花园柱子、`Втулка рулевая` 自行车舵管）——这些路径明显与商品品类不符。仅当 top1 路径与品类高度吻合时才选 top1，否则按路径语义选 top2/3。

### Step 2b: prepare phase=2（用 LLM 选的类目展开完整属性）

读 Step 2a 的 LLM 输出拿到 `cat_id / type_id`，加上 `BATCH_ID` 和 `product_id`：

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-auto-translate/scripts/prepare.py \
  --phase 2 \
  --product-id <PRODUCT_ID> \
  --chosen-cat-id <X> \
  --chosen-type-id <Y> \
  --reuse-batch-id <BATCH_ID> \
  --include-doing
```

phase=2 的作用：
- 按 LLM 选的 cat_id+type_id 拉**该类目的完整属性字典**（必填 + 加分项 options 都展开）
- 加分项也跑 dict_value_picker 拉 options（约每属性 30 个）
- 重新生成 `phase2_prompts.jsonl`（同时落 `prompts.jsonl` 别名兼容 finalize）

输出末尾必看：
- `[NEED_SEO_WARMUP] cat_id=<X>` 字样 → 进 Step 2c「SEO 自动预热分支」（**仅 phase=2 触发**，因为只有 phase=2 才会查 SEO 池）
- 否则直接进 Step 3

### Step 2c: SEO 自动预热分支（仅当 phase=2 报 NEED_SEO_WARMUP 时）

读信号文件：
```
batch/<BATCH_ID>/seo_warmup_needed.json
```
拿到 `cat_id / candidate_zh_keywords[0] / type_name_ru`。

**2c-1 翻译关键词**：把 `candidate_zh_keywords[0]`（例「便携式蓝牙音箱」）翻译成 1 个 Ozon 俄语搜索词（例「портативная колонка»），尽量短、纯俄文小写。

**重要**：**永远以 `candidate_zh_keywords[0]` 的语义为准**（商品真实品类信号）。
- ❌ 不要用 `type_name_ru` —— 即使是 phase2 选中类目的名字，仍可能因为 LLM 也被噪声候选骗了而出错
- ✅ 直接翻译中文关键词的实际品类含义。例：「便携式蓝牙音箱」→「портативная колонка」/「保温杯」→「термокружка」/「电动牙刷」→「электрическая зубная щётка」

**2c-2 spawn browser sub-agent 爬 Ozon**：

```
sessions_spawn(agent_id="browser", task=<下面的任务串>)
```

任务模板（替换 `<RU_KEYWORD_URL>` 和 `<CAT_ID>`）：
```
爬 Ozon 俄罗斯站搜索结果标题用于 SEO 词池建设。

URL: https://www.ozon.ru/search/?text=<RU_KEYWORD_URL>&from_global=true

操作：
1. browser_navigate 到 URL
2. 等 5 秒（JS 加载）
3. browser_scroll 滚到页面底部 2-3 次（懒加载）
4. 注入 JS 文件 agent-core/skills/_chenqi_common/ozon_seo_extract.js 内容到 console 执行
5. 收集返回的 {url, count, titles, errors}

反爬：弹验证码 → 截图给我看，停止。某 URL 拿不到 → 报错返回，不要瞎编。

输出：把 titles 数组（俄文标题字符串，长度 ≥10）写到 agent-core/skills/chenqi-auto-translate/cache/ozon_seo_keywords/titles_<CAT_ID>.json。期望 30-80 条。

回报：拿到几条 / 是否触发反爬。不要执行 ingest（我接手）。
```

**2c-3 ingest**：

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-auto-translate/scripts/warmup_seo.py ingest <CAT_ID> "<RU_KEYWORD>" agent-core/skills/chenqi-auto-translate/cache/ozon_seo_keywords/titles_<CAT_ID>.json
```

预期输出 `ingested N titles -> M SEO keywords`。

**2c-4 重跑 phase=2**（**复用同 batch_id**，保持流程不分裂）：

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-auto-translate/scripts/prepare.py \
  --phase 2 \
  --product-id <ORIG_PRODUCT_ID> \
  --chosen-cat-id <X> --chosen-type-id <Y> \
  --reuse-batch-id <BATCH_ID> \
  --include-doing
```

这次 SEO 池非空，phase2_prompts.jsonl 会带上 SEO 词。

### Step 3: agent 输出完整翻译（phase2 LLM）

读 phase2 prompt：
```bash
cat agent-core/skills/chenqi-auto-translate/batch/<BATCH_ID>/phase2_prompts.jsonl
```

按 prompt 输出**单个 JSON 对象**（无 markdown 代码块），格式：
```json
{
  "category_choice": {"cat_id": <int>, "type_id": <int>},
  "title_ru": "<≤200 字符俄文标题>",
  "desc_ru": "<500-3000 字符俄文描述，正文+特色+用途+参数>",
  "material_ru": "<俄文材质>",
  "color_ru": "<俄文颜色>",
  "attr_values": {"<attr_id>": "<值>", ...},
  "seo_hits": ["<嵌入正文的俄文 SEO 词>", ...]
}
```

写到 `batch/<BATCH_ID>/outputs.jsonl`：
```json
{"row_id":"<product_id>","output":{<上面的 JSON 对象>}}
```

**质检要点**（避开 finalize 失败）：
- `category_choice` 必须与 Step 2a 的选择一致（finalize 会用这个值兜底拉 attrs）
- `attr_values` **必须包含必填+加分项全部 attr_id**（prompt 会列两段：必填属性 + 加分项属性）
  - 必填项不可为 null（缺字段 finalize 会判失败）
  - 加分项尽量按品类常识填，仅完全无法推断时才返回 null（蓝牙音箱常见加分项：是否带麦/防水等级/蓝牙版本/续航/输出功率）
  - 字典型属性必须从 options 选，不能自创字面值
- title 全俄文，**严禁出现** `Standard / Brand / plug-and-play` 等英文描述词
- 白名单的英文 token 可保留：`USB / HDMI / Bluetooth / Wi-Fi / WiFi / LED / OLED / QLED / NFC / GPS / SD / TF / FM / DC / AC / USB-C / TWS / Hi-Fi / RMS / Hz / mAh` 等
- 品牌词（来自 prompt 提示）可保留原拉丁字符
- desc 嵌入 ≥3 个 SEO 词

### Step 4: finalize

```bash
PYTHONIOENCODING=utf-8 python agent-core/skills/chenqi-auto-translate/scripts/finalize.py
```

不传 `--batch-id` 默认取最新 mtime batch。

退出码：
- `0` → 成功（飞书已写 T_DONE 或 T_FAILED）
- `1` → 脚本异常（停止报错）

输出末尾看 `status=T_DONE` 或 `status=T_FAILED`。**不论哪种，会话即结束**——失败留给下个 cron 周期人工 reset 或后续优化（v0.2 不做自动重试）。

## 失败处理原则

- T_FAILED 已落飞书 + 失败事件流水，agent **不要重试同 SPU 同 prompt**（同样 LLM 同样输入大概率同样失败）
- 翻译流程不耗任何 Ozon 配额（只读本地 cache，调本地 LLM）
- prepare exit 2 = T_TODO 空 = 正常退出
- browser sub-agent 拿不到标题 = SEO 暂时不可用 = 退出会话，等下次 cron 重试

## 实战常见坑

1. **`failed_codes` 双计**：finalize 拼失败原因时已自动 `failed_codes - fatal_codes`，不用手工
2. **品牌白名单不含 `Standard / Brand`**（这俩是描述词不是品牌），prompt 改用俄语版本号「Проводная версия / Беспроводная версия」
3. **lark `+record-get` SingleSelect 返回 list**（如 `['T_DONE']`），不是 string
4. **Ozon 类目页 95318 是杂货推荐位**——验证类目归属只信搜索页，不信类目页
5. **type 跨类目误匹配**（如音箱被 BM25 匹到「车载音响/花园水柱」）→ category_top10 含语义噪声是正常的，**v0.2 引入 phase1 LLM 选类目**专门解决这个问题
6. **v0.1 → v0.2 关键变化**：v0.1 prep 直接按 BM25 top1 拉字典，LLM 即使 rerank 选了 top5，**填的属性枚举值仍是 top1 类目的**——下游上架必被 Ozon 拒。v0.2 phase2 重跑 prep 拉对应类目字典，LLM 选什么类目就用什么字典
7. **加分项不要留空**：v0.1 默认 prep 只塞必填属性进 prompt，一个音箱类目 20-30 个属性只填 1 个，Ozon 卡片质量分丢光。v0.2 按决策 Q3 让 LLM 按品类常识填加分项
8. **batch_id 复用规则**：phase=1 → phase=2 → 重跑 phase=2（SEO 预热后）必须**全程复用同一个 batch_id**（用 `--reuse-batch-id`），保持流程单一不分裂
9. **多色 SPU 颜色字段**：v0.1 单色全行同写共享 color_ru；多色 SPU 暂用统一颜色写所有行（待后续迭代）
10. **emoji → GBK 错误**：所有 print/log 用 [OK]/[ERR]/[WARN]/[INFO]，不用 emoji
11. **LLM 输出文件名 = `outputs.jsonl`**（不是 `llm_responses.jsonl`），finalize.py L116 硬编码读 `outputs.jsonl`。Step 3 写文件时务必用对名字
12. **bonus_attrs_index 三处全链路**（v0.2 P1 修）：(a) `translator_prep.py` phase=2 写 `context.bonus_attrs_index = {id_str: entry}`；(b) `translator_apply._resolve_attr_values` 形参收 `bonus_attrs_index`、内部 `_lookup_entry()` 先查 deferred 再查 bonus；(c) `parse_and_finalize` 开头 step 0 兼容兜底——`prep['context']` 缺 `bonus_attrs_index` 时从 `prep['bonus_attrs']` 现场重建。任一处漏改 → bonus 全被判 "LLM 越权" 丢光
13. **phase1 BM25 top3 全噪声场景**（v0.2 P0 修）：BM25 命中同词根杂项（音箱-колонка 命中车载音响/水柱/舵管）时，prompt 必须给 LLM **top10 完整 path + 仅 top3 详细骨架**，明确允许从 top4-10 选。`translator_prep.build_phase1_prompt` 传完整 `category_top10`（不切 `[:skeleton_topk]`）；`PHASE1_SYSTEM_PROMPT` 写明「按路径语义不按 BM25 排序选」
14. **phase=1 + phase=2 全程复用 batch_id**：用 `--reuse-batch-id <batch_id> --include-doing` 在 SPU 已 T_DOING 时重跑（如 phase=1 修复后重跑、SEO 预热后重跑 phase=2）。一个 SPU 终生只占一个 batch 文件夹

## 文件清单

```
chenqi-auto-translate/
  SKILL.md
  lib/
    prompt.py           # 构造 LLM prompt
    translator_prep.py  # 类目召回 + SEO 检索 + 属性字典
    translator_apply.py # parse_and_finalize（LLM 输出 → 入库结构）
    quality_check.py    # quality_check_and_remediate
    attr_filler.py / dict_value_picker.py  # 属性字典工具
  scripts/
    prepare.py          # Step 1（含 SEO 预热信号）
    finalize.py         # Step 3
    warmup_seo.py       # SEO 词池管理
  cache/
    ozon_category_tree/RU.json
    ozon_category_attrs/<cat_id>.json
    ozon_dict_values/
    ozon_seo_keywords/<cat_id>.json + titles_<cat_id>.json
  batch/
    T_<YYYYMMDD_HHMMSS>_<product_id短>/
      phase1_prompts.jsonl    # Step 1 产出，Step 2a 读
      phase1_preps.pkl        # Step 1 产出（debug 用）
      phase1_meta.json        # Step 1 产出（骨架信息）
      category_choice.jsonl   # Step 2a LLM 输出（含 cat_id+type_id）
      phase2_prompts.jsonl    # Step 2b 产出，Step 3 读
      prompts.jsonl           # Step 2b 产出（phase2 别名，finalize 兼容）
      meta.json               # Step 2b 产出，Step 4 读（含 sku_record_ids）
      preps.pkl               # Step 2b 产出，Step 4 读（含 ozon_attrs_index）
      outputs.jsonl           # Step 3 产出，Step 4 读
      seo_warmup_needed.json  # 仅 phase=2 SEO 池空时存在
```

## 不适用场景

- 多 SPU 批量翻译（v0.1 设计就是 1 SPU/会话；批量靠 cron 每分钟触发或循环触发）
- 翻译重试（失败留给下周期）
- 非 1688→Ozon 翻译路径（prep 强依赖 Ozon 类目树缓存）
- 已 T_DONE 的 SPU 想强制重翻（需先在飞书把翻译状态改回 T_TODO）
