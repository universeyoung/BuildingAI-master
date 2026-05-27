# -*- coding: utf-8 -*-
"""
辰启 v3.0 飞书表结构 - 单一事实源
所有 7 个下游技能都靠这个文件读字段名

字段类型映射（lark-cli base v3 API）：
  text         → 普通文本（style.type=plain 或 url）
  number       → 数字
  singleSelect → 单选
  multiSelect  → 多选
  dateTime     → 日期时间
  checkbox     → 复选框
  attachment   → 附件
"""

# ====================================================================
# 颜色规范（应用到所有状态列的所有候选值）
# ====================================================================
COLOR = {
    "TODO":    0,   # 灰
    "DOING":   2,   # 蓝
    "DONE":    7,   # 绿
    "FAILED":  11,  # 红
    "PENDING": 5,   # 黄
    "BLOCKED": 4,   # 橙（暂未使用，保留待用）
    "GIVEUP":  1,   # 黑灰
    # 综合状态用色
    "GENERAL_DOING": 2,   # 进行中
    "GENERAL_DONE":  7,   # 已完成
    "GENERAL_FAIL":  11,  # 已失败
    "GENERAL_GIVEUP": 1,  # 已放弃
}


def opt(name, color):
    """单选项工厂"""
    return {"name": name, "color": color}


# ====================================================================
# 一级类目候选值（12 项）
# ====================================================================
CATEGORY_TOP_OPTIONS = [
    opt("电子产品", 2),
    opt("时尚服饰", 11),
    opt("家居日用", 7),
    opt("母婴玩具", 5),
    opt("美妆个护", 4),
    opt("食品保健", 3),
    opt("宠物用品", 6),
    opt("户外运动", 8),
    opt("汽车配件", 9),
    opt("工具五金", 10),
    opt("文体娱乐", 1),
    opt("其他", 0),
]


# ====================================================================
# 错误码标准枚举（29 项）
# ====================================================================
ERROR_CODE_OPTIONS = [
    # 选品阶段（7 项）
    opt("SOURCING_LINK_DEAD", 0),
    opt("SOURCING_RED_OCEAN", 4),
    opt("SOURCING_TARGET_PRICE_INVALID", 11),
    opt("SOURCING_NO_KEYWORD", 4),         # 兜底调研失败
    opt("SOURCING_CAPTCHA", 11),           # 滑块验证
    opt("SOURCING_SHOP_LINK_INVALID", 11), # 店铺链接无效
    opt("SOURCING_NO_RESULT", 4),          # 关键词搜不到
    # 采集阶段（5 项）
    opt("CRAWL_HTTP_ERROR", 11),
    opt("CRAWL_ANTI_BOT", 11),
    opt("CRAWL_PARSE_FAIL", 11),
    opt("CRAWL_MISSING_FIELD", 4),
    opt("CRAWL_SKU_IMAGE_FAIL", 4),
    # 翻译阶段（7 项；v3.2.1 新增 3 项 OZON_API/CATEGORY/DICT_VALUE）
    opt("TRANSLATE_LLM_TIMEOUT", 4),
    opt("TRANSLATE_QUALITY_FAIL", 11),
    opt("TRANSLATE_GLOSSARY_LOCK", 4),
    opt("TRANSLATE_LENGTH_OVERFLOW", 11),
    opt("TRANSLATE_OZON_API_FAIL", 11),       # Ozon API 调用失败/限流耗尽
    opt("TRANSLATE_CATEGORY_NOMATCH", 11),    # 类目匹配置信度 < 0.7
    opt("TRANSLATE_DICT_VALUE_NOMATCH", 11),  # 必填属性的字典值无法匹配
    # 图片阶段（4 项）
    opt("IMAGE_GEN_FAIL", 11),
    opt("IMAGE_VQA_FAIL", 11),
    opt("IMAGE_DOWNLOAD_FAIL", 4),
    opt("IMAGE_SIZE_OVERFLOW", 4),
    # 核价阶段（5 项）
    opt("PRICE_NEGATIVE_PROFIT", 11),
    opt("PRICE_LOGISTICS_OVER", 11),
    opt("PRICE_RATE_API_FAIL", 4),
    opt("PRICE_LASTMILE_NO_CONVERGE", 4),
    opt("PRICE_MISSING_INPUT", 4),
    # 上架阶段（5 项）
    opt("LISTING_KB_MISSING", 4),
    opt("LISTING_RC_VALIDATION_FAIL", 11),
    opt("LISTING_OZON_API_FAIL", 11),
    opt("LISTING_IMPORT_TIMEOUT", 4),
    opt("LISTING_DICT_VALUE_INVALID", 11),
    # 质检阶段（4 项）
    opt("QA_DESC_TOO_SHORT", 4),
    opt("QA_IMAGE_HAS_CHINESE", 11),
    opt("QA_PRICE_DRIFT", 4),
    opt("QA_ATTR_INCOMPLETE", 4),
]


