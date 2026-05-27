---
name: chenqi-lark-setup
description: 辰启 v3.2.0 飞书多维表初始化与迁移工作流。一键创建跨境电商上架项目所需的 4 张飞书表（商品全生命周期 95 字段 / 失败事件流水 15 字段 / 批次仪表盘 22 字段 / 店铺账号池 11 字段，共 143 字段），写入 __SCHEMA__ 元数据行，并生成下游 7 个技能复用的 base_info.json（含 base_token、table_id、字段名→field_id 映射、schema_version）。支持版本化迁移：老 base 自动检测当前版本并按 migrations/ 中的标准脚本逐版升级（如 v3.1.0→v3.2.0 加店铺账号池表），具备三道幂等保护，跑半失败可断点续跑。同时提供 add_shop.py 一站式录入 Ozon 店铺凭证（含 client_id / api_key / 配额 / 优先级），自动对齐 BJ 凌晨 03:00 的业务日切日规则（与 Ozon 配额刷新对齐）。零硬编码：base 由 lark-cli 动态创建，身份用 --as bot 自动绑定当前账号，可在任意新机器/新账号无缝复用。当用户说「执行辰启-飞书建表」「初始化飞书表」「重建多维表」「升级 schema」「添加店铺凭证」「跑 chenqi-lark-setup」「飞书 base 一键建表」时触发。前置：(1) lark-cli 已安装且在 PATH（Windows 用 lark-cli.cmd）；(2) 当前账号已在 Accio 连接飞书（Connected Accounts）；(3) Python 3.10+。不适用于：非辰启项目的飞书初始化（字段写死为辰启业务表）；想往已有 base 增量加单字段（直接 lark-cli +field-create 即可）。
version: 3.2.0
---

# 辰启-飞书建表 Skill v3.2.0

跨境电商上架项目（辰启系列 8 大技能）的「协议层」初始化与迁移工具。一次跑完，产出整个流水线共用的飞书数据底座；老 base 走标准迁移升级，新店铺一行命令录入。

## 何时使用

- **新机器 / 新账号第一次部署辰启系列**：用 `init.py` 全量建表
- **schema 版本升级**（如 v3.1.0 → v3.2.0）：用 `migrate.py` 走标准迁移路径
- **新增 Ozon 店铺凭证**：用 `add_shop.py` 录入店铺账号池（多店配额池基础设施）
- **校验 base 完整性**：用 `verify.py`（全表全字段一致性 + schema_version 核对）

## 触发短语

- 执行辰启-飞书建表 / 初始化飞书表 / 重建多维表
- 升级 schema / 跑 migrate / 飞书 base 升级
- 添加店铺凭证 / 录入 Ozon 店铺 / add_shop
- 跑 chenqi-lark-setup / 飞书 base 一键建表

## 产出物

| 物件 | 用途 |
|---|---|
| 1 个飞书 base | 整个流水线的数据库 |
| 商品全生命周期表 (95 字段) | SKU 主表，承载选品→采集→翻译→图片→核价→上架→质检全流程状态（含 9 个 S_ 状态字段） |
| 失败事件流水表 (15 字段) | 各环节异常事件存档，便于复盘 |
| 批次仪表盘表 (22 字段) | 批次级聚合统计 + `__SCHEMA__` 元数据行 |
| 店铺账号池表 (11 字段) | Ozon 多店凭证池：店铺ID / client_id / api_key / 每日配额 / 今日已用 / 优先级 / 状态等 |
| `output/base_info.json` | 下游 7 个技能直接 import：含 base_token / 4 个 table_id / 完整字段映射 / schema_version |

---

## 执行流程

### 场景 A：新机器全量建表（4 步）

#### 第 1 步：环境自检

```powershell
python scripts/setup_check.py
```

检查 lark-cli 在 PATH、bot 身份已授权、Python ≥ 3.10、必需模块可 import。任一项失败会打印**具体修复建议**，不会继续往下跑。

#### 第 2 步：一键建表

```powershell
python scripts/init.py
```

