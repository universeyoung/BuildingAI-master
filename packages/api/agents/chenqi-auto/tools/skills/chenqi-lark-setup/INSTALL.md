# 辰启-飞书建表 安装指南（小白版）

> 跟着这个文档一步步操作，30 分钟内可以从「全新机器」跑到「飞书 base 建好 + 第一家 Ozon 店铺录入完成」。
>
> **不需要懂 Python / 不需要懂命令行 / 不需要懂 git**。复制粘贴就行。

---

## 这个东西是干什么的？

辰启系列做跨境电商上架自动化（1688 选品 → 翻译 → 出图 → 核价 → Ozon 上架）。所有数据都存在飞书多维表里，下游 7 个技能（采集 / 翻译 / 图片 / 核价 / 上架 / 质检 / 选品）都从同一个飞书 base 读写。

**这个 skill 的工作就是**：在你飞书账号里**自动**建好这个 base（4 张表 143 字段），并把你的 Ozon 店铺凭证录进去。建完一次，下游 7 个技能可以直接用。

---

## ✅ 第 0 步：检查前置条件

### 0.1 你需要有的账号

| 账号 | 说明 | 怎么准备 |
|---|---|---|
| 飞书账号 | 任意飞书账号，建议是公司主账号 | 已注册即可 |
| Ozon 卖家账号（至少 1 家店）| 后续录入 client_id / api_key | 在 Ozon 后台 → 设置 → API 密钥 拿到 |
| Accio Work | 你正在用的就是 | 已经在用了 ✅ |

### 0.2 飞书必须连接到 Accio Work

**怎么检查**：
1. 打开 Accio Work
2. 左下角点你的头像 → 「Settings 设置」 → 「Connected Accounts 已连接账号」
3. 看「飞书 / Lark」那一栏的状态

**应该看到**：
```
飞书 / Lark    ✅ Connected   (你的飞书显示名)
```

**如果显示「Not Connected 未连接」**：
- 点「Connect 连接」
- 弹出飞书授权页，点「同意 / Allow」
- 等到状态变成 `Connected` 再继续

---

## ✅ 第 1 步：打开 PowerShell 终端

### Windows 用户
按 **Win 键**，输入 `powershell`，回车。会弹出一个蓝底白字的窗口，标题写着 `Windows PowerShell`。

### Mac 用户
按 **Command + 空格**，输入 `terminal`，回车。

### 看起来应该是这样
```
PS C:\Users\你的用户名>
```
（光标在 `>` 后面闪烁，等你输入命令）

---

## ✅ 第 2 步：进入 skill 目录

**复制下面这条命令**，粘贴到刚才打开的 PowerShell 窗口里，按回车：

```powershell
cd C:\Users\Administrator\.accio\accounts\1754837954\agents\DID-F456DA-2B0D4C\agent-core\skills\chenqi-lark-setup
```

> ⚠️ 路径里的 `1754837954` 和 `DID-F456DA-2B0D4C` 是你 Accio 账号的内部编号，可能跟示例不一样。**正确做法**：在 Accio Work 里打开任一对话，对 AI 说「打开 chenqi-lark-setup 文件夹」，它会自动定位。

**应该看到**：
```
PS C:\Users\Administrator\.accio\accounts\1754837954\agents\DID-F456DA-2B0D4C\agent-core\skills\chenqi-lark-setup>
```

光标后面那串路径变了，说明你成功进入了 skill 目录。

---

## ✅ 第 3 步：环境自检（30 秒）

**复制粘贴**：
```powershell
python scripts/setup_check.py
```

### ✅ 顺利时应该看到
```
[OK] Python version: 3.12.x
[OK] lark-cli found at: C:\Users\Administrator\AppData\Roaming\Accio\...\lark-cli.cmd
[OK] lark-cli bot identity: 你的飞书显示名
[OK] schema/tables.py importable, SCHEMA_VERSION = v3.2.0
[OK] All 4 tables defined (143 fields total)

[ALL CHECKS PASSED] You can run init.py now.
```

### ❌ 报错怎么办

**报错 A**：`'python' 不是内部或外部命令`
- 你电脑没装 Python，或者没加进 PATH
- **解法**：去 https://www.python.org/downloads/ 下 3.12 版本，**安装时务必勾选 "Add Python to PATH"**，装完关掉这个 PowerShell 窗口、重新按 Win 打开 powershell