# ====================================================================
# 字段类型工厂
# ====================================================================
def _meta(required):
    """required 不下发给飞书，仅用作业务字段，保存到 _meta 子键便于建表后取出"""
    return {"_meta": {"required": required}}


def f_text(name, required=False):
    return {"name": name, "type": "text", **_meta(required)}


def f_url(name, required=False):
    """URL 字段：text + style.type=url"""
    return {
        "name": name,
        "type": "text",
        "style": {"type": "url"},
        **_meta(required),
    }


def f_number(name, precision=0, required=False):
    return {
        "name": name,
        "type": "number",
        "style": {"type": "plain", "precision": precision},
        **_meta(required),
    }


def f_select(name, options, required=False):
    return {
        "name": name,
        "type": "singleSelect",
        "options": options,
        **_meta(required),
    }


def f_multi(name, options, required=False):
    return {
        "name": name,
        "type": "multiSelect",
        "multiple": True,
        "options": options,
        **_meta(required),
    }


def f_dt(name, required=False):
    return {
        "name": name,
        "type": "dateTime",
        "style": {"date_formatter": "yyyy/MM/dd HH:mm", "auto_fill": False},
        **_meta(required),
    }


def f_checkbox(name):
    return {"name": name, "type": "checkbox", **_meta(False)}


def f_attachment(name):
    return {"name": name, "type": "attachment", **_meta(False)}


# ====================================================================
# 状态列候选值
# ====================================================================
def status_opts(prefix, *names):
    """生成 *_TODO/*_DOING/*_DONE/*_FAILED 标准枚举"""
    color_map = {
        "TODO": COLOR["TODO"],
        "DOING": COLOR["DOING"],
        "DONE": COLOR["DONE"],
        "FAILED": COLOR["FAILED"],
        "PENDING": COLOR["PENDING"],
        "PASS": COLOR["DONE"],
        "REJECT": COLOR["FAILED"],
        "REWORK": COLOR["BLOCKED"],
    }
    return [opt(f"{prefix}_{n}", color_map[n]) for n in names]


SOURCING_STATUS_OPTS  = status_opts("S", "TODO", "DOING", "DONE", "FAILED")
CRAWL_STATUS_OPTS    = status_opts("C", "TODO", "DOING", "DONE", "FAILED")
TRANSLATE_STATUS_OPTS = status_opts("T", "TODO", "DOING", "DONE", "FAILED")
IMAGE_STATUS_OPTS    = status_opts("I", "TODO", "DOING", "DONE", "FAILED")
PRICE_STATUS_OPTS    = status_opts("P", "TODO", "DOING", "DONE", "FAILED")
LISTING_STATUS_OPTS  = status_opts("L", "PENDING", "DOING", "DONE", "FAILED")
QA_STATUS_OPTS       = status_opts("Q", "PENDING", "DOING", "PASS", "REJECT", "REWORK")

GENERAL_STATUS_OPTS = [
    opt("进行中", COLOR["GENERAL_DOING"]),
    opt("已完成", COLOR["GENERAL_DONE"]),
    opt("已失败", COLOR["GENERAL_FAIL"]),
    opt("已放弃", COLOR["GENERAL_GIVEUP"]),
]

CURRENT_STAGE_OPTS = [
    opt("采集", 2), opt("翻译", 3), opt("图片", 5),
    opt("核价", 6), opt("上架", 8), opt("质检", 9),
    opt("完成", 7),
]

SOURCE_PLATFORM_OPTS = [
    opt("1688", 2), opt("阿里巴巴国际站", 3), opt("淘宝", 5),
]

SOURCING_SOURCE_OPTS = [
    opt("cron定时", 2),
    opt("用户手动", 3),
    opt("兜底调研", 5),
    opt("店铺链接", 7),
]

FAILURE_STAGE_OPTS = [
    opt("采集", 2), opt("翻译", 3), opt("图片", 5),
    opt("核价", 6), opt("上架", 8), opt("质检", 9),
]

SEVERITY_OPTS = [
    opt("HIGH", COLOR["FAILED"]),
    opt("MEDIUM", COLOR["PENDING"]),
    opt("LOW", COLOR["TODO"]),
]

REPAIR_STATUS_OPTS = [
    opt("待修复", COLOR["TODO"]),
    opt("修复中", COLOR["DOING"]),
    opt("已修复", COLOR["DONE"]),
    opt("已放弃", COLOR["GIVEUP"]),
]

