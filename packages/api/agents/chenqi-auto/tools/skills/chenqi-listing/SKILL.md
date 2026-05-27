---
name: chenqi-listing
description: |
  辰启-自动上架 v0.1。从飞书「商品全生命周期」表 L_TODO 行抢占 1 个 record，
  按 10 步串行编排把商品推到 Ozon /v3/product/import：抢占 → 读 17 字段 →
  店铺池 pick → 8 张图 HEAD+尺寸校验 → attrs_pull_full（type_id 信任翻译，按 type 拉真实
  47 个属性 dict 做 ID 强校验+缺项 diff）→ build_payload（CNY 跨境店、offer_id=C{record_id}
  幂等、4 个加分位 bullet 拆 4189-4192、Rich Content widget JSON、商品描述 4191）→
  submit_import（支持 --dry-run 双管齐下 cache+print）→ poll_import 10s/300s
  → verify_errors（imported=L_DONE，stocks/prices 同步失败仅 warning 不降级）→
  finalize 写飞书 L_DONE/L_FAILED + Ozon商品ID + 商品链接 + 失败流水。
  当用户说「执行辰启-自动上架」「跑下一个上架」「推 L_TODO」「auto-listing」时触发。
  前置：(1) chenqi-lark-setup ≥v3.3.0 base_info.json 存在；
  (2) 上游 chenqi-image-process I_DONE + chenqi-auto-translate T_DONE +
  chenqi-pricing P_DONE 三家齐写 L_TODO；
  (3) 「店铺账号池」表至少 1 条 enabled shop（含 client_id/api_key）；
  (4) Python 3.12+ + lark-cli 当前账号已绑定。
license: Internal
---

# 辰启-自动上架 v0.1

## 何时触发

- 「执行辰启-自动上架」/「跑下一个上架」/「推 L_TODO」/「auto-listing」
- 上游三家（图片 I_DONE + 翻译 T_DONE + 核价 P_DONE）任一最后完成时同步写 `上架状态=L_TODO`，本技能负责消费

每次会话只跑 **1 个 L_TODO record**（10 步串行，无视觉降级，不需 agent see_image）。

## 输入字段（17 字段，从飞书读 record）

| 字段 | 来源 | 用途 |
|---|---|---|
| 1688商品ID | 选品 | 备份 |
| 1688商品标题 | 选品 | 备份 |
| 颜色 | 采集 | attr 10096 dict 映射，多色取首词 |
| 尺寸（cm） | 采集/视觉 | attr 4382 → mm |
| 重量(g) | 核价/视觉 | attr 4383 |
| 售价 | 核价 | import.price + 后置 prices 同步 |
| 翻译类型ID | 翻译 | attr 8229 = type_id 信任源 |
| 俄文标题 | 翻译 | attr 4180 / item.name |
| 俄文描述 | 翻译 | attr 4191 |
| 俄文加分位1-4 | 翻译 | bullets → attr 4189-4192 |
| 俄文属性JSON | 翻译 | merge 入 attributes |
| 主图1-8直链 | 图片 | item.images[] + primary_image |
| 翻译状态 | 翻译 | 软依赖：!=T_DONE 仅 print 警告 |
| 图片状态 | 图片 | 软依赖：!=I_DONE 仅 print 警告 |
| 核价状态 | 核价 | 软依赖：!=P_DONE 仅 print 警告 |

## 输出字段（写回飞书 9 字段）

| 字段 | L_DONE | L_FAILED |
|---|---|---|
| 上架状态 | L_DONE | L_FAILED |
| 上架时间 | 当前 ms | 当前 ms |
| 店铺名 | shop_name | shop_name |
| Ozon卖家SKU | offer_id | offer_id |
| Ozon商品ID | product_id | (空) |
| Ozon商品链接 | https://ozon.ru/product/{pid}/ | (空) |
| 初始库存 | 99 | 99 |
| 失败次数 | 不变 | +1 |
| 最近失败原因 | sync_warnings 备注 | [code] msg 截 200 |

