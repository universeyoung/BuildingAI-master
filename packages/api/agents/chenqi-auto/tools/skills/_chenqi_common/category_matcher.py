# -*- coding: utf-8 -*-
"""
辰启-公共模块：Ozon 类目匹配器
权威源：agent-core/skills/_chenqi_common/category_matcher.py

输入：商品中文标题/类目路径 + 俄语标题（已译）
输出：(description_category_id, type_id, type_name, ozon_path, score, alternatives)

算法（两路混合召回 + 精排）：
1. 加载 Ozon 类目树 → 平铺 7414 叶子，每个叶子带「祖先继承的 cat_id」+ 「全路径」
2. TF-IDF 余弦召回 top-30：以「ru_title」vs「type_name + 父类拼接」做相似度
3. 中文关键词硬规则加权：1688 zh 类目路径里出现明显品类词 → 加分
4. LLM rerank top-1（外部传入 reranker 函数；不传则用 score 最高的）
5. 置信度 < threshold（默认 0.7）抛 CategoryNomatch

下游：
  - chenqi-auto-translate（M2-M5）：接到 (cat_id, type_id) 后调 ozon_api.get_category_attributes
  - chenqi-listing：上架 /v3/product/import 必传两个 ID
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Callable

# 俄语停用词（与 ozon_seo_scraper 共享同一份；这里精简版）
_RU_STOP = {
    "и", "в", "на", "с", "по", "для", "от", "до", "из", "к", "у", "о",
    "не", "но", "а", "что", "как", "это", "его", "ее", "их", "мы", "вы",
    "при", "под", "над", "за", "со", "во", "об", "же", "ли", "бы",
}

# 中文 → 俄语类目关键词（启发式硬规则；命中即加分）
# 维护原则：只放强信号品类，弱信号交给 TF-IDF
ZH2RU_CATEGORY_HINTS = {
    "保温杯": ["термокружка", "термос"],
    "水杯": ["кружка", "чашка", "стакан"],
    "茶杯": ["чашка", "кружка"],
    "餐具": ["посуд"],
    "厨具": ["кухонн", "посуд"],
    "锅": ["кастрюл", "сковород"],
    "刀": ["нож"],
    "玩具": ["игрушк"],
    "服装": ["одежд"],
    "鞋": ["обув"],
    "包": ["сумк"],
    "首饰": ["украшени", "ювелир"],
    "化妆": ["косметик"],
    "护肤": ["уход за кож", "крем"],
    "洗发": ["шампун"],
    "电子": ["электрон"],
    "手机": ["телефон", "смартфон"],
    "耳机": ["наушник"],
    "充电": ["зарядк", "зарядное"],
    "灯": ["лампа", "светильник"],
    "家具": ["мебель"],
    "书": ["книг"],
    "文具": ["канцеляр"],
    "运动": ["спорт"],
    "健身": ["фитнес"],
    "宠物": ["для животных", "для собак", "для кошек"],
    "汽车": ["автомобил", "авто"],
    "工具": ["инструмент"],

    # === 3C / 数码外设 ===
    # 音箱：避免 "акустическ" (歧义→声学钢琴/原声乐器)
    "音箱": ["колонк", "портативная колонк", "динамик"],
    "音响": ["колонк", "аудиосистем"],
    "蓝牙音箱": ["bluetooth колонк", "колонк bluetooth", "портативная колонк"],
    "蓝牙": ["bluetooth"],
    "声卡": ["звуков карт", "аудиоинтерфейс"],
    "麦克风": ["микрофон"],
    "话筒": ["микрофон"],
    "键盘": ["клавиатур"],
    "鼠标": ["мышь", "мышк"],
    "数据线": ["кабель", "провод usb"],
    "充电宝": ["повербанк", "внешний аккумулятор", "power bank"],
    "电池": ["батаре", "аккумулятор"],
    "u盘": ["флешк", "usb накопител"],
    "硬盘": ["жёсткий диск", "ssd накопител"],
    "摄像头": ["веб камер", "видеокамер"],
    "路由器": ["роутер", "маршрутизатор"],
    "支架": ["держател", "подставк", "штатив"],
    "手机壳": ["чехол для телефон", "чехол смартфон"],
    "贴膜": ["защитн стекл", "защитн плёнк"],
    "投影仪": ["проектор"],
    "电脑": ["компьютер", "пк"],
    "笔记本": ["ноутбук"],
    "平板": ["планшет"],
    "打印机": ["принтер"],
    "扫描仪": ["сканер"],

    # === 家电 ===
    "电饭煲": ["мультиварк", "рисоварк"],
    "电水壶": ["электрочайник", "чайник"],
    "吹风机": ["фен"],
    "剃须刀": ["бритв"],
    "电动牙刷": ["электрическ зубн щётк"],
    "加湿器": ["увлажнител"],
    "净化器": ["очистител"],
    "风扇": ["вентилятор"],
    "电暖器": ["обогревател"],
    "吸尘器": ["пылесос"],
    "榨汁机": ["соковыжималк"],
    "搅拌机": ["блендер", "миксер"],

    # === 家居 / 收纳 ===
    "收纳": ["хранения", "органайзер"],
    "收纳盒": ["контейнер для хранен", "органайзер"],
    "收纳箱": ["ящик для хранен"],
    "毛巾": ["полотенц"],
    "枕头": ["подушк"],
    "床品": ["постельное бельё"],
    "窗帘": ["штор"],
    "地毯": ["ковёр", "коврик"],
    "挂钩": ["крючок", "крючки"],
    "镜子": ["зеркал"],
    "时钟": ["часы настенн"],

    # === 办公 / 文具 ===
    "笔": ["ручк", "карандаш"],
    "本子": ["блокнот", "тетрад"],
    "胶带": ["скотч", "лента клейк"],

    # === 母婴 / 个护 ===
    "奶瓶": ["бутылочк для кормлен"],
    "尿不湿": ["подгузник"],
    "婴儿车": ["коляск"],

    # === 户外 / 运动 ===
    "瑜伽": ["йог"],
    "自行车": ["велосипед"],
    "帐篷": ["палатк"],
    "保温": ["термо"],
}

_TOKEN_RE = re.compile(r"[\wа-яёА-ЯЁ]+", re.UNICODE)


# ============== 数据结构 ==============

@dataclass
class LeafNode:
    cat_id: int        # 祖先继承的 description_category_id
    type_id: int
    type_name: str
    path: str          # 全路径如 "/Дом и сад/Термосы.../Термокружка"
    tokens_ru: set     # 路径俄语 tokens（小写，去停用词）
    tokens_tail: set = None       # 末段 type_name tokens（用于末段加权召回）
    tokens_ru_stem: set = None    # v0.3+ 词干集（前 5 字符截断，解俄语屈折）
    tokens_tail_stem: set = None  # v0.3+ 末段词干集

@dataclass
class MatchResult:
    cat_id: int
    type_id: int
    type_name: str
    path: str
    score: float            # 0-1，最终置信度
    needs_llm_rerank: bool  # True 表示 BM25 候选含混，建议下游用 LLM 精排
    alternatives: list      # [{cat_id, type_id, type_name, path, score}, ...] top-5


class CategoryNomatch(Exception):
    """置信度 < 阈值；调用方应写 TRANSLATE_CATEGORY_NOMATCH 失败码"""
    def __init__(self, message: str, best: MatchResult | None = None):
        super().__init__(message)
        self.best = best


# ============== 类目树 → 叶子索引 ==============

def _tokenize_ru(text: str) -> set:
    if not text:
        return set()
    toks = {m.group(0).lower() for m in _TOKEN_RE.finditer(text)}
    return {t for t in toks if t not in _RU_STOP and len(t) >= 2}


# v0.3+ 词干化：俄语阴阳性/复数/格变化导致 "электронный/электронная/электронные" 完全不等
# 简单截前 5 字符作为伪词干，给 _tfidf_score 提供容错副路。5 字符足以保留词根区分度
# （"переводчик/переводчики" → "перев"；"электронный/электронная" → "элект"）
def _stemify(tokens: set, stem_len: int = 5) -> set:
    if not tokens:
        return set()
    out = set()
    for t in tokens:
        if len(t) <= stem_len:
            out.add(t)
        else:
            out.add(t[:stem_len])
    return out


def flatten_tree(tree_root: list) -> list[LeafNode]:
    """
    递归展平 Ozon 类目树，叶子继承最近祖先的 description_category_id。
    每个叶子带全路径 + 路径俄语 tokens（用于 TF-IDF）。
    """
    leaves: list[LeafNode] = []

    def walk(nodes, path: str = "", ancestor_cat_id: int | None = None):
        for n in nodes:
            cat_id_self = n.get("description_category_id")
            cat_id_eff = cat_id_self or ancestor_cat_id
            name = n.get("category_name") or n.get("type_name") or ""
            cur_path = f"{path}/{name}" if name else path
            kids = n.get("children") or []
            type_id = n.get("type_id")
            if not kids and type_id and cat_id_eff:
                # 叶子：必须有 type_id 且能追溯到 cat_id
                tokens_ru = _tokenize_ru(cur_path)
                tokens_tail = _tokenize_ru(name)
                leaves.append(LeafNode(
                    cat_id=cat_id_eff,
                    type_id=type_id,
                    type_name=name,
                    path=cur_path,
                    tokens_ru=tokens_ru,
                    tokens_tail=tokens_tail,  # 末段加权用
                    tokens_ru_stem=_stemify(tokens_ru),       # v0.3+ 词干容错
                    tokens_tail_stem=_stemify(tokens_tail),
                ))
            else:
                walk(kids, cur_path, cat_id_eff)

    walk(tree_root)
    return leaves


# ============== TF-IDF 召回 ==============

def _build_idf(leaves: list[LeafNode]) -> dict:
    """构建路径 tokens 的 IDF 表"""
    df: dict[str, int] = {}
    for leaf in leaves:
        for tok in leaf.tokens_ru:
            df[tok] = df.get(tok, 0) + 1
    n_docs = len(leaves)
    return {tok: math.log((n_docs + 1) / (cnt + 1)) + 1 for tok, cnt in df.items()}


def _tfidf_score(query_tokens: set, doc_tokens: set, idf: dict) -> float:
    """简化 TF-IDF 余弦：查询/文档 token 都按 0/1，权重用 IDF"""
    common = query_tokens & doc_tokens
    if not common or not query_tokens or not doc_tokens:
        return 0.0
    num = sum(idf.get(t, 1.0) for t in common)
    q_norm = math.sqrt(sum(idf.get(t, 1.0) ** 2 for t in query_tokens))
    d_norm = math.sqrt(sum(idf.get(t, 1.0) ** 2 for t in doc_tokens))
    if q_norm == 0 or d_norm == 0:
        return 0.0
    return num / (q_norm * d_norm)


# ============== 中文硬规则加权 ==============

# 自学字典模块级缓存（lazy load，跑批中复用）
_LEARNED_CACHE: dict | None = None
_LEARNED_CACHE_PATH: str | None = None
_LEARNED_CACHE_MTIME: float | None = None


def _load_learned_zh2ru(cache_dir: Path | str | None) -> dict:
    """从 cache/zh2ru_learned.json 加载自学字典（v0.3+）。
    支持 mtime 失效：文件被改了重读。
    """
    global _LEARNED_CACHE, _LEARNED_CACHE_PATH, _LEARNED_CACHE_MTIME
    if not cache_dir:
        return {}
    f = Path(cache_dir) / "zh2ru_learned.json"
    if not f.exists():
        return {}
    try:
        mtime = f.stat().st_mtime
        if (_LEARNED_CACHE is not None
                and _LEARNED_CACHE_PATH == str(f)
                and _LEARNED_CACHE_MTIME == mtime):
            return _LEARNED_CACHE
        data = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            cleaned = {
                k: [r for r in v if isinstance(r, str) and r]
                for k, v in data.items()
                if isinstance(k, str) and isinstance(v, list)
            }
            _LEARNED_CACHE = cleaned
            _LEARNED_CACHE_PATH = str(f)
            _LEARNED_CACHE_MTIME = mtime
            return cleaned
    except Exception:
        pass
    return {}


def _zh_keyword_boost(zh_text: str, leaf: LeafNode, learned: dict | None = None) -> float:
    """
    1688 中文标题/调研关键词出现强信号品类词 → 给路径含对应俄语词根的叶子加分。

    评分规则：
      - 单条 zh_kw 命中 1 个 root：+0.30
      - 同一 zh_kw 多个 root 命中：每多 1 个 +0.10（最多 +0.20）
      - 多个 zh_kw 命中：分数累加（最多封顶 0.7，不超过 TF-IDF 主分）

    learned: 自学字典 {zh_kw: [ru_roots]}，与硬字典合并；同 key 时 union 词根列表
    """
    if not zh_text:
        return 0.0
    # 合并硬字典 + 自学字典（自学优先级低，仅补充词根；不覆盖硬字典）
    merged: dict[str, list[str]] = {}
    for k, v in ZH2RU_CATEGORY_HINTS.items():
        merged[k] = list(v)
    if learned:
        for k, v in learned.items():
            if k in merged:
                # union 去重，保持原顺序
                existing = set(merged[k])
                merged[k] = merged[k] + [r for r in v if r not in existing]
            else:
                merged[k] = list(v)

    leaf_path_lower = leaf.path.lower()
    total = 0.0
    for zh_kw, ru_roots in merged.items():
        if zh_kw not in zh_text:
            continue
        hit = sum(1 for root in ru_roots if root in leaf_path_lower)
        if hit == 0:
            continue
        # 第 1 hit = 0.3, 第 2 = 0.4, 第 3+ = 0.5
        total += min(0.3 + 0.1 * (hit - 1), 0.5)
    return min(total, 0.7)


# ============== 核心 API ==============

# 模块级缓存（同一 base_info 多次调用复用）
_LEAVES_CACHE: list[LeafNode] | None = None
_IDF_CACHE: dict | None = None
_CACHE_TREE_PATH: str | None = None


def load_index(tree_path: Path | str, force: bool = False) -> tuple[list[LeafNode], dict]:
    """加载 + 平铺 + 建 IDF 索引；模块级缓存"""
    global _LEAVES_CACHE, _IDF_CACHE, _CACHE_TREE_PATH
    tree_path_s = str(tree_path)
    if not force and _LEAVES_CACHE is not None and _CACHE_TREE_PATH == tree_path_s:
        return _LEAVES_CACHE, _IDF_CACHE  # type: ignore

    with open(tree_path, encoding="utf-8") as f:
        tree = json.load(f)
    leaves = flatten_tree(tree["result"])
    idf = _build_idf(leaves)
    _LEAVES_CACHE = leaves
    _IDF_CACHE = idf
    _CACHE_TREE_PATH = tree_path_s
    return leaves, idf


def recall_topk(
    ru_title: str,
    zh_title: str,
    leaves: list[LeafNode],
    idf: dict,
    topk: int = 30,
    ru_expanded_keywords: list[str] | None = None,
    cache_dir: Path | str | None = None,
    tail_weight: float = 3.0,
) -> list[tuple[LeafNode, float]]:
    """三路融合召回 top-k：TF-IDF（含末段加权） + 中文硬规则加权 + LLM 扩词

    新增参数（v0.3）：
      ru_expanded_keywords: LLM 给的俄语类目候选词，融入 query tokens（解决根因 1+5）
      cache_dir: 用于读 zh2ru_learned.json 自学字典（解决根因 2）
      tail_weight: 末段 type_name tokens 的权重倍数（默认 ×3，解决根因 3）

    向后兼容：所有新增参数都有默认值，旧调用方无需改动。
    """
    # 1) query tokens 融合：ru_title + 扩词
    q_tokens = _tokenize_ru(ru_title)
    if ru_expanded_keywords:
        for kw in ru_expanded_keywords:
            q_tokens |= _tokenize_ru(kw)
    # v0.3+ 词干集（解俄语屈折：электронный↔электронная↔электронные）
    q_stem = _stemify(q_tokens)

    # 2) 加载自学字典
    learned = _load_learned_zh2ru(cache_dir) if cache_dir else {}

    scored: list[tuple[LeafNode, float]] = []
    for leaf in leaves:
        # 主路：全路径 TF-IDF（原形精确匹配）
        s_tfidf = _tfidf_score(q_tokens, leaf.tokens_ru, idf)
        # 末段加权：type_name tokens 单独算分 × tail_weight
        s_tail = 0.0
        if leaf.tokens_tail:
            s_tail = _tfidf_score(q_tokens, leaf.tokens_tail, idf) * tail_weight
        # v0.3+ 词干容错副路：原形未命中时给词干交集小分（权重 0.5/0.6 避免压过原形主路）
        s_tfidf_stem = 0.0
        s_tail_stem = 0.0
        if leaf.tokens_ru_stem:
            s_tfidf_stem = _tfidf_score(q_stem, leaf.tokens_ru_stem, idf) * 0.5
        if leaf.tokens_tail_stem:
            s_tail_stem = _tfidf_score(q_stem, leaf.tokens_tail_stem, idf) * tail_weight * 0.6
        # 中文硬规则 + 自学字典
        s_boost = _zh_keyword_boost(zh_title, leaf, learned=learned)
        score = s_tfidf + s_tail + s_tfidf_stem + s_tail_stem + s_boost
        if score > 0:
            scored.append((leaf, score))

    scored.sort(key=lambda x: -x[1])
    return scored[:topk]


def match_category(
    ru_title: str,
    zh_title: str,
    base_info_dir: Path | str,
    cache_dir: Path | str,
    accept_threshold: float = 0.7,
    fail_threshold: float = 0.4,
    topk_recall: int = 30,
    reranker: Callable[[str, str, list[dict]], dict] | None = None,
    language: str = "RU",
    ru_expanded_keywords: list[str] | None = None,
) -> MatchResult:
    """
    主入口（双阈值策略）。
    
    参数：
      ru_title          - 已译俄语标题（必填，召回主信号）
      zh_title          - 1688 中文标题/类目路径（用于硬规则加权）
      base_info_dir     - 仅用于 API 兼容（M2 阶段未使用）
      cache_dir         - chenqi-auto-translate/cache/（含 ozon_category_tree/RU.json）
      accept_threshold  - 置信度 ≥ 此值 → 直接采纳，needs_llm_rerank=False
      fail_threshold    - 置信度 < 此值 → 抛 CategoryNomatch
                          [fail, accept) 区间 → 返回成功但 needs_llm_rerank=True
      topk_recall       - 召回数量（喂给 reranker 的候选集大小）
      reranker          - 可选 LLM 重排函数；签名 (ru_title, zh_title, candidates) -> {type_id, score}
      language          - 类目树语言（默认 RU）
    
    返回：MatchResult
    异常：CategoryNomatch（score < fail_threshold 时，best 字段带最佳候选）
    """
    cache_dir = Path(cache_dir)
    tree_path = cache_dir / "ozon_category_tree" / f"{language}.json"
    if not tree_path.exists():
        raise FileNotFoundError(
            f"类目树缓存不存在：{tree_path}。请先调 ozon_api.get_category_tree()"
        )

    leaves, idf = load_index(tree_path)
    if not leaves:
        raise RuntimeError(f"类目树平铺为空：{tree_path}")

    # 1. 召回（v0.3：传扩词 + cache_dir 启用自学字典）
    recalled = recall_topk(
        ru_title, zh_title, leaves, idf,
        topk=topk_recall,
        ru_expanded_keywords=ru_expanded_keywords,
        cache_dir=cache_dir,
    )
    if not recalled:
        raise CategoryNomatch(
            f"召回为空（ru_title={ru_title!r} zh_title={zh_title!r}）"
        )

    # 2. 构建 alternatives top-5（基于召回 score）
    alternatives = [
        {
            "cat_id": leaf.cat_id,
            "type_id": leaf.type_id,
            "type_name": leaf.type_name,
            "path": leaf.path,
            "score": round(score, 4),
        }
        for leaf, score in recalled[:5]
    ]

    # 3. LLM rerank 或直接取 top-1
    if reranker is not None:
        candidates = [
            {
                "cat_id": leaf.cat_id,
                "type_id": leaf.type_id,
                "type_name": leaf.type_name,
                "path": leaf.path,
                "recall_score": round(score, 4),
            }
            for leaf, score in recalled
        ]
        rerank_out = reranker(ru_title, zh_title, candidates)
        # rerank_out 形如 {"type_id": ..., "score": 0.85, "reason": "..."}
        picked_type_id = rerank_out.get("type_id")
        final_score = float(rerank_out.get("score", 0.0))
        picked = next(
            (leaf for leaf, _ in recalled if leaf.type_id == picked_type_id),
            None,
        )
        if picked is None:
            # reranker 返回了不在候选里的 ID，回退到召回 top-1
            picked, recall_score = recalled[0]
            final_score = recall_score
    else:
        picked, raw_top1 = recalled[0]
        # 置信度算法（基于 gap，不依赖绝对分数）：
        #   - top-1 与 top-2 的相对差距大 → 高置信
        #   - 召回数 ≥ 2：score = 0.5 + 0.5 * (top1 - top2) / top1（gap 占比）
        #   - 仅 top-1：直接给 0.85
        # 经验：top-1 是唯一强匹配时通常 >0.8；含混匹配时 <0.7
        if len(recalled) >= 2:
            top2 = recalled[1][1]
            gap_ratio = (raw_top1 - top2) / max(raw_top1, 1e-6)
            final_score = 0.5 + 0.5 * gap_ratio
        else:
            final_score = 0.85
        final_score = min(max(final_score, 0.0), 1.0)

    needs_llm = final_score < accept_threshold
    result = MatchResult(
        cat_id=picked.cat_id,
        type_id=picked.type_id,
        type_name=picked.type_name,
        path=picked.path,
        score=round(final_score, 4),
        needs_llm_rerank=needs_llm,
        alternatives=alternatives,
    )

    if final_score < fail_threshold:
        raise CategoryNomatch(
            f"置信度 {final_score:.3f} < {fail_threshold}（best: {picked.path}）",
            best=result,
        )

    return result


# ============== CLI 自测 ==============

if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser()
    parser.add_argument("--cache-dir", required=True)
    parser.add_argument("--ru-title", required=True)
    parser.add_argument("--zh-title", default="")
    parser.add_argument("--accept", type=float, default=0.7)
    parser.add_argument("--fail", type=float, default=0.4)
    parser.add_argument("--topk", type=int, default=10)
    parser.add_argument("--ru-expand", default="", help="逗号分隔的 LLM 扩词俄语类目候选")
    args = parser.parse_args()

    expand_kws = [k.strip() for k in args.ru_expand.split(",") if k.strip()] or None

    try:
        result = match_category(
            ru_title=args.ru_title,
            zh_title=args.zh_title,
            base_info_dir="",
            cache_dir=args.cache_dir,
            accept_threshold=args.accept,
            fail_threshold=args.fail,
            topk_recall=args.topk,
            ru_expanded_keywords=expand_kws,
        )
        flag = "[OK]" if not result.needs_llm_rerank else "[OK-需 LLM 精排]"
        print(f"{flag} 匹配命中：")
        print(f"  cat_id={result.cat_id} type_id={result.type_id}")
        print(f"  path={result.path}")
        print(f"  score={result.score}  needs_llm_rerank={result.needs_llm_rerank}")
        print(f"\nTop {len(result.alternatives)} 候选：")
        for alt in result.alternatives:
            print(f"  cat={alt['cat_id']:<10} type={alt['type_id']:<12} score={alt['score']:<7} {alt['path']}")
    except CategoryNomatch as e:
        print(f"[CATEGORY_NOMATCH] {e}", file=sys.stderr)
        if e.best:
            print(f"  best alternative: {e.best.path} (score={e.best.score})", file=sys.stderr)
        sys.exit(2)
