/**
 * extract_3in1.js - basics + sku_dims + attrs + main_gallery 一次执行返回
 *
 * browser_console 注入即可。返回：
 * { basics: <...>, sku_dims: <...>, attrs: <...>, main_gallery: <...> }
 *
 * 四段代码原样照抄自 extract_basics.js / extract_sku_dims.js / extract_attrs.js / extract_main_gallery（v0.3 新增），
 * 只是把外层 IIFE 改成普通函数 _basics() / _sku_dims() / _attrs() / _main_gallery() 然后在最外层 return 四者。
 *
 * v0.3 新增 _main_gallery()：抓主图轮播 3-8 张 1688 原 CDN 大图 URL，下游图片技能直接 fetch 喂 image_edit 当 reference_images。
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

  function _main_gallery() {
    /**
     * 抓主图轮播 3-8 张 1688 CDN 大图 URL。
     *
     * 设计要点：
     *   1. 多选择器并联，优先抓"主图轮播缩略图列表"（最规范的多角度图组）
     *   2. URL 清洗：去掉 _sum.jpg / _NxN.jpg / _90x90.jpg 等缩略后缀，保留原图
     *   3. 去重：按"清洗后路径"去重（同一张图多个尺寸只留一份）
     *   4. 校验：要求 URL 来自 1688 已知 CDN 域（cbu01.alicdn.com / img.alicdn.com）
     *   5. 数量截断 ≤ 8 张
     */
    function attr(el, name) { return el ? (el.getAttribute(name) || '') : ''; }

    // --- selector 优先级：主图轮播 → 主图区 → 兜底 ---
    var SELECTORS = [
      // 1688 新版主图轮播缩略图（最规范，通常 3-7 张多角度）
      '#mainPic [class*="od-pc-offer-img"] img',
      '#mainPic .ant-image-img',
      '[class*="module-od-pc-offer-img"] img',
      '[class*="offer-img-list"] img',
      '[class*="thumb-list"] img',
      // 主图大图本身
      '#mainPic img',
      // 兜底：所有 1688 CDN 大图
      'img[src*="cbu01.alicdn.com"]',
      'img[src*="img.alicdn.com"]'
    ];

    function cleanThumbUrl(u) {
      if (!u) return '';
      // 协议补全
      if (u.indexOf('//') === 0) u = 'https:' + u;
      if (u.indexOf('http') !== 0) return '';
      // 去掉常见缩略后缀（沿用 v0.2 thumb 清洗规则）：
      //   _sum.jpg / _xxx_sum.jpg → 删 _sum
      //   _90x90.jpg / _200x200.jpg / _NxN.jpg → 删尺寸后缀
      //   保留 _!!xxx-0-cib.jpg 这类路径段（不是缩略，是 1688 路径标记）
      u = u.replace(/_sum\.jpg(\?.*)?$/i, '.jpg$1');
      u = u.replace(/_\d{2,4}x\d{2,4}\.jpg(\?.*)?$/i, '.jpg$1');
      u = u.replace(/_\d{2,4}x\d{2,4}\.png(\?.*)?$/i, '.png$1');
      // 去 query string（1688 CDN 不依赖 query）
      var qIdx = u.indexOf('?');
      if (qIdx > 0) u = u.substring(0, qIdx);
      return u;
    }

    function isValidCdnUrl(u) {
      if (!u || u.length < 10) return false;
      // 必须是 1688 已知 CDN
      if (!/cbu01\.alicdn\.com|img\.alicdn\.com|gw\.alicdn\.com/i.test(u)) return false;
      // 排除明显非商品图（icon / sprite / placeholder）
      if (/icon|sprite|placeholder|loading|blank/i.test(u)) return false;
      // 文件扩展名要是图片
      if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u)) return false;
      return true;
    }

    var seenPaths = {};
    var urls = [];
    var hitsBySelector = [];

    for (var si = 0; si < SELECTORS.length; si++) {
      var sel = SELECTORS[si];
      var imgs = document.querySelectorAll(sel);
      if (!imgs.length) continue;
      var hitCount = 0;
      for (var ii = 0; ii < imgs.length && urls.length < 8; ii++) {
        var img = imgs[ii];
        var raw = img.src || attr(img, 'data-src') || attr(img, 'data-original') || '';
        var cleaned = cleanThumbUrl(raw);
        if (!isValidCdnUrl(cleaned)) continue;
        // 路径去重（不带 query）
        if (seenPaths[cleaned]) continue;
        seenPaths[cleaned] = true;
        urls.push(cleaned);
        hitCount++;
      }
      if (hitCount) hitsBySelector.push({ sel: sel, count: hitCount });
      if (urls.length >= 8) break;  // 够 8 张就停
    }

    return {
      ok: urls.length >= 1,
      urls: urls,
      count: urls.length,
      meta: {
        selector_hits: hitsBySelector,
        target_min: 3,
        target_max: 8,
        warning: urls.length < 3 ? 'gallery_too_few_images' : null
      }
    };
  }

  return { basics: _basics(), sku_dims: _sku_dims(), attrs: _attrs(), main_gallery: _main_gallery() };
})();