## 10 步串行编排（全 Python，agent 0 介入）

| Step | 脚本 | 输入 | 输出 |
|---|---|---|---|
| 1 | preempt.py | record_id | preempt.json + L_TODO→L_DOING |
| 2 | load_inputs.py | preempt.json | inputs.json (17 字段，剥 markdown URL) |
| 3 | shop_pick.py | (店铺池) | shop.json (复用 _chenqi_common.shop_pool) |
| 4 | image_check.py | inputs.json | image_check.json (8 张 HEAD + PIL ≥700 软校验) |
| 5 | attrs_pull_full.py | inputs.json | attrs_meta.json (cat_id + type_id 信任翻译 + 47 attrs + 必填齐) |
| 6 | build_payload.py | inputs.json + attrs_meta.json + shop.json | payload.json (offer_id=C{rid} 幂等 / 34 attrs / RC / CNY) |
| 7 | submit_import.py | payload.json + shop.json | import_task.json (task_id) **|** --dry-run 走 cache + print |
| 8 | poll_import.py | import_task.json | import_info.json (status + product_id + errors) |
| 9 | verify_errors.py | import_info.json + payload + shop + inputs | verify.json (result + sync_results + warnings) |
| 10 | finalize.py | verify.json + preempt + shop + inputs | finalize.json + 写飞书 |

## 失败码（`L_FAILED` + 写「最近失败原因」）

| 码 | 触发 | 阶段 |
|---|---|---|
| `IMAGE_FETCH_FAIL` | image_check HEAD 失败 / Ozon 拉不到图 | Step 4 / Step 9 errors |
| `ATTR_INVALID` | dict_value_id 不在 type allowed | Step 9 errors |
| `BRAND_INVALID` | 品牌字典错 | Step 9 errors |
| `CATEGORY_INVALID` | description_category_id 错 | Step 9 errors |
| `TYPE_INVALID` | type_id 不属于 cat | Step 9 errors |
| `NAME_INVALID` | 标题长度/字符 | Step 9 errors |
| `DESC_INVALID` | 描述长度<450 / >6000 | Step 9 errors |
| `RICH_CONTENT_INVALID` | RC JSON 模板不符（Ozon 静默抹只是 warning，不致命） | Step 9 errors |
| `PRICE_INVALID` | 价格越界 | Step 9 errors |
| `OZON_REJECT` | 其他 Ozon 拒收 | Step 9 errors |
| `NO_PRODUCT_ID` | imported 但 product_id=0 (异常) | Step 9 |

**不算 L_FAILED**（L_DONE + sync_warnings 备注）：
- `STOCK_SYNC_PENDING` 跨境店缺 warehouse_id（要 Ozon 后台先分配 FBS 仓库）
- `PRICE_SYNC_PENDING` 后置 prices 失败（import 时已带 price，belt-and-suspenders 失败不致命）

## 退出码

| 码 | 含义 | 中断流程 |
|---|---|---|
| 0 | OK | ✗ 进下一步 |
| 11 | 抢占失败/已被别人抢/无 L_TODO | ✓ 全停 |
| 12 | 飞书读字段失败 | ✓ 全停 |
| 13 | 店铺池无可用店铺 | ✓ 全停（建议补 shop） |
| 14 | 图 HEAD 失败 | ✓ 全停 |
| 15 | type_id 拉真实 attrs 失败 | ✓ 全停 |
| 16 | payload 组装失败 | ✓ 全停 |
| 17 | submit_import HTTP 失败 | ✓ 全停 |
| 18 | 飞书写入失败 | ✓ 全停（飞书状态会卡 L_DOING） |

## 调用方式

