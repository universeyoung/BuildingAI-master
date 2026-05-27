/**
 * extract_pack.js - 1688 详情页「包装信息 → 商品件重尺」表格抓取
 *
 * 真相：1688 详情页有两块独立信息：
 *   - 「商品属性」表：商家手填的外观尺寸常缺单位/漏小数点（如 86*86*90 实为 8.6*8.6*9）
 *   - 「商品件重尺」表：1688 强制要求填写的物流计费数据，按 SKU 颜色分行，**强可信**
 *
 * DOM 锚点：#productPackInfo .offer-pack-info-list table
 *           备选 [class*="module-od-product-pack-info"] table
 *
 * 表头识别：颜色 | 长(cm) | 宽(cm) | 高(cm) | 体积(cm³|m³|L) | 重量(g|kg)
 *
 * 输出：{
 *   ok: bool,
 *   by_color: { "黑色": {重量g, 长cm, 宽cm, 高cm, 体积cm3, suspicious}, ... },
 *   default: {重量g, 长cm, 宽cm, 高cm}  // 全表第一行作为默认值
 *   meta: { table_path, headers, row_count, unit_warnings }
 * }
 */
(function () {
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
})();