FED_BACK_SKILL_OPTS = [
    opt("辰启-选品调研", 2),
    opt("辰启-自动采集", 3),
    opt("辰启-自动翻译", 5),
    opt("辰启-图片处理", 4),
    opt("辰启-核价助手", 6),
    opt("辰启-自动上架", 8),
    opt("辰启-Ozon质检反馈", 11),
]


# ====================================================================
# 表 1：商品全生命周期（86 字段）
# ====================================================================
TABLE_LIFECYCLE = {
    "name": "商品全生命周期",
    "primary_field": "SKU编号",  # 第一列必须是主键，且必须是 text
    "fields": [
        # 第 1 个字段会成为主字段（不能删除/改类型）
        f_text("SKU编号", required=True),

        # 组 A：标识与归属（其余 4 个）
        f_text("批次编号", required=True),
        f_text("SPU编号", required=True),
        f_select("一级类目", CATEGORY_TOP_OPTIONS, required=True),
        f_text("类目路径"),

        # 组 B：选品输出 / 采集来源（13，新增 7 个选品专属）
        f_url("源链接", required=True),
        f_select("来源平台", SOURCE_PLATFORM_OPTS),
        f_text("1688商品ID"),                                # ⭐新增：去重唯一键
        f_text("店铺名"),                                    # ⭐新增
        f_url("店铺链接"),                                   # ⭐新增
        f_number("店龄(天)"),                                # ⭐新增
        f_number("月销量"),                                  # ⭐新增
        f_text("调研关键词"),                                # ⭐新增
        f_select("选品来源", SOURCING_SOURCE_OPTS),          # ⭐新增 cron/手动/兜底/店铺链接
        f_url("Ozon参考链接"),
        f_number("Ozon竞品数"),
        f_number("Ozon同款中位价(¥)", precision=2),
        f_number("目标售价(¥)", precision=2),

        # 组 C：物理属性（11，全部 required 降级为 False；选品阶段拿不到，采集环节再填）
        f_text("中文商品名"),
        f_text("中文详情描述"),
        f_number("重量(g)"),
        f_number("长(cm)", precision=1),
        f_number("宽(cm)", precision=1),
        f_number("高(cm)", precision=1),
        f_text("材质"),
        f_number("起订量"),
        f_text("规格-颜色"),
        f_text("规格-尺码"),
        f_url("规格主图URL"),
        f_text("采集多角度图组URL"),  # v3.3.0：JSON 数组字符串，存 Accio CDN 公开 URL（≤8 张），作图片技能 reference_images

        # 组 D：采购 / 核价（10，已删 售价(₽)）
        f_number("采购价(¥)", precision=2, required=True),
        f_number("国内运费(¥)", precision=2),
        f_checkbox("是否包邮"),
        f_number("售价(¥)", precision=2),
        f_number("利润(¥)", precision=2),
        f_number("利润率(%)", precision=2),
        f_number("Ozon佣金(¥)", precision=2),
        f_number("末端配送费(¥)", precision=2),
        f_number("总成本(¥)", precision=2),
        f_text("物流明细"),

        # 组 E：翻译输出（5）
        f_text("俄语标题"),
        f_text("俄语描述"),
        f_text("俄语属性JSON"),
        f_text("命中SEO词"),
        f_text("命中术语"),

        # 组 F：图片处理（17）
        *[f_attachment(f"主图{i}预览") for i in range(1, 9)],
        *[f_url(f"主图{i}直链") for i in range(1, 9)],
        f_checkbox("图片直链已验证"),

        # 组 G：上架结果（7）
        f_text("Ozon商品ID"),
        f_text("Ozon卖家SKU"),
        f_text("Ozon类目ID"),
        f_url("Ozon商品链接"),
        f_number("初始库存"),
        f_dt("上架时间"),
        f_text("上架任务ID"),

        # 组 H：状态列（9，新增 选品状态）
        f_select("选品状态", SOURCING_STATUS_OPTS, required=True),  # ⭐新增
        f_select("采集状态", CRAWL_STATUS_OPTS, required=True),
        f_select("翻译状态", TRANSLATE_STATUS_OPTS, required=True),
        f_select("图片状态", IMAGE_STATUS_OPTS, required=True),
        f_select("核价状态", PRICE_STATUS_OPTS, required=True),
        f_select("上架状态", LISTING_STATUS_OPTS, required=True),
        f_select("质检状态", QA_STATUS_OPTS, required=True),
        f_select("综合状态", GENERAL_STATUS_OPTS),
        f_select("当前阶段", CURRENT_STAGE_OPTS),

        # 组 I：阶段开始时间（7，新增 选品开始时间）
        f_dt("选品开始时间"),  # ⭐新增
        f_dt("采集开始时间"),
        f_dt("翻译开始时间"),
        f_dt("图片开始时间"),
        f_dt("核价开始时间"),
        f_dt("上架开始时间"),
        f_dt("质检开始时间"),

        # 组 J：审计与失败信息（11）
        f_dt("创建时间", required=True),
        f_text("创建者"),
        f_dt("更新时间", required=True),
        f_text("更新者"),
        f_number("失败次数"),
        f_number("当前阶段重试次数"),
        f_select("最近失败阶段", FAILURE_STAGE_OPTS),
        f_text("最近失败原因"),
        f_dt("最近失败时间"),
        f_text("备注"),
        f_text("负责人"),
    ],
}