```bash
cd <workspace>/agent-core/skills/chenqi-listing

# Step 1 抢占（必须先抢，拿到 batch_id）
python scripts/preempt.py
# → 输出 batch_id 形如 L_recvjfOd45Gfjf_20260513_101741

# Step 2-6 准备
python scripts/load_inputs.py     <batch_id>
python scripts/shop_pick.py       <batch_id>
python scripts/image_check.py     <batch_id>
python scripts/attrs_pull_full.py <batch_id>
python scripts/build_payload.py   <batch_id>

# Step 7 dry-run（推荐！review payload 摘要 + 存盘 cache/dry_run_{rid}.json）
python scripts/submit_import.py <batch_id> --dry-run

# Step 7 真推
python scripts/submit_import.py <batch_id>

# Step 8-10 收尾
python scripts/poll_import.py    <batch_id>
python scripts/verify_errors.py  <batch_id>
python scripts/finalize.py       <batch_id>
```

## 配置 `config/listing_v01.yaml`

| key | 默认 | 说明 |
|---|---|---|
| batch_size | 1 | 每会话 1 record |
| sleep_between | 2 | image_check HEAD 间隔（秒） |
| stock_init | 99 | 默认初始库存 |
| currency_code | CNY | 跨境店直接 CNY，不换汇 |
| poll_interval_s | 10 | 轮询间隔 |
| poll_timeout_s | 300 | 轮询超时 |
| attr_cache_hours | 24 | type→attrs 字典 cache |
| trust_cdn | true | 1688 sc02.alicdn.com 信任，不重传 Ozon |

## 锁定的设计决策（v0.1）

| 决策 | 选择 | 原因 |
|---|---|---|
| offer_id | `C{record_id}` 幂等 | 重跑同 record 自动 update 同一 offer |
| Rich Content 缺块 | 整段删（不留空） | Ozon V0.2 不接受空 widget |
| dry-run | cache + print 双管 | 用户既要看摘要也要审完整 payload |
| 不换汇 | CNY 直推 | Ozon 跨境店 currency_code=CNY |
| 信任图片源 | 不质疑 1688 CDN | 上游图片技能保证 hash 去重+尺寸 |
| 翻译状态软依赖 | 不阻断 | 兼容手动 patch / 翻译漏标 |

## 不做（v0.1 范围外）

- ❌ 视觉降级（核价已做完，上架直接吃）
- ❌ 多 record 批跑（1 会话 1 record，避免 Ozon 限流）
- ❌ 仓库分配（warehouse_id v0.1 缺，stocks 同步失败只 warning，下游手动补）
- ❌ 自动重试（L_FAILED 不自动 reset，需手动改回 L_TODO 重跑）
- ❌ 智能 fallback type_id（信任翻译选的，错了 v0.2 修翻译）

## v0.2 待修清单（实跑暴露）

1. **RC JSON 模板**：Ozon 报 erased_attribute_value，把 RC 整段抹了（商品页空 RC）→ 拉真实 RC widget schema 重对齐
2. **某属性 dict_value 越界**：报 warning_attribute_values_out_of_range → 拉 type_id 真实 attribute_values 强校验，不依赖翻译选的 ID
3. **stocks 缺 warehouse_id**：跨境店要先 Ozon 后台分配 FBS 仓库 → shop 池表加 warehouse_id 字段
4. **type_id MEMORY 写错**：之前 MEMORY 记 95320，实际 95318 → MEMORY 修正
5. **教训 #30 误判修正**：lark-cli +record-list 的 data 矩阵列序 = fields，dict(zip()) 完全正确，之前误判要修

## v0.1 真推验收（2026-05-13）

- record `recvjfOd45Gfjf` (P6 蓝牙音箱)
- batch `L_recvjfOd45Gfjf_20260513_101741`
- offer_id `CrecvjfOd45Gfjf` / type_id 95318 / 34 attrs / RC 2366字 / 8 张 1688 CDN 图
- task_id 4436440149 → status=imported → product_id=4560028634
- 飞书 L_DONE + 链接 https://www.ozon.ru/product/4560028634/
- 配额 shop_main 2/100
