---
name: chenqi-pricing
description: |
  辰启-自动核价 v0.1。从飞书「商品全生命周期」表 P_TODO 行抢占 1 个 record，
  按 GUOO 5 组 + CEL 4 组共 9 组物流定价表全比价取最便宜，结合 Ozon 类目佣金率
  + 末端配送 4% + 收单 2% + 缓冲 5% + 广告 8% + 服务费 2% + 利润目标 50% 反推合规售价。
  缺 weight/dims 时通过 agent 调 see_image 视觉估算（输入：规格主图URL + 采集多角度图组URL 前 5 张共 6 图），
  confidence ≥ 0.6 自动补齐并写飞书 [VISION_EST] 标记，否则 P_FAILED PRICE_MISSING_INPUT。
  写飞书 8 字段（售价/利润/利润率/Ozon佣金/末端配送费/总成本/物流明细/目标售价）
  + 状态置 P_DONE → 触发下游上架 L_TODO；
  公式失败（倍率>15x / 利润<0 / 物流>45% / 总扣率>95%）打 P_FAILED 对应枚举。
  当用户说「执行辰启-自动核价」「跑下一个核价」「核价 P_TODO」「auto-pricing」时触发。
  前置：(1) chenqi-lark-setup ≥v3.3.0 已跑且 base_info.json 存在；
  (2) chenqi-auto-collect 已写入 ≥1 条 P_TODO；
  (3) Python 3.12+ + lark-cli 当前账号已绑定。
license: Internal
---

# 辰启-自动核价 v0.1

## 何时触发

- 「执行辰启-自动核价」/「跑下一个核价」/「核价 P_TODO」/「auto-pricing」
- 上游 `chenqi-auto-collect` C_DONE 时同步写 `核价状态=P_TODO`，本技能负责消费

每次会话只跑 **1 个 P_TODO record**（含 LLM 决策 / 视觉降级时不超过 5 步串行）。

## 输入字段（13 字段，从飞书读）

| 字段名 | 说明 |
|---|---|
| `1688商品ID` | SPU id（用于日志） |
| `规格-颜色` `规格-尺码` | SKU 维度 |
| `俄语标题` | 用作视觉 prompt 上下文 |
| `Ozon类目ID` | 决定佣金率 |
| `采购价(¥)` | 必填 |
| `国内运费(¥)` | 必填，默认 0 |
| `重量(g)` | 缺则触发视觉 |
| `长(cm)` `宽(cm)` `高(cm)` | 任一缺则触发视觉 |
| `规格主图URL` | 视觉源图 1 |
| `采集多角度图组URL` | JSON 数组字符串，视觉源图 2~6（取前 5 张） |

## 输出字段（8 字段 + 4 状态）

| 字段名 | 说明 |
|---|---|
| `售价(¥)` | 反推所得人民币售价（Ozon 跨境店 CNY 结算） |
| `利润(¥)` | 售价 × profit_target |
| `利润率(%)` | profit_target × 100 |
| `Ozon佣金(¥)` | 售价 × commission_rate |
| `末端配送费(¥)` | 售价 × 0.04 |
| `总成本(¥)` | 利润相对面（fixed_cost + 各项扣率绝对值） |
| `物流明细` | `GUOO Economy Small ¥12.30 (实重350g/体积重0g/计费重350g/20-25天)` |
| `目标售价(¥)` | v0.1 = 售价；v0.2 加目标价驱动模式（用户给定售价反推可承受采购上限） |
| `核价状态` | `P_TODO` → `P_DOING` → `P_DONE` / `P_FAILED` |
| `失败原因枚举` | `PRICE_MISSING_INPUT` / `PRICE_NO_LOGISTICS_GROUP` / `PRICE_RATE_OVER` / `PRICE_NEGATIVE_PROFIT` / `PRICE_LOG_TOO_HIGH` |
| `备注` | `[CORE-PRICING-FAIL]` / `[VISION_EST conf=0.75]` 等标记 |
| `核价开始时间` | 抢占时间戳（毫秒） |

下游：`核价状态=P_DONE` 时由编排层（or 上架 listing 触发器）消费，本技能不直接写 L_TODO。

## 公式（v0.2 锁定）

```
rate_total = commission + lastmile(0.04) + acquiring(0.02) + buffer(0.05)
           + ad(0.08) + agent(0.02) + profit_target(类目相关 0.25~0.50)
fixed_cost = cost_purchase + cost_domestic + cost_logistics
price      = fixed_cost / (1 - rate_total)
profit          = price × profit_target
ozon_commission = price × commission
lastmile_fee    = price × 0.04
total_cost      = fixed_cost + ozon_commission + lastmile_fee
                + price × (acquiring + buffer + ad + agent)
markup          = price / cost_purchase
logistics_ratio = cost_logistics / price
```

