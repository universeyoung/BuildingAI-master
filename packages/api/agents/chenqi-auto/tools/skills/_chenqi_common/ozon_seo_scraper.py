# -*- coding: utf-8 -*-
"""
辰启-公共模块：Ozon SEO 词抓取与计算
权威源：agent-core/skills/_chenqi_common/ozon_seo_scraper.py
被 chenqi-auto-translate / chenqi-listing 等下游技能 cp 到自己的 lib/ 下复用

设计：浏览器爬数据 + Python 算 SEO，两阶段解耦
  - Python 端: 缓存读写 / 任务清单生成 / TF-IDF 计算 / 结果落盘
  - Browser 端: ozon_seo_extract.js 由 sub-agent 注入到 Ozon 搜索页 / 类目页

接口：
  get_seo_keywords(cat_id, ru_keyword, cache_dir) -> dict
    返回 {hit: bool, keywords: [...], pending_job: {...} | None}
    hit=True : 命中缓存，直接返回 keywords
    hit=False: 没命中，pending_job 是浏览器要做的任务清单

  ingest_titles(cat_id, ru_keyword, titles, cache_dir, source) -> dict
    Agent 把浏览器抓到的标题塞进来：分词 + TF-IDF + 写缓存
    返回 {keywords: [...], n_titles: int, n_terms: int}

  list_pending_jobs(cache_dir) -> list[dict]
    列出所有 pending_seo_jobs，给 warmup_seo.py 批量预热用

  drop_pending_job(cat_id, cache_dir)
    成功 ingest 后删 pending 标记

业务规则：
  - 缓存 TTL: 7 天
  - 每个类目要爬两个 URL: 搜索页 (用俄语关键词) + 类目页 (用 cat_id)
  - 标题 ≥30 条才认为有效
  - TF-IDF 取 top 20 词
  - 俄语停用词内置（无外部依赖）

依赖：仅标准库
"""
import json
import math
import os
import re
import time
from collections import Counter
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

# ====================================================================
# 常量
# ====================================================================
CACHE_TTL_SECONDS = 7 * 24 * 3600
MIN_TITLES = 30
TOP_KEYWORDS = 20
SEARCH_URL_TPL = "https://www.ozon.ru/search/?text={kw}&from_global=true"
CATEGORY_URL_TPL = "https://www.ozon.ru/category/{slug}-{cat_id}/"

# JS 提取脚本相对本文件的路径
_HERE = Path(__file__).resolve().parent
JS_EXTRACT_PATH = _HERE / "ozon_seo_extract.js"

# 俄语停用词（精简版，覆盖代词/介词/连词/常见量词，不含产品类高频词）
RU_STOPWORDS = set("""
и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь эту эта мой о хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между этих какие какая какое какие так зачем кто что какая какие какой какое
""".split())

# 数量词单位（保留为 SEO 词意义不大）
RU_UNITS = set("""
мл г кг см мм м л шт ml g kg cm mm m l см² см³
""".split())

# 高价值修饰词白名单（即使是常见词，权重提升）
RU_HIGH_VALUE = {
    "для", "с", "из", "на", "под",  # 介词单独是停用词，组合短语另说
}


# ====================================================================
# 工具：缓存路径管理
# ====================================================================
def _cache_root(cache_dir):
    p = Path(cache_dir)
    p.mkdir(parents=True, exist_ok=True)
    (p / "ozon_seo_keywords").mkdir(exist_ok=True)
    (p / "_pending_seo_jobs").mkdir(exist_ok=True)
    return p


def _seo_cache_path(cache_dir, cat_id):
    return _cache_root(cache_dir) / "ozon_seo_keywords" / f"{cat_id}.json"


def _pending_path(cache_dir, cat_id):
    return _cache_root(cache_dir) / "_pending_seo_jobs" / f"{cat_id}.json"


def _is_fresh(path, ttl=CACHE_TTL_SECONDS):
    if not path.exists():
        return False
    age = time.time() - path.stat().st_mtime
    return age < ttl