**报错 B**：`[ERR] lark-cli not found in PATH`
- Accio Work 自带的 lark-cli 没找到
- **解法**：去 Accio Work → Settings → Connected Accounts，断开飞书再重新连一次。如果还不行，跟开发说一声

**报错 C**：`[ERR] lark-cli bot identity check failed`
- 飞书没授权 bot 身份
- **解法**：Accio Work → Settings → Connected Accounts → 飞书 → 重新连接，授权时**全部勾选**

---

## ✅ 第 4 步：一键建表（2 分钟）

**复制粘贴**：
```powershell
python scripts/init.py
```

> 这一步会在你飞书里自动创建一个新的多维表 base，里面 4 张表 143 个字段全部建好。

### ✅ 顺利时应该看到（最后几行）
```
[OK] 创建表: 商品全生命周期 (95 字段)
[OK] 创建表: 失败事件流水 (15 字段)
[OK] 创建表: 批次仪表盘 (22 字段)
[OK] 创建表: 店铺账号池 (11 字段)
[OK] 写入 __SCHEMA__ 元数据行
[OK] base_info.json 已写入: output/base_info.json

+================ 建表成功 ================+
| base_token: WY6dbA1sCal6bKs1moXXXXXXXXX
| schema 版本: v3.2.0
| 4 张表 / 143 字段 全部就绪
| 飞书地址: https://feishu.cn/base/WY6dbA1sCal6bKs1moXXXXXXXXX
+==========================================+
```

### 立即去飞书确认一下

**复制最后那行的"飞书地址"** 粘贴到浏览器打开。应该看到一个空的多维表，左上角有 4 个 tab：商品全生命周期 / 失败事件流水 / 批次仪表盘 / 店铺账号池。

⚠️ **建议把这个飞书 base 重命名成有意义的名字**（比如「辰启-XX项目-2026」），右键 base 名 → 重命名。base 内部的 4 张表名**不要改**，下游技能按表名查找。

### ❌ 报错怎么办

**报错 A**：`API 报 permission denied`
- 飞书 bot 身份没权限
- **解法**：回到 Accio Work，断开飞书重连一次，确保**勾选了「在 base 中创建文档」权限**

**报错 B**：`表已存在` / `字段冲突`
- 你之前可能已经跑过 init.py 了
- **解法**：先去飞书把那个旧 base 删了（右键 base → 删除），再重跑 init.py。或者跑 `python scripts/migrate.py --check` 看看是不是只是差几个字段

---

## ✅ 第 5 步：录入第一家 Ozon 店铺（1 分钟）

### 5.1 准备 Ozon 凭证

去 Ozon 卖家后台拿这两个值（缺一不可）：
1. 登录 https://seller.ozon.ru
2. 右上角店铺名 → 「设置」→ 「API 密钥」（俄语：API ключи）
3. 抄下：
   - **Client ID**（一串数字，如 `4423400`）
   - **API Key**（一串字母数字混合，如 `0c5d2e8f-1234-...`）

### 5.2 交互式录入（推荐第一次用这个）

**复制粘贴**：
```powershell
python scripts/add_shop.py
```

### ✅ 它会一步步问你
```
=== 交互式录入店铺凭证 ===

店铺ID（唯一标识，如 shop_main / shop_aux1）: shop_main         ← 你输入
店铺名称（中文展示用）: 主店                                       ← 你输入
Client ID（Ozon 后台 → 设置 → API 密钥）: 4423400               ← 你输入
API Key: 0c5d2e8f-1234-abcd-...                                ← 你输入
每日配额（默认 100）:                                            ← 直接回车用默认 100
优先级（数字越小越优先，默认 1）:                                  ← 直接回车
状态（启用/暂停/封禁，默认 启用）:                                  ← 直接回车
备注（可选）:                                                    ← 直接回车

=== 待写入店铺 ===
  店铺ID: shop_main
  店铺名称: 主店
  client_id: 4423400
  api_key: 0c5d2e***...abcd
  每日配额: 100
  优先级: 1
  状态: 启用
  备注:

确认写入？(y/N): y                                              ← 输入 y 回车

[step] 调 lark-cli +record-upsert (create) ...
[OK] 写入成功 record_id=recvjlXXXXXX

[step] 回读确认 ...
[OK] 回读 店铺ID=shop_main，状态=启用, 配额=100

+== 完成 ==
| 新店铺已加入账号池：shop_main (主店)
| 当前账号池总数：1
+==========
```