行为：
1. 调 `lark-cli base +base-create --as bot --name "辰启-跨境上架项目"` 创建空白 base
2. 拿到默认表后，按 `schema/tables.py` 中的定义建 4 张表（第 1 张复用默认表，其余 3 张 create + 加字段）
3. 删除飞书自动生成的占位字段（"单选"/"附件"等不在 schema 内的）
4. 在「批次仪表盘」表写一行 `__SCHEMA__` 记录 schema 版本号 + 字段哈希
5. 把 `base_token` / 4 个 `table_id` / 完整字段映射 / `schema_version` 落入 `output/base_info.json`（**字典结构**：`tables.<表名>.{table_id, fields:{字段名:field_id}}`）

#### 第 3 步：完整性验证

```powershell
python scripts/verify.py
```

读 `output/base_info.json`，调 lark-cli 拉取实际字段，与 `schema/tables.py` 比对：
- 4 张表全在 + 字段全到 + 字段类型一致 → exit 0
- `base_info.schema_version` 与 `SCHEMA_VERSION` 一致 → exit 0
- 任一不符 → 报错并提示跑 `migrate.py`

#### 第 4 步：录入第一家店铺

```powershell
python scripts/add_shop.py
# 交互式提示输入店铺ID/名称/client_id/api_key/配额/优先级/状态
```

详见后文「录入店铺凭证」章节。

---

### 场景 B：老 base 升级（3 步）

#### 第 1 步：检查当前版本

```powershell
python scripts/migrate.py --check
```

输出当前 base 的 `schema_version`、目标版本（`SCHEMA_VERSION`）、需要执行的迁移链。

老 base 没有 `schema_version` 字段时按现有 tables 推断（3 张表→v3.1.0，4 张表→v3.2.0）。

#### 第 2 步：执行迁移

```powershell
python scripts/migrate.py --target latest
# 或指定版本：python scripts/migrate.py --target v3.2.0
```

行为：
1. 按 `schema/version_history.py` 注册的迁移链逐版执行（如 v3.1.0 → v3.2.0 跑 `migrations/v3_1_to_v3_2_add_shop_pool.py`）
2. 每个 migration 跑完立刻写盘 + 升 `base_info.schema_version`，失败时版本号永远 ≤ 实际状态（断点续跑安全）
3. 三道幂等保护：base_info 已有该表 → skip / 飞书侧实查表已存在 → recover（补回 base_info，不重建）/ 都没有 → 全量建表

#### 第 3 步：验证

```powershell
python scripts/verify.py
```

---

### 场景 C：录入 / 管理店铺凭证

```powershell
# 参数式（脚本化、批量）：
python scripts/add_shop.py \
    --shop-id shop_aux1 \
    --shop-name "副店-鞋类" \
    --client-id 4423401 \
    --api-key xxxxxxxxxxxxxxxx \
    --quota 100 --priority 2 --status 启用

# 交互式（首次配置 / 不熟悉参数）：
python scripts/add_shop.py
```

行为：
1. 校验店铺ID 在「店铺账号池」表中唯一（重复报错并退出）
2. 写入飞书（自动补 `今日已用=0` / `最后切店时间=BJ now` / `计数日期=BJ 当日 03:00`）
3. 回读确认

下游技能（采集 / 翻译 / 上架）通过 `_chenqi_common/shop_pool.py` 的 `pick_active_shop()` 自动从池里选出有可用配额的店。

---

## 业务日规则（Ozon 配额对齐）

**所有"今日"指的是 BJ 时区的业务日**，而非自然日。

- 业务日 = `[当日 03:00:00 BJ, 次日 03:00:00 BJ)`
- 每天 BJ 03:00 自动重置「今日已用」字段（与 Ozon 后台配额刷新时刻对齐）
- "计数日期" 字段存的是当前业务日的起点（BJ 当日 03:00 的毫秒时间戳）
- 切日检测：跑 `pick_active_shop()` 时若发现 `计数日期` 早于当前业务日起点，自动 reset