# ====================================================================
# 主接口 1: 取 SEO 词（带缓存）
# ====================================================================
def get_seo_keywords(cat_id, ru_keyword, cache_dir, slug=None):
    """
    优先读缓存；不命中就生成 pending_job 写到 _pending_seo_jobs/。
    Agent 拿到 pending_job 后 spawn browser sub-agent 跑两个 URL，
    抓回来的 titles 用 ingest_titles 塞回。

    Args:
      cat_id: Ozon 类目 ID（int 或 str），缓存文件名用
      ru_keyword: 俄语类目名/搜索词（如 "термокружка"）
      cache_dir: 缓存根目录（绝对路径）
      slug: 类目 URL slug（如 "posuda"），可选；缺则只爬搜索页

    Returns:
      {
        "hit": bool,
        "keywords": [...] | None,    # hit=True 时填
        "cached_at": ISO 时间 | None,
        "pending_job": {             # hit=False 时填
          "cat_id": ...,
          "ru_keyword": ...,
          "urls": [搜索页URL, 类目页URL?],
          "js_extract_path": <ozon_seo_extract.js 绝对路径>,
          "instruction": "Agent 操作步骤说明（中文）",
        } | None,
      }
    """
    cat_id = str(cat_id)
    cache_path = _seo_cache_path(cache_dir, cat_id)
    if _is_fresh(cache_path):
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            return {
                "hit": True,
                "keywords": data.get("keywords", []),
                "cached_at": data.get("cached_at"),
                "pending_job": None,
            }
        except Exception:
            pass  # 缓存坏了当 miss

    # 缓存 miss：生成 pending job
    urls = [SEARCH_URL_TPL.format(kw=quote_plus(ru_keyword))]
    if slug:
        urls.append(CATEGORY_URL_TPL.format(slug=slug, cat_id=cat_id))

    job = {
        "cat_id": cat_id,
        "ru_keyword": ru_keyword,
        "slug": slug,
        "urls": urls,
        "js_extract_path": str(JS_EXTRACT_PATH),
        "created_at_ms": int(time.time() * 1000),
        "instruction": (
            "对每个 URL: navigate -> 等 3-5s 让商品卡加载 -> scroll 到底部触发 lazy load "
            "-> 注入 ozon_seo_extract.js -> 拿返回的 JSON.titles -> "
            "用 ingest_titles(cat_id, ru_keyword, titles_合并, cache_dir, source='browser') 塞回"
        ),
    }
    _pending_path(cache_dir, cat_id).write_text(
        json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return {
        "hit": False,
        "keywords": None,
        "cached_at": None,
        "pending_job": job,
    }


# ====================================================================
# 主接口 2: 喂入 titles 算 SEO 词并落盘
# ====================================================================
def ingest_titles(cat_id, ru_keyword, titles, cache_dir, source="browser"):
    """
    Agent 把浏览器抓到的标题塞进来，本函数：
      1. 去重 + 清洗
      2. 俄语分词 (re-based)
      3. 计算词频（单字+二元短语都算）
      4. 过滤停用词 / 数量词 / 数字
      5. 取 top 20，写缓存，删 pending

    Returns:
      {keywords: [...], n_titles: int, n_terms_after_filter: int}
    """
    cat_id = str(cat_id)
    if not titles:
        raise ValueError("titles is empty")

    # 1. 去重
    titles_clean = list({t.strip() for t in titles if t and t.strip()})
    if len(titles_clean) < MIN_TITLES:
        # 不强制失败，但记录警告
        warn = f"titles count {len(titles_clean)} < MIN_TITLES {MIN_TITLES}"
    else:
        warn = None

    # 2. 分词：俄语 SEO 词，必须含至少 1 个西里尔字母（过滤纯英文词如 "with"）
    # 词长 >= 3
    word_pat = re.compile(r"[А-Яа-яЁёA-Za-z]{3,}", re.UNICODE)
    cyrillic_pat = re.compile(r"[А-Яа-яЁё]")
    unigrams = Counter()
    bigrams = Counter()
    for t in titles_clean:
        words = [w.lower() for w in word_pat.findall(t)]
        # 过滤：停用词 + 单位 + 纯英文词（无西里尔字母）
        words_kept = [w for w in words if w not in RU_STOPWORDS and w not in RU_UNITS and cyrillic_pat.search(w)]
        unigrams.update(words_kept)
        # 相邻二元短语（用原序列，包括停用词作连接如 "для дома"）
        for i in range(len(words) - 1):
            w1, w2 = words[i], words[i + 1]
            # 二元短语跳过两个都是停用词的情况
            if w1 in RU_STOPWORDS and w2 in RU_STOPWORDS:
                continue
            # 允许 "для X" 形式（для 是高价值前缀）
            if w1 in RU_STOPWORDS and w1 not in {"для", "из", "с"}:
                continue
            bigrams[f"{w1} {w2}"] += 1

    # 3. 过滤低频（<2 不要）
    unigrams = {w: c for w, c in unigrams.items() if c >= 2}
    bigrams = {w: c for w, c in bigrams.items() if c >= 2}

    # 4. TF: 简单频次（同一类目内所有标题视为同一文档集）
    # 这里不算 IDF（缺全局语料），用频次代替；二元短语权重 ×1.5（信息量高）
    scored = []
    for w, c in unigrams.items():
        scored.append((w, c, "uni"))
    for w, c in bigrams.items():
        scored.append((w, c * 1.5, "bi"))

    scored.sort(key=lambda x: -x[1])
    top = scored[:TOP_KEYWORDS]

    keywords = [{"term": w, "score": round(s, 2), "type": tp} for w, s, tp in top]

    # 5. 落盘
    out = {
        "cat_id": cat_id,
        "ru_keyword": ru_keyword,
        "source": source,
        "n_titles": len(titles_clean),
        "n_unigrams": len(unigrams),
        "n_bigrams": len(bigrams),
        "warn": warn,
        "keywords": keywords,
        "cached_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "cached_at_ms": int(time.time() * 1000),
    }
    cache_path = _seo_cache_path(cache_dir, cat_id)
    cache_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    # 删 pending
    p = _pending_path(cache_dir, cat_id)
    if p.exists():
        p.unlink()

    return {
        "keywords": keywords,
        "n_titles": len(titles_clean),
        "n_terms_after_filter": len(scored),
        "cache_path": str(cache_path),
        "warn": warn,
    }


# ====================================================================
# 主接口 3: 列出所有待爬任务（warmup 用）
# ====================================================================
def list_pending_jobs(cache_dir):
    """列出 _pending_seo_jobs/ 下所有未完成任务"""
    root = _cache_root(cache_dir) / "_pending_seo_jobs"
    if not root.exists():
        return []
    out = []
    for p in sorted(root.glob("*.json")):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    return out


def drop_pending_job(cat_id, cache_dir):
    """成功 ingest 后调（ingest_titles 内部已自动删，这里给手动清理用）"""
    p = _pending_path(cache_dir, str(cat_id))
    if p.exists():
        p.unlink()
        return True
    return False


# ====================================================================
# 调试/独立调用：python -m _chenqi_common.ozon_seo_scraper <cmd>
# ====================================================================
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print(
            "Usage:\n"
            "  python ozon_seo_scraper.py request <cat_id> <ru_keyword> <cache_dir> [slug]\n"
            "  python ozon_seo_scraper.py ingest <cat_id> <ru_keyword> <cache_dir> <titles_json_path>\n"
            "  python ozon_seo_scraper.py pending <cache_dir>\n"
            "  python ozon_seo_scraper.py show <cat_id> <cache_dir>"
        )
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "request":
        cat_id = sys.argv[2]
        ru_kw = sys.argv[3]
        cache = sys.argv[4]
        slug = sys.argv[5] if len(sys.argv) > 5 else None
        r = get_seo_keywords(cat_id, ru_kw, cache, slug=slug)
        print(json.dumps(r, ensure_ascii=False, indent=2))

    elif cmd == "ingest":
        cat_id = sys.argv[2]
        ru_kw = sys.argv[3]
        cache = sys.argv[4]
        titles_path = sys.argv[5]
        titles = json.loads(Path(titles_path).read_text(encoding="utf-8"))
        if isinstance(titles, dict) and "titles" in titles:
            titles = titles["titles"]
        r = ingest_titles(cat_id, ru_kw, titles, cache, source="manual")
        print(json.dumps(r, ensure_ascii=False, indent=2))

    elif cmd == "pending":
        cache = sys.argv[2]
        r = list_pending_jobs(cache)
        print(json.dumps(r, ensure_ascii=False, indent=2))

    elif cmd == "show":
        cat_id = sys.argv[2]
        cache = sys.argv[3]
        p = _seo_cache_path(cache, cat_id)
        if p.exists():
            print(p.read_text(encoding="utf-8"))
        else:
            print(f"[ERR] no cache for cat_id={cat_id}")

    else:
        print(f"[ERR] unknown cmd: {cmd}")
        sys.exit(1)
