/**
 * extract_basics.js - 1688 详情页基础信息（v0.2 适配 module-od-* 新模板）
 *
 * 抓取：title / shop_name / shop_url / moq / freight_hint / description / ladder_text
 *
 * 新模板锚点（2026-05 验证）：
 *   #productTitle h1                                    标题
 *   #shopNavigation a.shop-company-name                 店铺名 + URL
 *   #mainPrice .module-od-main-price                    价格区（含起订量与首价文本）
 *   #productAttributes .module-od-product-attributes    属性（含描述/物理参数）
 *
 * 返回：
 * {
 *   ok: bool,
 *   data: { title, shop_name, shop_url, moq, freight_hint, description, ladder_text, source_url },
 *   meta: { title_hit, shop_hit, price_hit, debug }
 * }
 */
(function () {
  function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }
  function attr(el, name) { return el ? (el.getAttribute(name) || '') : ''; }

  function pickFirst(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return { el: el, sel: selectors[i] };
    }
    return { el: null, sel: '' };
  }

  // ---- 标题 ----
  var titleHit = pickFirst([
    '#productTitle h1',
    '#productTitle .od-pc-offer-title',
    '[class*="od-pc-offer-title"] h1',
    '[class*="od-pc-offer-title"]',
    'h1.title',
  ]);
  var title = txt(titleHit.el).slice(0, 300);

  // ---- 店铺名 + URL ----
  var shopName = '', shopUrl = '';
  var shopHit = pickFirst([
    '#shopNavigation a.shop-company-name',
    '#shopNavigation a[href*="1688.com"]',
    '[class*="module-od-pc-shop"] a[href*="1688.com"]',
    '.shop-name a',
    'a.shop-name',
  ]);
  if (shopHit.el) {
    shopName = txt(shopHit.el).slice(0, 100);
    shopUrl = attr(shopHit.el, 'href');
    if (shopUrl && shopUrl.indexOf('//') === 0) shopUrl = 'https:' + shopUrl;
  }

  // ---- 价格区文本（用于解析 ladder + moq + freight 的兜底）----
  var priceHit = pickFirst([
    '#mainPrice',
    '[class*="module-od-main-price"]',
    '#mainPrice .module-od-main-price',
  ]);
  var priceFullText = txt(priceHit.el).slice(0, 600);

  // ---- 起订量：先从 priceFullText 找"X件起批"，再从全页找 ----
  var moq = '';
  var moqMatch = priceFullText.match(/(\d+)\s*[件套个]?\s*起批/) ||
                 priceFullText.match(/(\d+)\s*起批/);
  if (moqMatch) {
    moq = moqMatch[1] + '件起批';
  } else {
    var moqEl = document.querySelector('[class*="batch-num"], [class*="moq"], [class*="min-order"]');
    if (moqEl) moq = txt(moqEl).slice(0, 30);
  }

  // ---- 运费提示：找含"运费"/"包邮"的小文本 ----
  var freightHint = '';
  var freightCandidates = document.querySelectorAll(
    '[class*="freight"], [class*="logistics"], [class*="shipping"]'
  );
  for (var fi = 0; fi < freightCandidates.length && fi < 5; fi++) {
    var ft = txt(freightCandidates[fi]);
    if (ft && (/包邮|运费|发货/.test(ft)) && ft.length < 80) {
      freightHint = ft;
      break;
    }
  }

  // ---- 描述：从属性区或描述模块取第一段 ----
  var description = '';
  var descCandidates = [
    '#productDescription',
    '[class*="module-od-product-description"]',
    '#mod-detail-description',
    '.detail-content',
  ];
  for (var di = 0; di < descCandidates.length; di++) {
    var de = document.querySelector(descCandidates[di]);
    if (de) {
      description = txt(de).slice(0, 1500);
      if (description) break;
    }
  }

  // ---- 阶梯价文本：价格区内的批发/阶梯文本 ----
  var ladderText = '';
  var ladderEl = document.querySelector(
    '[class*="ladder"], [class*="od-pc-ladder"], [class*="discount-price-list"], [class*="module-od-discount-price"]'
  );
  if (ladderEl) ladderText = txt(ladderEl).slice(0, 400);
  // 兜底：如果价格区文本里有多个 ¥，整块作为 ladder_text
  if (!ladderText && priceFullText && (priceFullText.match(/¥/g) || []).length >= 2) {
    ladderText = priceFullText.slice(0, 400);
  }

  return {
    ok: !!title,
    data: {
      title: title,
      shop_name: shopName,
      shop_url: shopUrl,
      moq: moq,
      freight_hint: freightHint,
      description: description,
      ladder_text: ladderText,
      source_url: location.href,
      product_id: (location.pathname.match(/offer\/(\d+)/) || [])[1] || '',
    },
    meta: {
      title_hit: titleHit.sel || null,
      shop_hit: shopHit.sel || null,
      price_hit: priceHit.sel || null,
      price_full_text: priceFullText.slice(0, 200),
    },
  };
})();
