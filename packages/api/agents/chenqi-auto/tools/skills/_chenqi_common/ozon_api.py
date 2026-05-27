# -*- coding: utf-8 -*-
"""
辰启-公共模块：Ozon Seller API 封装（描述类目相关 4 接口）
权威源：agent-core/skills/_chenqi_common/ozon_api.py
被 chenqi-auto-translate / chenqi-listing 等下游技能 cp 到自己的 lib/ 下复用

只覆盖描述类目相关 API（不消耗每店每日业务配额，仅用凭证鉴权）：
  /v1/description-category/tree                        类目树
  /v1/description-category/attribute                   类目全属性（必+选）
  /v1/description-category/attribute/values            字典值（分页）
  /v1/description-category/attribute/values/search     字典值搜索（按值名）

设计：
  - 凭证池：从 shop_pool.pick_active_shop() 拿第一家启用店的 client_id+api_key
    （描述类目接口不消耗业务配额，不需 increment_used）
  - 7 天文件缓存（cat_id 维度 / attribute_id 维度）
  - 5/10/20s 指数退避（最多 3 次）
  - 仅依赖标准库 + urllib（无 requests）

接口：
  get_category_tree(base_info, cache_dir, language='RU') -> list[dict]
  get_category_attributes(base_info, cat_id, type_id, cache_dir,
                          attribute_type='ALL', language='RU') -> list[dict]
  get_attribute_values(base_info, cat_id, type_id, attribute_id, cache_dir,
                       language='RU', max_pages=20) -> list[dict]
  search_attribute_values(base_info, cat_id, type_id, attribute_id, value,
                          language='RU', limit=100) -> list[dict]   # 不缓存

  以及缓存维护：
  clear_cache(cache_dir, scope='all')

使用示例：
  from _chenqi_common.ozon_api import get_category_tree, get_category_attributes
  base_info = json.load(open('output/base_info.json'))
  tree = get_category_tree(base_info, 'cache/')
  attrs = get_category_attributes(base_info, cat_id=15621, type_id=970785923,
                                   cache_dir='cache/')
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# 让本模块可独立 import（被 cp 到下游 lib/ 后也能用）
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from _chenqi_common.shop_pool import pick_active_shop  # noqa: E402

# ====================================================================
# 常量
# ====================================================================
OZON_BASE = "https://api-seller.ozon.ru"
ENDPOINTS = {
    "tree":         "/v1/description-category/tree",
    "attribute":    "/v1/description-category/attribute",
    "values":       "/v1/description-category/attribute/values",
    "values_search":"/v1/description-category/attribute/values/search",
}
CACHE_TTL_SECONDS = 7 * 24 * 3600
HTTP_TIMEOUT = 30  # seconds
RETRY_DELAYS = [5, 10, 20]  # 限流退避（秒），共 3 次重试
MAX_VALUES_PER_PAGE = 5000  # /attribute/values 单页最大

# 进程内凭证缓存（避免每次都查 shop_pool）
_creds_cache = {"data": None, "ts": 0}
_CREDS_CACHE_TTL = 600  # 10 分钟


# ====================================================================
# 凭证管理
# ====================================================================
def _get_credentials(base_info):
    """
    取一个启用中的店铺凭证用于鉴权。
    描述类目接口不算业务配额，所以 need_quota=1 仅用于过滤"启用且未停用"。
    返回 (client_id, api_key)
    """
    now = time.time()
    if _creds_cache["data"] and now - _creds_cache["ts"] < _CREDS_CACHE_TTL:
        return _creds_cache["data"]

    shop = pick_active_shop(base_info, need_quota=1)
    creds = (str(shop["client_id"]), str(shop["api_key"]))
    _creds_cache["data"] = creds
    _creds_cache["ts"] = now
    return creds


# ====================================================================
# HTTP 调用 + 重试
# ====================================================================
def _post(base_info, endpoint_key, body):
    """
    调一次 Ozon Seller API。
    限流（429/5xx）走 5/10/20s 指数退避，最多 3 次重试。
    其它错误立刻抛。
    """
    if endpoint_key not in ENDPOINTS:
        raise ValueError(f"unknown endpoint key: {endpoint_key}")
    url = OZON_BASE + ENDPOINTS[endpoint_key]
    client_id, api_key = _get_credentials(base_info)
    headers = {
        "Client-Id": client_id,
        "Api-Key": api_key,
        "Content-Type": "application/json",
    }
    payload = json.dumps(body).encode("utf-8")

    last_err = None
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8")[:500]
            except Exception:
                pass
            last_err = f"HTTP {e.code}: {err_body}"
            # 429/5xx 重试
            if e.code in (429,) or 500 <= e.code < 600:
                if attempt < len(RETRY_DELAYS):
                    delay = RETRY_DELAYS[attempt]
                    print(f"  [WARN] Ozon API {endpoint_key} {e.code}, retry in {delay}s "
                          f"(attempt {attempt + 1}/{len(RETRY_DELAYS)})", file=sys.stderr)
                    time.sleep(delay)
                    continue
            raise RuntimeError(f"Ozon API {endpoint_key} failed: {last_err}")
        except urllib.error.URLError as e:
            last_err = str(e)
            if attempt < len(RETRY_DELAYS):
                delay = RETRY_DELAYS[attempt]
                print(f"  [WARN] Ozon API {endpoint_key} URLError {e}, retry in {delay}s",
                      file=sys.stderr)
                time.sleep(delay)
                continue
            raise RuntimeError(f"Ozon API {endpoint_key} URLError after retries: {last_err}")

    raise RuntimeError(f"Ozon API {endpoint_key} all retries exhausted: {last_err}")


# ====================================================================
# 缓存工具
# ====================================================================
def _cache_root(cache_dir):
    p = Path(cache_dir)
    (p / "ozon_category_tree").mkdir(parents=True, exist_ok=True)
    (p / "ozon_category_attrs").mkdir(parents=True, exist_ok=True)
    (p / "ozon_dict_values").mkdir(parents=True, exist_ok=True)
    return p


def _is_fresh(path, ttl=CACHE_TTL_SECONDS):
    if not path.exists():
        return False
    return (time.time() - path.stat().st_mtime) < ttl


def _read_cache(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _write_cache(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ====================================================================
# 主接口 1：类目树
# ====================================================================
def get_category_tree(base_info, cache_dir, language="RU", force_refresh=False):
    """
    取 Ozon 描述类目树（用于自家中文类目→Ozon 类目匹配）

    Returns:
      list[dict]：嵌套树结构。每节点 keys:
        description_category_id (int)
        category_name (str)
        disabled (bool)
        children (list)
        type_id / type_name (仅叶子)

    缓存：cache_dir/ozon_category_tree/{language}.json，TTL 7 天
    """
    cache_path = _cache_root(cache_dir) / "ozon_category_tree" / f"{language}.json"
    if not force_refresh and _is_fresh(cache_path):
        cached = _read_cache(cache_path)
        if cached is not None:
            return cached.get("result", cached)

    data = _post(base_info, "tree", {"language": language})
    result = data.get("result", [])
    _write_cache(cache_path, {
        "language": language,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "result": result,
    })
    return result


# ====================================================================
# 主接口 2：类目全属性（必+选）
# ====================================================================
def get_category_attributes(base_info, cat_id, type_id, cache_dir,
                             attribute_type="ALL", language="RU",
                             force_refresh=False):
    """
    拉指定类目+商品类型的全部属性（默认 ALL = 必+选）

    Args:
      cat_id: description_category_id (叶子类目 ID)
      type_id: 商品类型 ID（在类目树叶子节点上）
      attribute_type: ALL / REQUIRED / OPTIONAL（默认 ALL，按 v3.2.0 决策"全部都拉"）
      language: RU/EN/CN

    Returns:
      list[dict]：每属性 keys:
        id (int) - attribute_id
        name (str)
        description (str)
        type (str) - String/Integer/Decimal/Boolean/multiline/...
        dictionary_id (int) - 0 表示无字典（自由文本/数值）
        is_required (bool)
        is_aspect (bool) - 区分 SKU 的特征（颜色/尺寸）
        is_collection (bool) - 多值
        max_value_count (int)
        group_id (int)
        group_name (str)
        category_dependent (bool)
        attribute_complex_id (int)

    缓存：cache_dir/ozon_category_attrs/{cat_id}_{type_id}_{language}_{attribute_type}.json
    """
    key = f"{cat_id}_{type_id}_{language}_{attribute_type}"
    cache_path = _cache_root(cache_dir) / "ozon_category_attrs" / f"{key}.json"
    if not force_refresh and _is_fresh(cache_path):
        cached = _read_cache(cache_path)
        if cached is not None:
            return cached.get("result", cached)

    body = {
        "description_category_id": int(cat_id),
        "type_id": int(type_id),
        "attribute_type": attribute_type,
        "language": language,
    }
    data = _post(base_info, "attribute", body)
    result = data.get("result", [])
    _write_cache(cache_path, {
        "cat_id": int(cat_id),
        "type_id": int(type_id),
        "language": language,
        "attribute_type": attribute_type,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "n_attrs": len(result),
        "result": result,
    })
    return result


# ====================================================================
# 主接口 3：属性字典值（自动翻页）
# ====================================================================
def get_attribute_values(base_info, cat_id, type_id, attribute_id, cache_dir,
                          language="RU", max_pages=20, force_refresh=False):
    """
    拉指定属性的字典值（如颜色/材质枚举）。自动翻页直到 has_next=false 或 max_pages

    Args:
      attribute_id: attribute id（dictionary_id != 0 才有意义；==0 时调用会返回空）

    Returns:
      list[dict]：每值 keys:
        id (int) - dict_value_id（写商品时填这个）
        value (str) - 显示名
        info (str) - 说明
        picture (str) - 图片 URL
    """
    key = f"{cat_id}_{type_id}_{attribute_id}_{language}"
    cache_path = _cache_root(cache_dir) / "ozon_dict_values" / f"{key}.json"
    if not force_refresh and _is_fresh(cache_path):
        cached = _read_cache(cache_path)
        if cached is not None:
            return cached.get("result", cached)

    all_values = []
    last_value_id = 0
    pages = 0
    while pages < max_pages:
        body = {
            "attribute_id": int(attribute_id),
            "description_category_id": int(cat_id),
            "type_id": int(type_id),
            "language": language,
            "last_value_id": last_value_id,
            "limit": MAX_VALUES_PER_PAGE,
        }
        data = _post(base_info, "values", body)
        page = data.get("result", [])
        all_values.extend(page)
        pages += 1
        if not data.get("has_next") or not page:
            break
        last_value_id = page[-1].get("id", 0)
        if last_value_id == 0:
            break

    _write_cache(cache_path, {
        "cat_id": int(cat_id),
        "type_id": int(type_id),
        "attribute_id": int(attribute_id),
        "language": language,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "n_values": len(all_values),
        "n_pages": pages,
        "result": all_values,
    })
    return all_values


# ====================================================================
# 主接口 4：字典值名称搜索（不缓存，按需查）
# ====================================================================
def search_attribute_values(base_info, cat_id, type_id, attribute_id, value,
                             language="RU", limit=100):
    """
    按值名搜索字典（用于"已知中文颜色 -> 找最近的俄语字典值"）

    注意：不缓存，按需调用。
    返回结构同 get_attribute_values 单页
    """
    if len(value) < 2:
        raise ValueError("search value must be >= 2 chars")
    body = {
        "attribute_id": int(attribute_id),
        "description_category_id": int(cat_id),
        "type_id": int(type_id),
        "value": value,
        "limit": int(limit),
        "language": language,
    }
    data = _post(base_info, "values_search", body)
    return data.get("result", [])


# ====================================================================
# 缓存维护
# ====================================================================
def clear_cache(cache_dir, scope="all"):
    """
    清缓存
    scope: all / tree / attrs / values
    返回：删除文件数
    """
    root = Path(cache_dir)
    targets = []
    if scope in ("all", "tree"):
        targets.append(root / "ozon_category_tree")
    if scope in ("all", "attrs"):
        targets.append(root / "ozon_category_attrs")
    if scope in ("all", "values"):
        targets.append(root / "ozon_dict_values")

    n = 0
    for t in targets:
        if not t.exists():
            continue
        for f in t.glob("*.json"):
            f.unlink()
            n += 1
    return n


# ====================================================================
# CLI 自测
# ====================================================================
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-info", default="output/base_info.json",
                        help="base_info.json 路径")
    parser.add_argument("--cache-dir", default="cache",
                        help="缓存目录")
    parser.add_argument("--action", required=True,
                        choices=["tree", "attrs", "values", "search", "clear"])
    parser.add_argument("--cat-id", type=int, default=0)
    parser.add_argument("--type-id", type=int, default=0)
    parser.add_argument("--attr-id", type=int, default=0)
    parser.add_argument("--value", default="")
    parser.add_argument("--language", default="RU")
    parser.add_argument("--attribute-type", default="ALL",
                        choices=["ALL", "REQUIRED", "OPTIONAL"])
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--scope", default="all",
                        choices=["all", "tree", "attrs", "values"])
    args = parser.parse_args()

    info = json.loads(Path(args.base_info).read_text(encoding="utf-8"))

    if args.action == "tree":
        tree = get_category_tree(info, args.cache_dir, args.language, force_refresh=args.force)
        # 打前 5 个一级节点
        print(f"[OK] 类目树根节点 {len(tree)} 个，前 5 个：")
        for node in tree[:5]:
            print(f"  cat_id={node.get('description_category_id')} "
                  f"name={node.get('category_name')!r} "
                  f"disabled={node.get('disabled')} "
                  f"n_children={len(node.get('children', []))}")

    elif args.action == "attrs":
        if not args.cat_id or not args.type_id:
            print("[ERR] attrs 需要 --cat-id 和 --type-id")
            sys.exit(1)
        attrs = get_category_attributes(info, args.cat_id, args.type_id,
                                          args.cache_dir,
                                          attribute_type=args.attribute_type,
                                          language=args.language,
                                          force_refresh=args.force)
        n_req = sum(1 for a in attrs if a.get("is_required"))
        n_dict = sum(1 for a in attrs if a.get("dictionary_id"))
        n_aspect = sum(1 for a in attrs if a.get("is_aspect"))
        print(f"[OK] cat_id={args.cat_id} type_id={args.type_id} "
              f"-> {len(attrs)} 属性 (必填 {n_req} / 带字典 {n_dict} / aspect {n_aspect})")
        print(f"\n前 10 个属性：")
        for a in attrs[:10]:
            mark = "*" if a.get("is_required") else " "
            dt = "D" if a.get("dictionary_id") else "-"
            asp = "A" if a.get("is_aspect") else "-"
            print(f"  {mark}{dt}{asp}  id={a.get('id'):>6}  {a.get('name', '')[:40]:<40}  "
                  f"type={a.get('type', '')[:8]:<8}  group={a.get('group_name', '')[:20]}")

    elif args.action == "values":
        if not args.cat_id or not args.type_id or not args.attr_id:
            print("[ERR] values 需要 --cat-id, --type-id, --attr-id")
            sys.exit(1)
        vals = get_attribute_values(info, args.cat_id, args.type_id, args.attr_id,
                                     args.cache_dir, language=args.language,
                                     force_refresh=args.force)
        print(f"[OK] attr_id={args.attr_id} -> {len(vals)} 字典值，前 10 个：")
        for v in vals[:10]:
            print(f"  id={v.get('id'):>10}  {v.get('value', '')[:50]}")

    elif args.action == "search":
        if not args.cat_id or not args.type_id or not args.attr_id or not args.value:
            print("[ERR] search 需要 --cat-id, --type-id, --attr-id, --value")
            sys.exit(1)
        vals = search_attribute_values(info, args.cat_id, args.type_id, args.attr_id,
                                          args.value, language=args.language)
        print(f"[OK] search '{args.value}' -> {len(vals)} 命中：")
        for v in vals[:20]:
            print(f"  id={v.get('id'):>10}  {v.get('value', '')[:50]}")

    elif args.action == "clear":
        n = clear_cache(args.cache_dir, scope=args.scope)
        print(f"[OK] cleared {n} cache files (scope={args.scope})")
