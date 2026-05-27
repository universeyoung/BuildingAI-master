/**
 * extract_sku_dims.js - 1688 详情页 SKU 维度抓取（v0.2 适配 module-od-* 新模板）
 *
 * 锚点：#skuSelection .feature-item
 *   每个 .feature-item = 1 个 dim（如"颜色"/"规格"/"品牌"）
 *   .feature-item 内部含 label + 多个 option（颜色 dim 的 option 含 img）
 *
 * 返回：
 * {
 *   ok: bool,
 *   dims: [{
 *     dim_id: "0|1|...",          // 行序号（无 data-id 时用）
 *     dim_name: "颜色",
 *     has_image: bool,            // 该 dim 的 option 是否含主图（true → 是图属性 dim，扁平化时主用）
 *     options: [{
 *       opt_id: "0|1|...",        // 列序号
 *       opt_text: "黑色",
 *       thumb: "https://..." | "",
 *       price_in_dom: "" | "¥17.50",  // option 自带的价格文字（极少有）
 *       selector: "#skuSelection .feature-item:nth-child(N) > * > *:nth-child(M)",
 *       fallback_di: 0,
 *       fallback_oi: 0,
 *       panel_hit: "#skuSelection",
 *     }]
 *   }],
 *   image_dim_index: int|null,   // dims 数组中第一个 has_image=true 的下标
 *   meta: { feature_count, total_options, debug }
 * }
 */
(function () {
  function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }

  var ROOT_SEL = '#skuSelection';
  var root = document.querySelector(ROOT_SEL);
  if (!root) {
    root = document.querySelector('[class*="module-od-sku-selection"]');
  }
  if (!root) {
    return {
      ok: false,
      dims: [],
      image_dim_index: null,
      meta: { error: 'sku_root_not_found' },
    };
  }

  var dims = [];
  var imageDimIndex = null;

  // 取 .feature-item，但排除 label 单元（class 仅为 feature-item-label）
  var rawRows = root.querySelectorAll('.feature-item, [class*="feature-item"]');
  var rows = [];
  for (var rri = 0; rri < rawRows.length; rri++) {
    var rrEl = rawRows[rri];
    var rrCls = (typeof rrEl.className === 'string') ? rrEl.className : '';
    // 跳过纯 label 行
    if (rrCls === 'feature-item-label' || rrCls.indexOf('feature-item-label') >= 0 && rrCls.indexOf('feature-item ') < 0 && !rrCls.match(/\bfeature-item\b/)) {
      continue;
    }
    // 真正的行：必须包含 .expand-view-item 或者 .v-flex 子选项
    if (!rrEl.querySelector('.expand-view-item, [class*="expand-view-item"], .option, [class*="option"]')) {
      continue;
    }
    rows.push(rrEl);
  }
  // 兜底：如果没找到，再用第一层子节点（去掉 label-only）
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

    // 找 label：.feature-item-label 是直接子节点
    var dimName = '';
    var labelEl = row.querySelector('.feature-item-label, .label, [class*="title"], dt, .name, h3');
    if (labelEl) {
      dimName = txt(labelEl);
    }

    // 找 options：v0.2 锚点 .expand-view-item（每个 option = 1 个 SKU）
    var optEls = [];
    var primaryFound = row.querySelectorAll('.expand-view-item, [class*="expand-view-item"]');
    if (primaryFound.length) {
      for (var pf = 0; pf < primaryFound.length; pf++) optEls.push(primaryFound[pf]);
    } else {
      // 老模板兜底
      var legacy = row.querySelectorAll('.option, .feature-option, .sku-item, [class*="sku-item"], a, button, li');
      for (var lg = 0; lg < legacy.length; lg++) optEls.push(legacy[lg]);
    }
    // 去嵌套：如果某 el 是另一 el 的祖先，丢掉祖先
    optEls = optEls.filter(function (el) {
      for (var k = 0; k < optEls.length; k++) {
        if (optEls[k] !== el && el.contains(optEls[k])) return false;
      }
      return true;
    });
    // 去重
    var seen = [];
    optEls = optEls.filter(function (el) {
      if (seen.indexOf(el) >= 0) return false;
      seen.push(el);
      return true;
    });
    // 上限 30
    optEls = optEls.slice(0, 30);

    var options = [];
    var rowHasImage = false;
    for (var oi = 0; oi < optEls.length; oi++) {
      var el = optEls[oi];
      // 优先用 .item-label 作为 option 文字（去除价格/库存噪声）
      var labelInner = el.querySelector('.item-label, [class*="item-label"]');
      var optText = labelInner ? txt(labelInner) : txt(el).split('\n')[0];
      optText = (optText || '').slice(0, 80);

      // thumb（option 自带缩略图）
      var img = el.querySelector('img.ant-image-img, .ant-image img, img');
      var thumb = '';
      if (img) {
        thumb = img.src || img.getAttribute('data-src') || '';
        if (thumb && thumb.indexOf('//') === 0) thumb = 'https:' + thumb;
        if (thumb) rowHasImage = true;
      }

      // option 自带价格（v0.2 重大特性）
      var priceInDom = '';
      var pEl = el.querySelector('.item-price-stock, [class*="item-price"], [class*="price"]');
      if (pEl) {
        var pt = txt(pEl);
        var pm = pt.match(/¥\s*(\d+(?:\.\d+)?)/);
        if (pm) priceInDom = '¥' + pm[1];
      }

      // selector：用 .expand-view-item:nth-of-type
      var optSelector = ROOT_SEL + ' .feature-item:nth-of-type(' + (ri + 1) + ') .expand-view-item:nth-of-type(' + (oi + 1) + ')';
      var altSelector = ROOT_SEL + ' .expand-view-item:nth-of-type(' + (oi + 1) + ')';

      options.push({
        opt_id: String(oi),
        opt_text: optText,
        thumb: thumb,
        price_in_dom: priceInDom,
        selector: optSelector,
        alt_selector: altSelector,
        fallback_di: ri,
        fallback_oi: oi,
        panel_hit: ROOT_SEL,
      });
    }

    if (rowHasImage && imageDimIndex === null) {
      imageDimIndex = dims.length;
    }
    dims.push({
      dim_id: String(ri),
      dim_name: dimName || ('维度' + ri),
      has_image: rowHasImage,
      options: options,
    });
  }

  var totalOptions = 0;
  for (var x = 0; x < dims.length; x++) totalOptions += dims[x].options.length;

  return {
    ok: dims.length > 0 && totalOptions > 0,
    dims: dims,
    image_dim_index: imageDimIndex,
    meta: {
      feature_count: dims.length,
      total_options: totalOptions,
      root_selector_used: root === document.querySelector(ROOT_SEL) ? ROOT_SEL : '[class*="module-od-sku-selection"]',
    },
  };
})();