**v0.2 利润目标自动降档（核心改造）**：

调用 `lib/pricing_calc.try_calc_with_fallback()`：
1. 用 `pick_profit_target(cat_id)` 选初始 profit_target（17 类目表 → default 0.40）
2. 首档失败 / 打 warn → 按 `fallback.step` (默认 5%) 降到 `fallback.floor` (默认 20%)
3. `stop_when_no_warn=true`：降到无 warn 即停（让备注更干净），否则跑到地板
4. 任意一档跑得通就用那档结果，仍打 warn 也状态 P_DONE

**Sanity（v0.2 大改）**：

| 检查 | 阈值 | 行为 (warn_only_mode=true) | 失败码 |
|---|---|---|---|
| **硬死线** | rate_total ≥ 0.95 → 公式无解 | **P_FAILED** | `PRICE_RATE_OVER` |
| **硬死线** | profit ≤ 0 | **P_FAILED** | `PRICE_NEGATIVE_PROFIT` |
| **硬死线** | 9 组物流全超上限 | **P_FAILED** | `PRICE_NO_LOGISTICS_GROUP` |
| **硬死线** | weight/dims 缺且视觉降级失败 | **P_FAILED** | `PRICE_MISSING_INPUT` |
| 倍率 ≤ markup_warn (默认 25x) | markup 超 → **P_DONE + 飞书备注** | `PRICE_WARN_HIGH_MARKUP` |
| 物流占比 ≤ logistics_ratio_warn (默认 55%) | 超 → **P_DONE + 飞书备注** | `PRICE_WARN_HIGH_LOGISTICS` |
| 利润目标被降档 | 自动加 warn | **P_DONE + 飞书备注** | `PRICE_WARN_PROFIT_FALLBACK` |

**回滚开关**（`config.v02_features`）：

| 开关 | true (默认) | false (回到 v0.1 行为) |
|---|---|---|
| `warn_only_mode` | markup/物流超阈值仅 warn | 升级为 `PRICE_RATE_OVER` / `PRICE_LOGISTICS_OVER` P_FAILED |
| `profit_fallback` | 利润目标自动降档 | 只跑首档，不降 |

## 物流（GUOO 5 组 + CEL 4 组 = 9 组并行比价）

| 承运商 | 组名 | 实重上限 | 体积重计费 | 时效 |
|---|---|---|---|---|
| GUOO | Economy ExtraSmall | 500g | max(实重, L*W*H/8000) | 20-25 天 |
| GUOO | Economy Small | 2kg | 同上 | 20-25 天 |
| GUOO | Economy Medium | 10kg | 同上 | 25-30 天 |
| GUOO | Economy Large | 30kg | 同上 | 25-30 天 |
| GUOO | Express Small | 2kg | L*W*H/6000 | 12-15 天 |
| CEL | Standard ExtraSmall | 500g | L*W*H/8000 | 18-22 天 |
| CEL | Standard Small | 3kg | 同上 | 18-22 天 |
| CEL | Standard Medium | 15kg | 同上 | 22-28 天 |
| CEL | Standard Large | 30kg | 同上 | 22-28 天 |

实际定价表见 `lib/logistics_groups.py`。`cheapest()` 返回最低价 + 全候选 detail。

## 编排（5 步 + 视觉降级分支）

### Step 1：preempt
```bash
python scripts/preempt.py
# 退出码 0：成功，stdout 含 batch_id
# 退出码 3：无 P_TODO，结束本次会话
# 退出码 1：异常
```

### Step 2：load_inputs
```bash
python scripts/load_inputs.py --batch-id <BATCH_ID>
# 退出码 0：输入完整，跳到 Step 4
# 退出码 4：缺 weight/dims，触发视觉降级（agent 转 Step 3a）
# 退出码 2：无视觉源 URL，软失败已落 fail.json，跳到 Step 5 写 P_FAILED
```

### Step 3a：（仅 EXIT 4 时）agent 调 see_image 估算

**agent 收到 EXIT 4 后必须执行**：

1. 读 `batch/<BATCH_ID>/vision_request.json` → 取 `urls` 列表
2. 读 `batch/<BATCH_ID>/vision_prompt.txt` → 完整 prompt
3. 调 `see_image(image_paths=urls)` 看图
4. 按 prompt 输出严格 JSON：
   ```json
   {
     "weight_g": 350,
     "length_cm": 18,
     "width_cm": 8,
     "height_cm": 8,
     "confidence": 0.75,
     "reason": "包装盒规格 18×8×8 cm，蓝牙音箱+充电线 350g 估算"
   }
   ```
5. 写到 `batch/<BATCH_ID>/vision_result.json`