### 5.3 多家店？再跑一次就好

每多录一家店就再跑一次 `python scripts/add_shop.py`，每次填一个**不同的店铺ID**就行。例如第二家：
- 店铺ID: `shop_aux1`
- 优先级: `2`（数字越小越优先用）

### ❌ 报错怎么办

**报错 A**：`[ERR] 店铺ID 'shop_main' 已存在`
- 你已经录过同名店铺了
- **解法**：换一个店铺ID（如 `shop_main2`），或者去飞书「店铺账号池」表手动删旧记录

---

## ✅ 第 6 步：完整性校验（30 秒）

跑完上面所有步骤后，做最后一次校验：

```powershell
python scripts/verify.py
```

### ✅ 顺利时应该看到
```
[CHECK] schema 版本一致性 ... [PASS] base_info=v3.2.0 vs SCHEMA=v3.2.0
[CHECK] 商品全生命周期 (95 字段) ... [PASS]
[CHECK] 失败事件流水 (15 字段) ... [PASS]
[CHECK] 批次仪表盘 (22 字段) ... [PASS]
[CHECK] 店铺账号池 (11 字段) ... [PASS]

[ALL PASS] base 完整，可以让下游技能使用了
```

看到 `[ALL PASS]` 就完工了 🎉。下游 7 个技能（选品 / 采集 / 翻译 / 图片 / 核价 / 上架 / 质检）现在可以开始用了。

---

## 🔁 常见后续操作

### 加新店铺
```powershell
python scripts/add_shop.py
# 按提示填即可
```

### Schema 升级（开发出新版本时）
```powershell
# 先看有没有要升的
python scripts/migrate.py --check

# 如果显示有可升级版本，跑这个：
python scripts/migrate.py --target latest
```

> ⚠️ **不要直接重跑 init.py 想加字段**——会报"表已存在"。升级必须走 migrate.py。

### 想完全重建（飞书 base 删了 / 想从头来）
1. 在飞书里删掉旧 base（右键 → 删除）
2. 删掉本地 `output/base_info.json` 文件
3. 重跑：`python scripts/init.py` → `python scripts/add_shop.py`

### 看每天哪家店配额还剩多少
```powershell
cd ..
python -c "import sys; sys.path.insert(0, '.'); from _chenqi_common.shop_pool import load_shops; import json; base = json.load(open('chenqi-lark-setup/output/base_info.json', encoding='utf-8'));  [print(f\"{s['店铺ID']:20s} status={s['状态']} 配额={s['每日配额']} 已用={s['今日已用']}\") for s in load_shops(base, force_refresh=True)]"
```

---

## 🆘 还是不行？

如果按文档跑还是失败，**直接在 Accio Work 里说**：

> "我跑 chenqi-lark-setup 的第 X 步报错，错误信息是 [贴完整报错]"

AI 会读这个文档 + 错误日志，告诉你具体怎么修。**不要自己改 schema/tables.py**——下游技能依赖固定字段名。

---

## 📁 跨账号 / 跨机器复用

要把这套搬到新机器或别人的账号上？

**必须拷的目录**：
```
agent-core/skills/chenqi-lark-setup/        ← 本目录全部（不含 output/）
agent-core/skills/_chenqi_common/           ← 公共模块（shop_pool 等）
```

**绝对不要拷的**：
- `output/base_info.json` ← 每个飞书 base 不同，新机器要重新 init.py 生成
- `_tmp/` ← 临时文件，可以删

**新机器步骤**（跟上面第 0~6 步完全一样）：
1. Accio Work 连接新账号的飞书
2. cd 进 chenqi-lark-setup 目录
3. setup_check → init → add_shop → verify

---

## 📚 想深入了解？

- **完整功能说明**：[SKILL.md](SKILL.md)
- **业务日规则**（为什么是凌晨 03:00 切日）：[SKILL.md](SKILL.md) 「业务日规则」章节
- **改 schema 怎么写新 migration**：[SKILL.md](SKILL.md) 「单一事实源」章节
