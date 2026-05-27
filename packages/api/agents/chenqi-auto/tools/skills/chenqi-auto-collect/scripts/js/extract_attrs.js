/**
 * extract_attrs.js - 1688 详情页物理属性抓取
 *
 * 由 crawler_detail.py 注入。目标：重量/长/宽/高/材质 5 个字段。
 *
 * 设计原则：
 *   - 只采原始字符串（"5.5kg"/"30cm"），不做单位归一化（由 Python parsers 统一）
 *   - 缺失字段进 missing 列表，Python 侧 ai_estimator 看到就启动类目规则+视觉兜底
 *   - 重量优先级：单件重量 > 毛重 > 净重
 *   - 材质多值：取前 2 个用逗号拼接，截断 100 字
 *
 * 返回：
 * {
 *   ok: bool,
 *   raw_attrs: { "包装毛重": "5.5kg", ... },   // 全量键值对（debug 用）
 *   parsed: { weight_raw, length_raw, width_raw, height_raw, material_raw },
 *   missing: ["weight", "length", ...],
 *   meta: { selector_hits, total_kv_pairs }
 * }
 */
(function () {
  // —— 选择器（v0.2 新增 module-od-* 锚点）——
  var ATTR_TABLE = '#productPackInfo';
  var ATTR_KV = [
    // 新模板（2026-05 验证）
    '#productAttributes .module-od-product-attributes table tr',
    '#productAttributes .module-od-product-attributes li',
    '[class*="module-od-product-attributes"] table tr',
    '[class*="module-od-product-attributes"] li',
    // 老模板兼容
    '.obj-content table tr',
    '.attribute-list li',
    '#mod-detail-attributes table tr',
    '.od-pc-offer-detail-attribute table tr',
    '.attr-list li',
    '.product-props li'
  ];

  // —— 关键词映射（按优先级排序，前面优先） ——
  var WEIGHT_KEYS = [
    { key: '单件重量', priority: 1 },
    { key: '单件毛重', priority: 1 },
    { key: '毛重', priority: 2 },
    { key: '包装毛重', priority: 2 },
    { key: '产品毛重', priority: 2 },
    { key: '产品重量', priority: 2 },   // v0.2：1688 实际字段名
    { key: '商品重量', priority: 2 },
    { key: '净重', priority: 3 },
    { key: '产品净重', priority: 3 },
    { key: 'weight', priority: 4 }
  ];
  var LENGTH_KEYS = [/^长$/, /长度/, /^长[(（]/, /length/i];
  var WIDTH_KEYS = [/^宽$/, /宽度/, /^宽[(（]/, /width/i];
  var HEIGHT_KEYS = [/^高$/, /高度/, /^高[(（]/, /厚度/, /height/i, /thickness/i];
  var MATERIAL_KEYS = [/材质/, /面料/, /^material/i, /^质地/, /^材料/, /填充物/];

  // 跳过的 key（避免把"产地""品牌"等当成属性）
  var SKIP_KEYS = /^(品牌|产地|发货地|颜色|尺码|型号|货号|生产厂家|是否进口|图案|风格|^风格)/;

  // —— 通用辅助 ——
  function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }

  // 从一个 KV 容器中提取 key/value
  // 兼容三种结构：
  //   <tr><td>key</td><td>value</td></tr>
  //   <li><span>key:</span> value</li>
  //   <li><dt>key</dt><dd>value</dd></li>
  function parseKV(el) {
    if (!el) return null;
    // table tr
    var tds = el.querySelectorAll('td, th');
    if (tds.length >= 2) {
      var k = txt(tds[0]).replace(/[:：]\s*$/, '');
      var v = txt(tds[1]);
      if (k && v) return { key: k, value: v };
    }
    // dl/dt/dd
    var dt = el.querySelector('dt, .label, .name, .attr-name');
    var dd = el.querySelector('dd, .value, .attr-value');
    if (dt && dd) {
      var k2 = txt(dt).replace(/[:：]\s*$/, '');
      var v2 = txt(dd);
      if (k2 && v2) return { key: k2, value: v2 };
    }
    // 文本含冒号：key: value
    var t = txt(el);
    var m = t.match(/^([^:：]{2,30})[:：]\s*(.+)$/);
    if (m) return { key: m[1].trim(), value: m[2].trim() };
    return null;
  }

  // —— 收集所有 KV ——
  var rawAttrs = {};
  var selectorHits = [];

  // #productPackInfo 表格
  try {
    var pack = document.querySelector(ATTR_TABLE);
    if (pack) {
      var trs = pack.querySelectorAll('tr');
      var hitCount = 0;
      for (var i = 0; i < trs.length; i++) {
        var kv = parseKV(trs[i]);
        if (kv && !SKIP_KEYS.test(kv.key)) {
          // 已存在不覆盖（保持首次出现的值）
          if (!(kv.key in rawAttrs)) {
            rawAttrs[kv.key] = kv.value;
            hitCount++;
          }
        }
      }
      if (hitCount) selectorHits.push({ sel: ATTR_TABLE, count: hitCount });
    }
  } catch (e) { /* ignore */ }

  // 通用 KV 选择器降级
  for (var si = 0; si < ATTR_KV.length; si++) {
    try {
      var nodes = document.querySelectorAll(ATTR_KV[si]);
      if (!nodes.length) continue;
      var c = 0;
      for (var ni = 0; ni < nodes.length; ni++) {
        var kv2 = parseKV(nodes[ni]);
        if (kv2 && !SKIP_KEYS.test(kv2.key)) {
          if (!(kv2.key in rawAttrs)) {
            rawAttrs[kv2.key] = kv2.value;
            c++;
          }
        }
      }
      if (c) selectorHits.push({ sel: ATTR_KV[si], count: c });
    } catch (e) { /* ignore */ }
  }

  // —— 字段映射 ——
  function findWeight() {
    // 按优先级遍历重量关键字
    var bestPri = 99;
    var bestVal = null;
    for (var k in rawAttrs) {
      if (!Object.prototype.hasOwnProperty.call(rawAttrs, k)) continue;
      var lk = k.toLowerCase();
      for (var i = 0; i < WEIGHT_KEYS.length; i++) {
        var spec = WEIGHT_KEYS[i];
        if (k.indexOf(spec.key) >= 0 || lk.indexOf(spec.key.toLowerCase()) >= 0) {
          if (spec.priority < bestPri) {
            bestPri = spec.priority;
            bestVal = rawAttrs[k];
          }
          break;
        }
      }
    }
    return bestVal;
  }

  function findByPatterns(patterns) {
    for (var k in rawAttrs) {
      if (!Object.prototype.hasOwnProperty.call(rawAttrs, k)) continue;
      for (var i = 0; i < patterns.length; i++) {
        if (patterns[i].test(k)) return rawAttrs[k];
      }
    }
    return null;
  }

  // 材质：可能多键命中，拼前 2 个
  function findMaterial() {
    var hits = [];
    for (var k in rawAttrs) {
      if (!Object.prototype.hasOwnProperty.call(rawAttrs, k)) continue;
      for (var i = 0; i < MATERIAL_KEYS.length; i++) {
        if (MATERIAL_KEYS[i].test(k)) {
          hits.push(rawAttrs[k]);
          break;
        }
      }
    }
    if (!hits.length) return null;
    // 去重
    var seen = {};
    var unique = hits.filter(function (v) {
      var key = v.trim();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    var joined = unique.slice(0, 2).join('，');
    return joined.slice(0, 100);
  }

  // 特殊：尺寸有时合并写成「30*20*10cm」或「长×宽×高: 30/20/10」
  function tryParseCombinedDim() {
    for (var k in rawAttrs) {
      if (!Object.prototype.hasOwnProperty.call(rawAttrs, k)) continue;
      if (!/尺寸|规格大小|包装尺寸|product\s*size/i.test(k)) continue;
      var v = rawAttrs[k];
      // 抓 3 个数字（带可选单位）
      var nums = v.match(/(\d+(?:\.\d+)?)\s*[*xX×\/]\s*(\d+(?:\.\d+)?)\s*[*xX×\/]\s*(\d+(?:\.\d+)?)/);
      if (nums) {
        // 单位附在末尾（如果有）
        var unit = (v.match(/(cm|mm|m|厘米|毫米|米)$/i) || [])[1] || '';
        return {
          length: nums[1] + unit,
          width: nums[2] + unit,
          height: nums[3] + unit
        };
      }
    }
    return null;
  }

  var weight = findWeight();
  var length = findByPatterns(LENGTH_KEYS);
  var width = findByPatterns(WIDTH_KEYS);
  var height = findByPatterns(HEIGHT_KEYS);
  var material = findMaterial();

  // 合并尺寸 fallback
  if (!length || !width || !height) {
    var combined = tryParseCombinedDim();
    if (combined) {
      length = length || combined.length;
      width = width || combined.width;
      height = height || combined.height;
    }
  }

  var parsed = {
    weight_raw: weight,
    length_raw: length,
    width_raw: width,
    height_raw: height,
    material_raw: material
  };

  var missing = [];
  if (!weight) missing.push('weight');
  if (!length) missing.push('length');
  if (!width) missing.push('width');
  if (!height) missing.push('height');
  if (!material) missing.push('material');

  return {
    ok: true,  // 即使全空也 ok（缺失由 missing 标记，Python 侧兜底）
    // 顶级字段（enricher.py L199-203 期望的 schema，修复 v0.1 不一致 bug）
    weight: weight,
    length: length,
    width: width,
    height: height,
    material: material,
    // 兼容旧 schema 的 parsed 嵌套 + 全量原始 KV（debug）
    raw_attrs: rawAttrs,
    parsed: parsed,
    missing: missing,
    meta: {
      selector_hits: selectorHits,
      total_kv_pairs: Object.keys(rawAttrs).length
    }
  };
})();