### Step 3b：vision_estimate（合并视觉结果）
```bash
python scripts/vision_estimate.py --batch-id <BATCH_ID>
# 退出码 0：confidence ≥ 0.6，写飞书 + 备注 [VISION_EST]，继续 Step 4
# 退出码 2：confidence < 0.6，软失败，跳到 Step 5
```

### Step 4：calc
```bash
python scripts/calc.py --batch-id <BATCH_ID>
# 退出码 0：售价 OK，落 result.json
# 退出码 2：物流不可装 / 公式 sanity 失败，已落 fail.json
```

### Step 5：finalize
```bash
python scripts/finalize.py --batch-id <BATCH_ID>
# 退出码 0：P_DONE 已写飞书
# 退出码 2：P_FAILED 已写飞书（按 fail.json or result.fail_code 路由）
```

## 视觉降级 Prompt 锚点

完整模板见 `lib/vision_estimate.py:VISION_PROMPT_TEMPLATE`。要点：

- 给 agent 的图：规格主图 URL 1 张 + 采集多角度图组 URL 前 5 张 = 共 6 张
- 强制输出 JSON，禁止 markdown 包裹
- 必须给 confidence (0~1) + reason
- confidence < 0.6 视为不可信，触发软失败让人工填

## 配置 `config/pricing_v01.yaml`

| 节 | 默认 | 说明 |
|---|---|---|
| `profit.default` | 0.50 | 全局利润目标 |
| `profit.by_ozon_cat` | 空 | 按类目覆盖（v0.2 启用） |
| `commission_by_cat` | 30+ 类目 + default 0.15 | Ozon 类目佣金率 |
| `other_rates` | lastmile 0.04 / acquiring 0.02 / buffer 0.05 / ad 0.08 / agent 0.02 | 5 项扣率 |
| `vision.min_confidence` | 0.60 | 视觉估算可信阈值 |
| `vision.max_total_images` | 6 | 视觉源图最大数 |
| `logistics.enabled_carriers` | [GUOO, CEL] | 启用承运商 |
| `logistics.blocked_groups` | 空 | 禁用特定组 |

## 已知限制 / v0.2 路线

- v0.1 不算汇率（Ozon 跨境店 CNY 结算）；接俄区本地店时再加
- 类目佣金当前 30+ 一二级，三级类目需扩
- 多承运商时效偏好（用户优先快 vs 便宜）— 现固定取最便宜
- 目标价驱动模式（给定售价反推采购上限）— v0.2
- 批量串行支持（v0.1 单 record，每会话 1 次）
82 / 利润¥283.09 | 3.68x | P_DONE 首档 |
| 极端 | ¥1 | ¥20 | default | 售价¥47.73 / 利润¥9.55 | 47.73x | P_DONE 降到地板 + WARN |

**全 P_DONE，零 hard fail**。warn 仅写飞书「备注」字段 `[CORE-PRICING-WARN] markup=47.7x ... | 利润目标降档 40%→20% (Δ-20%)`。

## 已知限制 / v0.3 路线

- v0.2 不算汇率（Ozon 跨境店 CNY 结算）；接俄区本地店时再加
- 类目佣金当前 17 类目，三级类目需扩
- 多承运商时效偏好（用户优先快 vs 便宜）— 现固定取最便宜
- 目标价驱动模式（给定售价反推采购上限）— v0.3
- 批量串行支持（v0.2 单 record，每会话 1 次）

## Changelog

### v0.2 (2026-05-18)
- **新增**：17 个 Ozon 类目利润表（低价 3C 25-30%/服饰 40-45%/家居高价 50%）
- **新增**：`try_calc_with_fallback()` 利润目标自动降档（5%/档，到 20% 地板）
- **改造**：markup/物流占比 sanity 改 warn-only，写飞书备注，状态保持 P_DONE
- **新增**：3 个 warn 枚举（`PRICE_WARN_HIGH_MARKUP` / `PRICE_WARN_HIGH_LOGISTICS` / `PRICE_WARN_PROFIT_FALLBACK`）
- **回滚**：`v02_features.{warn_only_mode, profit_fallback}` 全 false 即等同 v0.1
- **保留硬死线**：`PRICE_RATE_OVER` (rate≥0.95) / `PRICE_NEGATIVE_PROFIT` (利润≤0) / `PRICE_NO_LOGISTICS_GROUP` / `PRICE_MISSING_INPUT`
- **影响**：通过率从 ~70% → 100% (5 case 全过)，含 1 个极端 case ¥1 商品也能 P_DONE 带 warn

### v0.1 (2026-05-13)
- 初版：5 步编排 + 视觉降级 + 9 组物流比价 + 公式反推
- 实战通过 record `recvjfOd45Gfjf` 蓝牙音箱 E2E 闭环