⚠️ **飞书 dateTime 字段必须用毫秒 int** 写入；传 ISO 字符串会被静默丢弃（不报错但导致字段空白）。`_now_ms()` / `_business_day_start_ms()` 已在 `add_shop.py` 中封装。

---

## 协议约定（下游技能必读）

以下规则在表结构里"硬约定"，下游技能必须遵守：

1. **抢占式状态机**：每个 Agent 接到 SKU 后第一步——把对应状态列从 `*_TODO` 改为 `*_DOING`，避免被定时任务重复领取
2. **入口信号**（α 方案）：上游写完数据时同步把下游状态置为 `*_TODO`。链路：
   - 选品完成 → 写 `采集状态 = C_TODO`
   - 采集完成 → **同时**点亮 `翻译状态=T_TODO` + `图片状态=I_TODO` + `核价状态=P_TODO`（三者并行，互不依赖）
   - 翻译/图片/核价全 DONE → 写 `上架状态 = L_TODO`
   - 上架完成 → 写 `质检状态 = Q_TODO`
3. **schema 版本守卫**：每个下游 Agent 启动时应读「批次仪表盘」表的 `__SCHEMA__` 行（或 `base_info.schema_version`），比对自己内置的 `expected_version`；不一致就停机，要求跑 `migrate.py` 同步
4. **多店配额池**：所有调 Ozon API 的下游必须先 `pick_active_shop()` 拿凭证，调用后 `increment_used()`，不允许硬编码 client_id / api_key

---

## 状态前缀字典

| 前缀 | 阶段 | 含义 |
|---|---|---|
| `S_` | 选品 (Sourcing) | S_TODO / S_DOING / S_DONE / S_FAIL |
| `C_` | 采集 (Collection) | C_TODO / C_DOING / C_DONE / C_FAIL |
| `T_` | 翻译 (Translation) | T_TODO / T_DOING / T_DONE / T_FAIL |
| `I_` | 图片 (Image) | I_TODO / I_DOING / I_DONE / I_FAIL |
| `P_` | 核价 (Pricing) | P_TODO / P_DOING / P_DONE / P_FAIL |
| `L_` | 上架 (Listing) | L_TODO / L_DOING / L_DONE / L_FAIL |
| `Q_` | 质检 (Quality) | Q_TODO / Q_DOING / Q_DONE / Q_FAIL |

---

## 故障排查

| 现象 | 原因 | 解法 |
|---|---|---|
| `lark-cli: command not found` | 未装或不在 PATH | `npm i -g @larkw/lark-cli`，或用 Accio Work 自带版本 |
| API 报 `permission denied` | bot 身份未授权 | 在飞书后台「开发者后台 → 应用」启用 bot 角色，或 Accio 重新连接飞书 |
| `JSONDecodeError: Expecting value` | lark-cli 输出非 JSON | 单独跑该命令看真实报错，多半是参数拼写错（如 `+record-batch-create` 写成了 `+record-create`） |
| `+record-create not found` | lark-cli 没有这个子命令 | 单条创建用 `+record-upsert` 不带 `--record-id`；多条用 `+record-batch-create` |
| dateTime 字段写入后回读为空 | 传了 ISO 字符串 | 必须用毫秒 int（`int(datetime.now().timestamp() * 1000)`），飞书会静默丢弃字符串型时间 |
| 主字段没改成中文名 | 飞书默认主字段类型是 text，schema 里第 1 个字段如果是其他类型可能改不动 | 让 schema 里每张表第 1 个字段都用 `text` 类型 |
| `verify.py` 报版本不一致 | 改了 SCHEMA_VERSION 但没跑 migrate | 跑 `migrate.py --target latest` |
| `migrate.py` 跑一半失败 | 网络抖动 / lark-cli 偶发错 | 直接重跑 `migrate.py --target latest`：每个 migration 单步原子，失败时版本号未升，会自动从该步重试 |
| 跑了一半失败、想从头来 | base 已经建了一半 | 删掉飞书侧那个 base，再跑 `init.py`；或在飞书侧手动清空后用 `BASE_TOKEN=xxx python init.py` 复用 token |