# ====================================================================
# 表 2：失败事件流水（15 字段）
# ====================================================================
TABLE_FAILURE = {
    "name": "失败事件流水",
    "primary_field": "事件编号",
    "fields": [
        f_text("事件编号", required=True),
        f_text("批次编号", required=True),
        f_text("SKU编号", required=True),
        f_select("失败阶段", FAILURE_STAGE_OPTS, required=True),
        f_select("错误码", ERROR_CODE_OPTIONS, required=True),
        f_text("失败原因", required=True),
        f_text("现场快照"),
        f_dt("失败时间", required=True),
        f_text("发现者", required=True),
        f_select("严重等级", SEVERITY_OPTS),
        f_number("失败时重试次数"),
        f_select("修复状态", REPAIR_STATUS_OPTS, required=True),
        f_text("修复负责人"),
        f_dt("修复完成时间"),
        f_dt("创建时间", required=True),
    ],
}


# ====================================================================
# 表 3：批次仪表盘（22 字段）
# ====================================================================
TABLE_DASHBOARD = {
    "name": "批次仪表盘",
    "primary_field": "批次编号",
    "fields": [
        f_text("批次编号", required=True),
        f_dt("批次创建时间"),
        f_dt("批次完成时间"),
        f_number("SKU总数"),
        f_number("成功上架数"),
        f_number("失败数"),
        f_number("进行中数"),
        f_number("成功率(%)", precision=2),
        f_text("类目分布"),
        f_number("平均采购价(¥)", precision=2),
        f_number("平均售价(¥)", precision=2),
        f_number("平均利润率(%)", precision=2),
        f_number("质检平均分"),
        f_number("HIGH错误总数"),
        f_number("MEDIUM错误总数"),
        f_number("LOW错误总数"),
        f_url("质检报告链接"),
        f_multi("已反哺技能", FED_BACK_SKILL_OPTS),
        f_text("批次负责人"),
        f_text("Schema版本"),
        f_text("字段哈希"),
        f_text("备注"),
    ],
}


# ====================================================================
# 表 4：店铺账号池（11 字段）
# ====================================================================
SHOP_STATUS_OPTS = [
    opt("启用", COLOR["DONE"]),
    opt("暂停", COLOR["PENDING"]),
    opt("封禁", COLOR["FAILED"]),
]

TABLE_SHOP_POOL = {
    "name": "店铺账号池",
    "primary_field": "店铺ID",
    "fields": [
        # 第一字段（主字段）必须 text
        f_text("店铺ID", required=True),                          # 唯一标识，全英文/数字
        f_text("店铺名称", required=True),                        # 中文显示名
        f_text("client_id", required=True),                       # Ozon Client ID
        f_text("api_key", required=True),                         # Ozon API Key
        f_number("每日配额", required=True),                      # 默认 100/1000
        f_number("今日已用", required=True),                      # 实时累加
        f_number("优先级", required=True),                        # 数字越小越优先
        f_select("状态", SHOP_STATUS_OPTS, required=True),        # 启用/暂停/封禁
        f_dt("最后切店时间"),                                     # 系统写
        f_text("备注"),                                           # 老板填
        f_dt("计数日期", required=True),                          # 跨日 reset 用
    ],
}


ALL_TABLES = [TABLE_LIFECYCLE, TABLE_FAILURE, TABLE_DASHBOARD, TABLE_SHOP_POOL]


# ====================================================================
# Schema 元信息
# ====================================================================
SCHEMA_VERSION = "v3.3.0"
BASE_NAME = "辰启v3.0-商品全生命周期"


def compute_fields_hash():
    """对所有字段名做哈希，schema 漂移检测用"""
    import hashlib
    parts = []
    for t in ALL_TABLES:
        parts.append(t["name"])
        for f in t["fields"]:
            parts.append(f["name"] + "|" + f["type"])
    raw = "\n".join(parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]
