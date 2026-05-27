/**
 * extract_4in1.js - basics + sku_dims + attrs + pack 一次执行返回
 *
 * browser_console 注入即可。返回：
 * { basics, sku_dims, attrs, pack }
 *
 * 三段代码原样照抄自 extract_basics.js / extract_sku_dims.js / extract_attrs.js，
 * 只是把外层 IIFE 改成普通函数 _basics() / _sku_dims() / _attrs() 然后在最外层 return 三者。
 */
(function () {
  function _basics() {
    function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }
    function attr(el, name) { return el ? (el.getAttribute(name) || '') : ''; }
    function pickFirst(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) return { el: el, sel: selectors[i] };
      }
      return { el: null, sel: '' };
    }
    var titleHit = pickFirst(['#productTitle h1', '#productTitle .od-pc-offer-title', '[class*="od-pc-offer-title"] h1', '[class*="od-pc-offer-title"]', 'h1.title']);
    var title = txt(titleHit.el).slice(0, 300);
    var shopName = '', shopUrl = '';
    var shopHit = pickFirst(['#shopNavigation a.shop-company-name', '#shopNavigation a[href*="1688.com"]', '[class*="module-od-pc-shop"] a[href*="1688.com"]', '.shop-name a', 'a.shop-name']);
    if (shopHit.el) {
      shopName = txt(shopHit.el).slice(0, 100);
      shopUrl = attr(shopHit.el, 'href');
      if (shopUrl && shopUrl.indexOf('//') === 0) shopUrl = 'https:' + shopUrl;
    }
    var priceHit = pickFirst(['#mainPrice', '[class*="module-od-main-price"]', '#mainPrice .module-od-main-price']);
    var priceFullText = txt(priceHit.el).slice(0, 600);
    var moq = '';
    var moqMatch = priceFullText.match(/(\d+)\s*[件套个]?\s*起批/) || priceFullText.match(/(\d+)\s*起批/);
    if (moqMatch) {
      moq = moqMatch[1] + '件起批';
    } else {
      var moqEl = document.querySelector('[class*="batch-num"], [class*="moq"], [class*="min-order"]');
      if (moqEl) moq = txt(moqEl).slice(0, 30);
    }
    var freightHint = '';
    var freightCandidates = document.querySelectorAll('[class*="freight"], [class*="logistics"], [class*="shipping"]');
    for (var fi = 0; fi < freightCandidates.length && fi < 5; fi++) {
      var ft = txt(freightCandidates[fi]);
      if (ft && (/包邮|运费|发货/.test(ft)) && ft.length < 80) { freightHint = ft; break; }
    }
    var description = '';
    var descCandidates = ['#productDescription', '[class*="module-od-product-description"]', '#mod-detail-description', '.detail-content'];
    for (var di = 0; di < descCandidates.length; di++) {
      var de = document.querySelector(descCandidates[di]);
      if (de) { description = txt(de).slice(0, 1500); if (description) break; }
    }
    var ladderText = '';
    var ladderEl = document.querySelector('[class*="ladder"], [class*="od-pc-ladder"], [class*="discount-price-list"], [class*="module-od-discount-price"]');
    if (ladderEl) ladderText = txt(ladderEl).slice(0, 400);
    if (!ladderText && priceFullText && (priceFullText.match(/¥/g) || []).length >= 2) {
      ladderText = priceFullText.slice(0, 400);
    }
    return {
      ok: !!title,
      data: { title: title, shop_name: shopName, shop_url: shopUrl, moq: moq, freight_hint: freightHint, description: description, ladder_text: ladderText, source_url: location.href, product_id: (location.pathname.match(/offer\/(\d+)/) || [])[1] || '' },
      meta: { title_hit: titleHit.sel || null, shop_hit: shopHit.sel || null, price_hit: priceHit.sel || null, price_full_text: priceFullText.slice(0, 200) }
    };
  }

  function _sku_dims() {
    function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }
    var ROOT_SEL = '#skuSelection';
    var root = document.querySelector(ROOT_SEL);
    if (!root) root = document.querySelector('[class*="module-od-sku-selection"]');
    if (!root) return { ok: false, dims: [], image_dim_index: null, meta: { error: 'sku_root_not_found' } };
    var dims = [];
    var imageDimIndex = null;
    var rawRows = root.querySelectorAll('.feature-item, [class*="feature-item"]');
    var rows = [];
    for (var rri = 0; rri < rawRows.length; rri++) {
      var rrEl = rawRows[rri];
      var rrCls = (typeof rrEl.className === 'string') ? rrEl.className : '';
      if (rrCls === 'feature-item-label' || rrCls.indexOf('feature-item-label') >= 0 && rrCls.indexOf('feature-item ') < 0 && !rrCls.match(/\bfeature-item\b/)) continue;
      if (!rrEl.querySelector('.expand-view-item, [class*="expand-view-item"], .option, [class*="option"]')) continue;
      rows.push(rrEl);
    }
    if (!rows.length) {
      var rootKids = root.children;
      for (var rk = 0; rk < rootKids.length; rk++) {
        var rkEl = rootKids[rk];
        var rkCls = (typeof rkEl.className === 'string') ? rkEl.className : '';
        if (rkCls === 'feature-item-label') continue;
        rows.push(rkEl);
      }
    }
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      if (!row) continue;
      var dimName = '';
      var labelEl = row.querySelector('.feature-item-label, .label, [class*="title"], dt, .name, h3');
      if (labelEl) dimName = txt(labelEl);
      var optEls = [];
      var primaryFound = row.querySelectorAll('.expand-view-item, [class*="expand-view-item"]');
      if (primaryFound.length) {
        for (var pf = 0; pf < primaryFound.length; pf++) optEls.push(primaryFound[pf]);
      } else {
        var legacy = row.querySelectorAll('.option, .feature-option, .sku-item, [class*="sku-item"], a, button, li');
        for (var lg = 0; lg < legacy.length; lg++) optEls.push(legacy[lg]);
      }
      optEls = optEls.filter(function (el) {
        for (var k = 0; k < optEls.length; k++) {
          if (optEls[k] !== el && el.contains(optEls[k])) return false;
        }
        return true;
      });
      var seen = [];
      optEls = optEls.filter(function (el) { if (seen.indexOf(el) >= 0) return false; seen.push(el); return true; });
      optEls = optEls.slice(0, 30);
      var options = [];
      var rowHasImage = false;
      for (var oi = 0; oi < optEls.length; oi++) {
        var el = optEls[oi];
        var labelInner = el.querySelector('.item-label, [class*="item-label"]');
        var optText = labelInner ? txt(labelInner) : txt(el).split('\n')[0];
        optText = (optText || '').slice(0, 80);
        var img = el.querySelector('img.ant-image-img, .ant-image img, img');
        var thumb = '';
        if (img) {
          thumb = img.src || img.getAttribute('data-src') || '';
          if (thumb && thumb.indexOf('//') === 0) thumb = 'https:' + thumb;
          if (thumb) rowHasImage = true;
        }
        var priceInDom = '';
        var pEl = el.querySelector('.item-price-stock, [class*="item-price"], [class*="price"]');
        if (pEl) {
          var pt = txt(pEl);
          var pm = pt.match(/¥\s*(\d+(?:\.\d+)?)/);
          if (pm) priceInDom = '¥' + pm[1];
        }
        var optSelector = ROOT_SEL + ' .feature-item:nth-of-type(' + (ri + 1) + ') .expand-view-item:nth-of-type(' + (oi + 1) + ')';
        var altSelector = ROOT_SEL + ' .expand-view-item:nth-of-type(' + (oi + 1) + ')';
        options.push({ opt_id: String(oi), opt_text: optText, thumb: thumb, price_in_dom: priceInDom, selector: optSelector, alt_selector: altSelector, fallback_di: ri, fallback_oi: oi, panel_hit: ROOT_SEL });
      }
      if (rowHasImage && imageDimIndex === null) imageDimIndex = dims.length;
      dims.push({ dim_id: String(ri), dim_name: dimName || ('维度' + ri), has_image: rowHasImage, options: options });
    }
    var totalOptions = 0;
    for (var x = 0; x < dims.length; x++) totalOptions += dims[x].options.length;
    return {
      ok: dims.length > 0 && totalOptions > 0,
      dims: dims,
      image_dim_index: imageDimIndex,
      meta: { feature_count: dims.length, total_options: totalOptions, root_selector_used: root === document.querySelector(ROOT_SEL) ? ROOT_SEL : '[class*="module-od-sku-selection"]' }
    };
  }

  function _attrs() {
    var ATTR_TABLE = '#productPackInfo';
    var ATTR_KV = ['#productAttributes .module-od-product-attributes table tr', '#productAttributes .module-od-product-attributes li', '[class*="module-od-product-attributes"] table tr', '[class*="module-od-product-attributes"] li', '.obj-content table tr', '.attribute-list li', '#mod-detail-attributes table tr', '.od-pc-offer-detail-attribute table tr', '.attr-list li', '.product-props li'];
    var WEIGHT_KEYS = [{ key: '单件重量', priority: 1 }, { key: '单件毛重', priority: 1 }, { key: '毛重', priority: 2 }, { key: '包装毛重', priority: 2 }, { key: '产品毛重', priority: 2 }, { key: '产品重量', priority: 2 }, { key: '商品重量', priority: 2 }, { key: '净重', priority: 3 }, { key: '产品净重', priority: 3 }, { key: 'weight', priority: 4 }];
    var LENGTH_KEYS = [/^长$/, /长度/, /^长[(（]/, /length/i];
    var WIDTH_KEYS = [/^宽$/, /宽度/, /^宽[(（]/, /width/i];
    var HEIGHT_KEYS = [/^高$/, /高度/, /^高[(（]/, /厚度/, /height/i, /thickness/i];
    var MATERIAL_KEYS = [/材质/, /面料/, /^material/i, /^质地/, /^材料/, /填充物/];
    var SKIP_KEYS = /^(品牌|产地|发货地|颜色|尺码|型号|货号|生产厂家|是否进口|图案|风格|^风格)/;
    function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }
    function parseKV(el) {
      if (!el) return null;
      var tds = el.querySelectorAll('td, th');
      if (tds.length >= 2) {
        var k = txt(tds[0]).replace(/[:：]\s*$/, '');
        var v = txt(tds[1]);
        if (k && v) return { key: k, value: v };
      }
      var dt = el.querySelector('dt, .label, .name, .attr-name');
      var dd = el.querySelector('dd, .value, .attr-value');
      if (dt && dd) {
        var k2 = txt(dt).replace(/[:：]\s*$/, '');
        var v2 = txt(dd);
        if (k2 && v2) return { key: k2, value: v2 };
      }
      var t = txt(el);
      var m = t.match(/^([^:：]{2,30})[:：]\s*(.+)$/);
      if (m) return { key: m[1].trim(), value: m[2].trim() };
      return null;
    }
    var rawAttrs = {};
    var selectorHits = [];
    try {
      var pack = document.querySelector(ATTR_TABLE);
      if (pack) {
        var trs = pack.querySelectorAll('tr');
        var hitCount = 0;
        for (var i = 0; i < trs.length; i++) {
          var kv = parseKV(trs[i]);
          if (kv && !SKIP_KEYS.test(kv.key)) {
            if (!(kv.key in rawAttrs)) { rawAttrs[kv.key] = kv.value; hitCount++; }
          }
        }
        if (hitCount) selectorHits.push({ sel: ATTR_TABLE, count: hitCount });
      }
    } catch (e) { }
    for (var si = 0; si < ATTR_KV.length; si++) {
      try {
        var nodes = document.querySelectorAll(ATTR_KV[si]);
        if (!nodes.length) continue;
        var c = 0;
        for (var ni = 0; ni < nodes.length; ni++) {
          var kv2 = parseKV(nodes[ni]);
          if (kv2 && !SKIP_KEYS.test(kv2.key)) {
            if (!(kv2.key in rawAttrs)) { rawAttrs[kv2.key] = kv2.value; c++; }
          }
        }
        if (c) selectorHits.push({ sel: ATTR_KV[si], count: c });
      } catch (e) { }
    }
    function findWeight() {
      var bestPri = 99;
      var bestVal = null;
      for (var k in rawAttrs) {
        if (!Object.prototype.hasOwnProperty.call(rawAttrs, k)) continue;
        var lk = k.toLowerCase();
        for (var i = 0; i < WEIGHT_KEYS.length; i++) {
          var spec = WEIGHT_KEYS[i];
          if (k.indexOf(spec.key) >= 0 || lk.indexOf(spec.key.toLowerCase()) >= 0) {
            if (spec.priority < bestPri) { bestPri = spec.priority; bestVal = rawAttrs[k]; }
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
    function findMaterial() {
      var hits = [];
      for (var k in rawAttrs) {
        if (!Object.prototype.hasOwnProperty.call(rawAttrs, k)) continue;
        for (var i = 0; i < MATERIAL_KEYS.length; i++) {
          if (MATERIAL_KEYS[i].test(k)) { hits.push(rawAttrs[k]); break; }
        }
      }
      if (!hits.length) return null;
      var seen = {};
      var unique = hits.filter(function (v) { var key = v.trim(); if (seen[key]) return false; seen[key] = true; return true; });
      return unique.slice(0, 2).join('，').slice(0, 100);
    }
    function tryParseCombinedDim() {
      for (var k in rawAttrs) {
        if (!Object.prototype.hasOwnProperty.call(rawAttrs, k)) continue;
        if (!/尺寸|规格大小|包装尺寸|product\s*size/i.test(k)) continue;
        var v = rawAttrs[k];
        var nums = v.match(/(\d+(?:\.\d+)?)\s*[*xX×\/]\s*(\d+(?:\.\d+)?)\s*[*xX×\/]\s*(\d+(?:\.\d+)?)/);
        if (nums) {
          var unit = (v.match(/(cm|mm|m|厘米|毫米|米)$/i) || [])[1] || '';
          return { length: nums[1] + unit, width: nums[2] + unit, height: nums[3] + unit };
        }
      }
      return null;
    }
    var weight = findWeight();
    var length = findByPatterns(LENGTH_KEYS);
    var width = findByPatterns(WIDTH_KEYS);
    var height = findByPatterns(HEIGHT_KEYS);
    var material = findMaterial();
    if (!length || !width || !height) {
      var combined = tryParseCombinedDim();
      if (combined) {
        length = length || combined.length;
        width = width || combined.width;
        height = height || combined.height;
      }
    }
    var parsed = { weight_raw: weight, length_raw: length, width_raw: width, height_raw: height, material_raw: material };
    var missing = [];
    if (!weight) missing.push('weight');
    if (!length) missing.push('length');
    if (!width) missing.push('width');
    if (!height) missing.push('height');
    if (!material) missing.push('material');
    return {
      ok: true,
      weight: weight, length: length, width: width, height: height, material: material,
      raw_attrs: rawAttrs, parsed: parsed, missing: missing,
      meta: { selector_hits: selectorHits, total_kv_pairs: Object.keys(rawAttrs).length }
    };
  }

  function _pack() {
  function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }

  // 找包装信息表
  function findPackTable() {
    var sels = [
      '#productPackInfo .offer-pack-info-list table',
      '#productPackInfo table',
      '[class*="module-od-product-pack-info"] .offer-pack-info-list table',
      '[class*="module-od-product-pack-info"] table',
      '.offer-pack-info-list table',
    ];
    for (var i = 0; i < sels.length; i++) {
      var t = document.querySelector(sels[i]);
      if (!t) continue;
      // 校验是不是真的件重尺表（表头含「重量」或「长」「宽」「高」之一）
      var hd = txt(t).slice(0, 200);
      if (/重量|长.*宽|宽.*高|体积/.test(hd)) {
        return { table: t, sel: sels[i] };
      }
    }
    return null;
  }

  // 解析表头：返回 [{type: 'color'|'length'|'width'|'height'|'weight'|'volume'|'unknown', unit: 'cm'|'mm'|'m'|'g'|'kg'|'cm3'|'m3'|'L'|null, raw: <原文>}]
  function parseHeader(headerCells) {
    var out = [];
    for (var i = 0; i < headerCells.length; i++) {
      var raw = txt(headerCells[i]);
      var rawLower = raw.toLowerCase();
      var type = 'unknown', unit = null;
      // 颜色 / SKU
      if (/颜色|color|款式|规格|sku/i.test(raw)) {
        type = 'color';
      }
      // 重量
      else if (/重量|毛重|净重|weight/i.test(raw)) {
        type = 'weight';
        if (/kg|千克|公斤/i.test(raw)) unit = 'kg';
        else if (/g|克/.test(raw)) unit = 'g';
        else unit = 'g'; // 默认 g（最常见）
      }
      // 长
      else if (/^长\b|^长[(（]|^长度|length/i.test(raw)) {
        type = 'length';
        unit = parseLenUnit(raw);
      }
      // 宽
      else if (/^宽\b|^宽[(（]|^宽度|width/i.test(raw)) {
        type = 'width';
        unit = parseLenUnit(raw);
      }
      // 高
      else if (/^高\b|^高[(（]|^高度|^厚度|height|thickness/i.test(raw)) {
        type = 'height';
        unit = parseLenUnit(raw);
      }
      // 体积（注意：cm³ 包含 m³，要先匹配 cm³）
      else if (/体积|volume/i.test(raw)) {
        type = 'volume';
        if (/cm³|cm3|立方厘米/i.test(raw)) unit = 'cm3';
        else if (/m³|立方米/i.test(raw)) unit = 'm3';
        else if (/ml/i.test(raw)) unit = 'ml';
        else if (/L\b|升/i.test(raw)) unit = 'L';
        else unit = 'cm3';
      }
      out.push({ type: type, unit: unit, raw: raw });
    }
    return out;
  }

  function parseLenUnit(raw) {
    if (/cm|厘米/i.test(raw)) return 'cm';
    if (/mm|毫米/i.test(raw)) return 'mm';
    if (/\bm\b|米/i.test(raw)) return 'm';
    return 'cm'; // 默认 cm
  }

  // 把 "8.60" / "1.8kg" / "268g" 提取成纯数字
  function parseNum(s) {
    if (!s) return null;
    var m = String(s).match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  // 单位归一化为 g
  function toGram(num, unit) {
    if (num == null) return null;
    if (unit === 'kg') return num * 1000;
    return num; // g 或默认
  }

  // 单位归一化为 cm
  function toCm(num, unit) {
    if (num == null) return null;
    if (unit === 'mm') return num / 10;
    if (unit === 'm') return num * 100;
    return num; // cm 或默认
  }

  // 体积归一化为 cm³
  function toCm3(num, unit) {
    if (num == null) return null;
    if (unit === 'm3') return num * 1e6;
    if (unit === 'L') return num * 1000;
    if (unit === 'ml') return num;
    return num;
  }

  // 数值合理性
  function check(row) {
    var warnings = [];
    if (row.重量g != null) {
      if (row.重量g < 1 || row.重量g > 50000) warnings.push('weight_out_of_range:' + row.重量g);
    }
    var dims = ['长cm', '宽cm', '高cm'];
    for (var i = 0; i < dims.length; i++) {
      var v = row[dims[i]];
      if (v != null && (v < 0.1 || v > 500)) warnings.push(dims[i] + '_out_of_range:' + v);
    }
    return warnings;
  }

  var hit = findPackTable();
  if (!hit) {
    return {
      ok: false,
      by_color: {},
      default: null,
      meta: { table_path: null, headers: [], row_count: 0, unit_warnings: ['pack_table_not_found'] }
    };
  }

  var table = hit.table;
  // 表头：优先 thead > tr > th，否则取第一个 tr
  var headerCells = [];
  var thead = table.querySelector('thead');
  if (thead) {
    var ths = thead.querySelectorAll('th, td');
    for (var hi = 0; hi < ths.length; hi++) headerCells.push(ths[hi]);
  }
  if (!headerCells.length) {
    var firstTr = table.querySelector('tr');
    if (firstTr) {
      var fc = firstTr.querySelectorAll('th, td');
      for (var fi = 0; fi < fc.length; fi++) headerCells.push(fc[fi]);
    }
  }
  var headerSpec = parseHeader(headerCells);

  // 数据行：如果表头来自 thead，body 是 tbody > tr；否则跳过第一行
  var bodyRows = [];
  var tbody = table.querySelector('tbody');
  if (tbody) {
    var btr = tbody.querySelectorAll('tr');
    for (var bi = 0; bi < btr.length; bi++) bodyRows.push(btr[bi]);
  } else {
    var allTr = table.querySelectorAll('tr');
    for (var ai = 0; ai < allTr.length; ai++) bodyRows.push(allTr[ai]);
  }
  // 如果 body 第一行实际是表头（headerSpec 全部 unknown 时尝试跳过）
  // 简单策略：若 body 第一行的颜色列也是「颜色」字符串，跳过
  if (bodyRows.length && headerSpec[0] && headerSpec[0].type === 'color') {
    var firstColor = txt(bodyRows[0].querySelectorAll('th,td')[0] || bodyRows[0]);
    if (firstColor === '颜色' || firstColor === '规格' || firstColor === '款式') {
      bodyRows.shift();
    }
  }

  var byColor = {};
  var allWarnings = [];
  for (var ri = 0; ri < bodyRows.length; ri++) {
    var cells = bodyRows[ri].querySelectorAll('th, td');
    if (cells.length < 2) continue;
    var row = { 重量g: null, 长cm: null, 宽cm: null, 高cm: null, 体积cm3: null, color: null };
    for (var ci = 0; ci < cells.length && ci < headerSpec.length; ci++) {
      var spec = headerSpec[ci];
      var val = txt(cells[ci]);
      if (spec.type === 'color') {
        row.color = val;
      } else if (spec.type === 'weight') {
        row.重量g = toGram(parseNum(val), spec.unit);
      } else if (spec.type === 'length') {
        row.长cm = toCm(parseNum(val), spec.unit);
      } else if (spec.type === 'width') {
        row.宽cm = toCm(parseNum(val), spec.unit);
      } else if (spec.type === 'height') {
        row.高cm = toCm(parseNum(val), spec.unit);
      } else if (spec.type === 'volume') {
        row.体积cm3 = toCm3(parseNum(val), spec.unit);
      }
    }
    var w = check(row);
    if (w.length) allWarnings = allWarnings.concat(w.map(function (x) { return '[row' + ri + '@' + (row.color || '?') + ']' + x; }));
    var key = row.color || ('row_' + ri);
    byColor[key] = row;
  }

  // default: 第一行
  var defaultRow = null;
  var firstKey = Object.keys(byColor)[0];
  if (firstKey) {
    var d = byColor[firstKey];
    defaultRow = { 重量g: d.重量g, 长cm: d.长cm, 宽cm: d.宽cm, 高cm: d.高cm, 体积cm3: d.体积cm3 };
  }

  return {
    ok: Object.keys(byColor).length > 0,
    by_color: byColor,
    default: defaultRow,
    meta: {
      table_sel_used: hit.sel,
      headers: headerSpec.map(function (h) { return { type: h.type, unit: h.unit, raw: h.raw }; }),
      row_count: Object.keys(byColor).length,
      unit_warnings: allWarnings
    }
  };
}
  return { basics: _basics(), sku_dims: _sku_dims(), attrs: _attrs(), pack: _pack() };
})();
