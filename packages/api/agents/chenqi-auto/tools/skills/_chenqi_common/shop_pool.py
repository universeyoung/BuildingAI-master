# -*- coding: utf-8 -*-
"""
辰启-公共模块：店铺账号池
权威源：agent-core/skills/_chenqi_common/shop_pool.py
被 chenqi-auto-translate / chenqi-listing 等下游技能 cp 到自己的 lib/ 下复用

接口：
  load_shops(base_info, force_refresh=False) -> list[dict]
  pick_active_shop(base_info, need_quota=1) -> dict
  increment_used(base_info, shop_id, n) -> int (today_used 新值)
  reset_if_new_day(base_info, shop_id) -> bool

业务日定义：
  Ozon 平台配额按"北京时间凌晨 3:00"刷新，本模块的"今日已用"
  归属于业务日 = [当日 03:00, 次日 03:00) 区间（用区间起点的日期作标识）。
  跨过 03:00 时自动 reset 今日已用 = 0。

依赖：
  - 标准库 + subprocess 调用 lark-cli
  - base_info dict 必须含 base_token + tables.店铺账号池.{table_id, fields}

使用示例：
  from lib.shop_pool import load_shops, pick_active_shop
  base_info = json.load(open('output/base_info.json'))
  shop = pick_active_shop(base_info, need_quota=3)
  print(shop['client_id'], shop['api_key'])
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path


# ====================================================================
# 公共：lark-cli 路径探测（所有 chenqi skill 共用唯一权威源）
# ====================================================================
def find_lark_cli():
    """
    优先级：LARK_CLI 环境变量 > PATH(lark.exe / lark-cli.cmd / lark-cli)
          > Accio pre-install 全版本扫描（兼容新 lark.exe / 旧 node/lark-cli.cmd）

    Accio 客户端会随版本升级换 pre-install 的版本目录名（hash），
    本函数自动扫描所有版本目录，找最新可用的入口。

    Returns: 绝对路径字符串
    Raises: RuntimeError 找不到时
    """
    # 1) 环境变量最高优先
    env = os.environ.get("LARK_CLI")
    if env and os.path.exists(env):
        return env

    # 2) PATH 里找（新 lark.exe 优先 → 旧 lark-cli.cmd → 通用 lark-cli）
    for name in ("lark.exe", "lark-cli.cmd", "lark-cli"):
        p = shutil.which(name)
        if p:
            return p

    # 3) Accio pre-install 自动扫描全版本目录（按修改时间倒序，新版本先用）
    base = os.path.expandvars(r"%APPDATA%\Accio\pre-install")
    if os.path.isdir(base):
        version_dirs = sorted(
            (os.path.join(base, d) for d in os.listdir(base)
             if os.path.isdir(os.path.join(base, d))),
            key=lambda p: os.path.getmtime(p),
            reverse=True,
        )
        for vdir in version_dirs:
            for cand in (
                os.path.join(vdir, "lark.exe"),               # 新版（v1.0.0+）
                os.path.join(vdir, "node", "lark-cli.cmd"),   # 旧版
                os.path.join(vdir, "node", "lark-cli"),       # 旧版 unix-like
            ):
                if os.path.exists(cand):
                    return cand

    raise RuntimeError(
        "未找到 lark-cli。请检查：\n"
        "  1) 已通过 Accio 连接飞书账号（Connected Accounts）\n"
        "  2) 或手动设置环境变量：set LARK_CLI=C:\\path\\to\\lark.exe\n"
        f"  3) 已扫描目录：{base}"
    )


# ====================================================================
# 配置
# ====================================================================
# 延迟到首次调用：避免 import 时就因 lark-cli 缺失而报错
LARK_CLI = os.environ.get("LARK_CLI") or None
SHOP_TABLE_NAME = "店铺账号池"
CACHE_TTL_SECONDS = 300  # 5 分钟
BJ_TZ = timezone(timedelta(hours=8))  # 北京时间

# Ozon 平台配额刷新时刻：北京时间凌晨 3:00（对齐 Ozon 后台日切）
# "业务日"定义：当日凌晨 3:00 ~ 次日凌晨 3:00 区间，统一标记为前一天的"业务日期"
QUOTA_RESET_HOUR_BJ = 3

# 进程内缓存
_shops_cache = {"data": None, "ts": 0}


# ====================================================================
# 内部工具
# ====================================================================
def _lark(*args):
    """组装 [lark-cli, base, ...args]；首次调用时解析路径并缓存到 LARK_CLI"""
    global LARK_CLI
    if not LARK_CLI:
        LARK_CLI = find_lark_cli()
    return [LARK_CLI, "base", *args]


def _run(cmd, cwd=None):
    """跑 lark-cli，返回 ok 字典"""
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8",
        env=env, cwd=cwd,
    )
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise RuntimeError(
            f"lark-cli non-JSON: {result.stdout[:300]}\n"
            f"stderr: {result.stderr[:300]}"
        )
    if not data.get("ok"):
        raise RuntimeError(
            f"lark-cli error: {data.get('error', {}).get('message', 'unknown')}"
        )
    return data.get("data", data)


def _cell(v):
    """飞书 record-list 的单元格值通常是 list[str/dict]，统一取出"""
    if isinstance(v, list) and v:
        x = v[0]
        if isinstance(x, str):
            return x
        if isinstance(x, dict):
            return x.get("text") or x.get("name") or str(x)
        return str(x)
    return v


def _get_shop_table_meta(base_info):
    """从 base_info 取店铺池表的 table_id"""
    tables = base_info.get("tables", {})
    if SHOP_TABLE_NAME not in tables:
        raise RuntimeError(
            f"base_info.tables 没找到「{SHOP_TABLE_NAME}」，"
            f"请先跑 chenqi-lark-setup/scripts/add_shop_pool.py"
        )
    meta = tables[SHOP_TABLE_NAME]
    return meta["table_id"]


def _business_day_bj(now=None):
    """
    返回当前所属"业务日" = 北京时间当日凌晨 3:00 ~ 次日凌晨 3:00 的区间，
    用区间起点的日期 (YYYY-MM-DD) 作为标识。

    例：
      BJ 5/12 02:30  → 业务日 5/11（还在 5/11 03:00 ~ 5/12 03:00 区间）
      BJ 5/12 03:00  → 业务日 5/12（新一天开始）
      BJ 5/12 14:00  → 业务日 5/12
    """
    now = now or datetime.now(BJ_TZ)
    if now.hour < QUOTA_RESET_HOUR_BJ:
        biz = now - timedelta(days=1)
    else:
        biz = now
    return biz.strftime("%Y-%m-%d")


def _business_day_start_iso(now=None):
    """
    返回当前业务日的起点（北京时间 当日 03:00:00）的 ISO 字符串。
    写飞书 dateTime 字段时用这个值，方便后续直观对齐 Ozon 重置点。
    """
    now = now or datetime.now(BJ_TZ)
    if now.hour < QUOTA_RESET_HOUR_BJ:
        biz_date = (now - timedelta(days=1)).date()
    else:
        biz_date = now.date()
    start = datetime(
        biz_date.year, biz_date.month, biz_date.day,
        QUOTA_RESET_HOUR_BJ, 0, 0, tzinfo=BJ_TZ
    )
    return start.isoformat()


# === 历史命名兼容别名（旧调用点过渡用） ===
_today_str_bj = _business_day_bj
_today_dt_bj_iso = _business_day_start_iso


# ====================================================================
# 公开接口
# ====================================================================
def load_shops(base_info, force_refresh=False):
    """
    拉取店铺池全量列表（带 5min 进程内缓存）

    返回：list[dict]，每项含 record_id + 全部业务字段
    """
    now = time.time()
    if (
        not force_refresh
        and _shops_cache["data"] is not None
        and now - _shops_cache["ts"] < CACHE_TTL_SECONDS
    ):
        return _shops_cache["data"]

    base_token = base_info["base_token"]
    table_id = _get_shop_table_meta(base_info)

    data = _run(_lark(
        "+record-list", "--as", "bot",
        "--base-token", base_token,
        "--table-id", table_id,
        "--limit", "200",
    ))

    fields = data.get("fields", [])  # list of str
    rows = data.get("data", [])      # list of list
    record_ids = data.get("record_id_list", [])

    shops = []
    for rid, row in zip(record_ids, rows):
        item = {"record_id": rid}
        for fname, val in zip(fields, row):
            item[fname] = _cell(val)
        # 类型修正
        for k in ("每日配额", "今日已用", "优先级"):
            v = item.get(k)
            if isinstance(v, str) and v.replace(".", "").isdigit():
                item[k] = float(v) if "." in v else int(v)
        shops.append(item)

    _shops_cache["data"] = shops
    _shops_cache["ts"] = now
    return shops


def reset_if_new_day(base_info, shop_id):
    """
    检查指定店铺的「计数日期」是否是今天，不是则清零今日已用 + 更新计数日期

    返回：True 表示做了 reset
    """
    shops = load_shops(base_info, force_refresh=True)
    target = next((s for s in shops if s.get("店铺ID") == shop_id), None)
    if not target:
        raise RuntimeError(f"店铺 {shop_id} 不存在")

    count_date = target.get("计数日期", "")
    today_biz = _business_day_bj()  # 当前业务日（按凌晨 3 点切日）
    # 飞书返回 UTC 字符串 ("2026-05-11 16:00:00")，转回 BJ + 按业务日规则归属
    cd_biz_day = ""
    if count_date:
        try:
            # 兼容 "2026-05-11 16:00:00" / "2026-05-11T16:00:00" / "2026-05-11T16:00:00Z"
            s = count_date.replace("T", " ").replace("Z", "").strip()[:19]
            dt_utc = datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            dt_bj = dt_utc.astimezone(BJ_TZ)
            cd_biz_day = _business_day_bj(dt_bj)
        except Exception:
            cd_biz_day = ""
    if cd_biz_day == today_biz:
        return False

    # 跨业务日，reset 配额
    base_token = base_info["base_token"]
    table_id = _get_shop_table_meta(base_info)
    payload = {
        "今日已用": 0,
        "计数日期": _business_day_start_iso(),
    }
    _run(_lark(
        "+record-upsert", "--as", "bot",
        "--base-token", base_token,
        "--table-id", table_id,
        "--record-id", target["record_id"],
        "--json", json.dumps(payload, ensure_ascii=False),
    ))
    # 失效缓存
    _shops_cache["data"] = None
    return True


def pick_active_shop(base_info, need_quota=1):
    """
    挑当前可用的店铺：
      1. 状态=启用
      2. 今日剩余 (= 每日配额 - 今日已用) >= need_quota
      3. 按优先级升序

    自动跨日 reset。

    返回：dict（店铺信息），失败抛 RuntimeError
    """
    shops = load_shops(base_info)
    enabled = [s for s in shops if s.get("状态") == "启用"]
    if not enabled:
        raise RuntimeError("店铺池没有启用中的店铺")

    # 跨日 reset 所有启用店
    for s in enabled:
        try:
            reset_if_new_day(base_info, s["店铺ID"])
        except Exception as e:
            print(f"  [WARN] reset {s['店铺ID']} 失败：{e}", file=sys.stderr)

    # reset 后重拉
    shops = load_shops(base_info, force_refresh=True)
    enabled = [s for s in shops if s.get("状态") == "启用"]

    candidates = []
    for s in enabled:
        quota = int(s.get("每日配额") or 0)
        used = int(s.get("今日已用") or 0)
        remaining = quota - used
        if remaining >= need_quota:
            candidates.append((int(s.get("优先级") or 999), s, remaining))

    if not candidates:
        raise RuntimeError(
            f"店铺池所有店今日剩余配额都不足 {need_quota}，"
            f"请等明日 0 点重置或扩容"
        )

    candidates.sort(key=lambda x: x[0])
    _, picked, remaining = candidates[0]
    picked["_today_remaining"] = remaining
    return picked


def increment_used(base_info, shop_id, n=1):
    """
    给指定店铺的「今日已用」+n（同时更新最后切店时间）

    返回：今日已用的新值
    """
    shops = load_shops(base_info, force_refresh=True)
    target = next((s for s in shops if s.get("店铺ID") == shop_id), None)
    if not target:
        raise RuntimeError(f"店铺 {shop_id} 不存在")

    cur_used = int(target.get("今日已用") or 0)
    new_used = cur_used + n

    base_token = base_info["base_token"]
    table_id = _get_shop_table_meta(base_info)
    payload = {
        "今日已用": new_used,
        "最后切店时间": datetime.now(BJ_TZ).isoformat(timespec="seconds"),
    }
    _run(_lark(
        "+record-upsert", "--as", "bot",
        "--base-token", base_token,
        "--table-id", table_id,
        "--record-id", target["record_id"],
        "--json", json.dumps(payload, ensure_ascii=False),
    ))
    _shops_cache["data"] = None
    return new_used


# ====================================================================
# CLI 自测
# ====================================================================
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-info", default="output/base_info.json",
                        help="base_info.json 路径")
    parser.add_argument("--action", choices=["list", "pick", "test"],
                        default="test", help="动作")
    parser.add_argument("--need", type=int, default=1)
    args = parser.parse_args()

    info = json.loads(Path(args.base_info).read_text(encoding="utf-8"))

    if args.action == "list":
        shops = load_shops(info)
        print(f"== 店铺池：{len(shops)} 家 ==")
        for s in shops:
            print(f"  [{s.get('优先级')}] {s.get('店铺ID')} ({s.get('店铺名称')}) "
                  f"状态={s.get('状态')} 配额={s.get('每日配额')} "
                  f"已用={s.get('今日已用')} 计数日期={s.get('计数日期', '')[:10]}")
    elif args.action == "pick":
        picked = pick_active_shop(info, need_quota=args.need)
        print(f"== 选中：{picked.get('店铺ID')} ==")
        print(f"  client_id: {picked.get('client_id')}")
        print(f"  api_key:   {picked.get('api_key')[:8]}***")
        print(f"  优先级:    {picked.get('优先级')}")
        print(f"  今日剩余:  {picked.get('_today_remaining')}")
    elif args.action == "test":
        # 端到端测试
        print("[1/4] 跨日 reset 检查 shop_main")
        did_reset = reset_if_new_day(info, "shop_main")
        print(f"  reset_done={did_reset}")

        print("\n[2/4] load_shops")
        shops = load_shops(info, force_refresh=True)
        print(f"  shops={len(shops)}")

        print("\n[3/4] pick_active_shop(need=3)")
        picked = pick_active_shop(info, need_quota=3)
        print(f"  picked={picked['店铺ID']} client_id={picked['client_id']}")

        print("\n[4/4] increment_used(+1) 然后 -1 复原")
        new_used = increment_used(info, picked["店铺ID"], n=1)
        print(f"  +1 -> {new_used}")
        new_used = increment_used(info, picked["店铺ID"], n=-1)
        print(f"  -1 -> {new_used}")

        print("\n[OK] 全部测试通过")
