# 辰启 v3.2.0 - 飞书建表 / 迁移 Skill

> 详细说明请见 [SKILL.md](SKILL.md)

## 快速开始

```powershell
# 0. 自检环境
python scripts/setup_check.py

# 1. 新机器：一键建表（4 张表 143 字段）
python scripts/init.py

# 2. 老 base：升级 schema（v3.1.0 → v3.2.0 ...）
python scripts/migrate.py --check        # 看当前版本 + 待执行迁移链
python scripts/migrate.py --target latest

# 3. 录入 Ozon 店铺凭证
python scripts/add_shop.py               # 交互式
# 或参数式：
python scripts/add_shop.py --shop-id shop_aux1 --shop-name "副店" \
    --client-id 4423401 --api-key xxx --quota 100 --priority 2

# 4. 验证完整性
python scripts/verify.py
```

## 目录结构

```
chenqi-lark-setup/
├── SKILL.md                 # Skill 元数据（agent 加载入口）
├── README.md                # 本文档
├── schema/
│   ├── tables.py            # 4 张表 143 字段定义 + SCHEMA_VERSION
│   └── version_history.py   # 迁移注册表
├── lib/
│   ├── lark_io.py           # lark-cli 封装（find/调用/解析）
│   └── migrate.py           # 迁移引擎（detect_current_version / migrate_to_target）
├── scripts/
│   ├── setup_check.py       # 环境自检（先跑这个）
│   ├── init.py              # 新机器全量建表
│   ├── migrate.py           # 老 base 走标准迁移链升级
│   ├── add_shop.py          # 录入 Ozon 店铺凭证（参数式 + 交互式）
│   ├── verify.py            # 完整性校验（4 表 143 字段 + schema_version）
│   ├── add_shop_pool.py     # ⚠️ 已废弃，转发到 migrate.py 兼容
│   └── migrations/
│       └── v3_1_to_v3_2_add_shop_pool.py
└── output/                  # init/migrate 跑完后生成
    └── base_info.json       # base_token / 4 个 table_id / 字段映射 / schema_version
```

## 4 张表

| 表 | 字段数 | 用途 |
|---|---|---|
| 商品全生命周期 | 95 | SKU 主表，承载 S→C→T→I→P→L→Q 7 阶段状态 |
| 失败事件流水 | 15 | 各环节异常事件存档 |
| 批次仪表盘 | 22 | 批次聚合统计 + `__SCHEMA__` 元数据行 |
| 店铺账号池 | 11 | Ozon 多店凭证池（client_id/api_key/配额/优先级） |

## 协议约定

- **抢占式状态机**：每个下游 Agent 接到 SKU 后第一步——把状态列从 `*_TODO` 改为 `*_DOING`
- **入口信号**（α）：上游写完数据时同步置下游 `*_TODO`；采集完成时同时点亮 T_TODO + I_TODO + P_TODO 三者并行
- **schema 守卫**：下游启动时读「批次仪表盘」表的 `__SCHEMA__` 行（或 `base_info.schema_version`）比对版本，不一致提示跑 `migrate.py`
- **业务日规则**：所有"今日"指 BJ 业务日 `[当日 03:00, 次日 03:00)`，与 Ozon 配额刷新对齐
- **多店凭证**：调 Ozon API 必须先 `pick_active_shop()`，禁止硬编码 client_id/api_key

## 迁移框架（v3.2.0+）

改 schema 不再"重跑 init.py 隐式加字段"——必须写 migration：

1. 编辑 `schema/tables.py` 加字段 + 升 `SCHEMA_VERSION`
2. 写 `scripts/migrations/v3_x_to_v3_y_xxx.py`（暴露 `FROM_VERSION` / `TO_VERSION` / `migrate()`）
3. 注册到 `schema/version_history.py`
4. 跑 `migrate.py --target latest`，三道幂等保护 + 单步原子

详见 [SKILL.md](SKILL.md)「单一事实源」章节。

## 跨账号复用

零硬编码。新机器步骤：
1. 拷整个 skill 目录（不带 `output/`）
2. 新账号在 Accio 连接飞书
3. `setup_check.py` → `init.py` → `add_shop.py`