---

## 跨账号 / 跨机器复用

零硬编码设计——以下值全是运行时动态获取：

| 项 | 来源 |
|---|---|
| base_token / table_id | `init.py` 跑完后写入 `output/base_info.json` |
| schema_version | `init.py` / `migrate.py` 写入 `base_info.json` 顶层字段 |
| 飞书域名 | lark-cli 返回 |
| 用户身份 | `--as bot` 自动绑定 Accio 连接的飞书账号 |
| 本地路径 | `Path(__file__).parent` 自动定位 |
| lark-cli 路径 | `lib/lark_io.find_lark_cli()` 走 PATH（Windows 自动找 .cmd） |

**新机器复用步骤**：
1. 拷整个 `chenqi-lark-setup/` 目录（不带 `output/`，或删掉旧 `output/`）
2. 新账号在 Accio 连接飞书
3. `python scripts/setup_check.py` → `python scripts/init.py` → `python scripts/add_shop.py`
4. 全新 base + base_info.json + 第一家店凭证就绪

---

## 单一事实源：`schema/tables.py` + 迁移框架

所有字段定义、单选项、字段顺序、版本号都在 `schema/tables.py`。**改 schema 不再用"BASE_TOKEN=xxx 重跑 init.py 增量加字段"的隐式路径**——必须走标准迁移：

### 改 schema 流程（v3.2.0 → v3.3.0 示例）

1. 编辑 `schema/tables.py`：加新字段 / 新表 / 改单选项；同步把 `SCHEMA_VERSION` 升到 `v3.3.0`
2. 写新 migration：`scripts/migrations/v3_2_to_v3_3_xxx.py`，必须暴露：
   ```python
   FROM_VERSION = "v3.2.0"
   TO_VERSION   = "v3.3.0"
   DESCRIPTION  = "加 XX 表 / 改 YY 字段"
   def migrate(base_info: dict, lark_cli_path: str) -> dict:
       # 1. 三道幂等保护：base_info 已有 → skip / 飞书侧已有 → recover / 都没 → 全量建
       # 2. 用 lib/lark_io 的 lark()/run() 调 lark-cli
       # 3. 返回更新后的 base_info（migrate.py 会写盘 + 升版本号）
       return base_info
   ```
3. 注册到 `schema/version_history.py` 的迁移链
4. 在已有 base 上跑：`python scripts/migrate.py --target latest`
5. `python scripts/verify.py` 确认 `[PASS]`

### 目录结构

```
chenqi-lark-setup/
├── schema/
│   ├── tables.py                    # 4 张表 143 字段定义 + SCHEMA_VERSION
│   └── version_history.py           # 迁移注册表 + get_migration_path()
├── lib/
│   ├── lark_io.py                   # find_lark_cli / lark / run / strip_meta / create_table_with_fields
│   └── migrate.py                   # detect_current_version / load_base_info / save_base_info / migrate_to_target
├── scripts/
│   ├── setup_check.py               # 环境自检
│   ├── init.py                      # 全量建表（新机器用）
│   ├── migrate.py                   # 老 base 升级（CLI: --check / --target）
│   ├── add_shop.py                  # 录入 Ozon 店铺凭证（参数式 + 交互式）
│   ├── verify.py                    # 完整性校验（4 表 143 字段 + schema_version）
│   ├── add_shop_pool.py             # ⚠️ 已废弃，转发到 migrate.py 兼容老调用
│   └── migrations/
│       └── v3_1_to_v3_2_add_shop_pool.py
└── output/
    └── base_info.json               # 字典结构 + schema_version 顶层字段
```

---

## 不适用场景

- 非辰启项目的飞书初始化（字段是写死的辰启业务表）
- 想往已有 base 增量加**单个**字段（直接 `lark-cli base +field-create` 就行，不必跑全套）
- 用 user 身份建表（脚本统一走 `--as bot`，需要切 user 请改 `lib/lark_io.AS_BOT` 常量）
- 跨 schema 大版本回滚（迁移框架只支持向前升级，回滚需手动删表）
