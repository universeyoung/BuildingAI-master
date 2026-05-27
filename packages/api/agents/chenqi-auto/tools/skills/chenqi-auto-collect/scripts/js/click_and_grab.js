/**
 * click_and_grab.js - 点击 1 个 SKU option，等待 1.5s，抓主图+价格（合并版）
 *
 * 占位符：
 *   __SELECTOR__       - 主选择器
 *   __FALLBACK_DI__    - 维度索引
 *   __FALLBACK_OI__    - 选项索引
 *   __PANEL_HIT__      - SKU 根面板
 *
 * 用 async + setTimeout 实现内嵌 1.5s 等待（browser_console 必须 await Promise）。
 *
 * 返回（Promise）：
 * {
 *   click: { ok, method, target_text, error? },
 *   main_image: { ok, url, source, naturalWidth, naturalHeight },
 *   sku_price: { ok, price, price_text, ladder_text, source }
 * }
 */
(async function () {
  // ---- click 部分 ----
  function fire(el) {
    if (!el) return false;
    try {
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      ['mousedown', 'mouseup', 'click'].forEach(function (type) {
        var ev = new MouseEvent(type, {
          bubbles: true, cancelable: true, view: window,
          clientX: cx, clientY: cy, button: 0,
        });
        el.dispatchEvent(ev);
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }

  var SELECTOR = '__SELECTOR__';
  var DI = parseInt('__FALLBACK_DI__', 10);
  var OI = parseInt('__FALLBACK_OI__', 10);
  var PANEL = '__PANEL_HIT__';

  var hit = null;
  var method = '';

  if (SELECTOR && SELECTOR !== '__' + 'SELECTOR__') {
    try { hit = document.querySelector(SELECTOR); } catch (e) {}
    if (hit) method = 'primary_selector';
  }
  if (!hit && PANEL && !isNaN(DI) && !isNaN(OI)) {
    var panel = document.querySelector(PANEL);
    if (panel) {
      var rows = panel.querySelectorAll('.feature-item, [class*="feature-item"]');
      if (!rows.length) rows = panel.children;
      var row = rows[DI];
      if (row) {
        var opts = row.querySelectorAll('.expand-view-item, [class*="expand-view-item"], .option, .feature-option, .sku-item, [class*="sku-item"], a, button, li');
        var unique = [];
        for (var i = 0; i < opts.length; i++) {
          var nested = false;
          for (var j = 0; j < opts.length; j++) {
            if (i !== j && opts[i].contains(opts[j])) { nested = true; break; }
          }
          if (!nested) unique.push(opts[i]);
        }
        hit = unique[OI];
        if (hit) method = 'fallback_index';
      }
    }
  }

  var clickResult;
  if (!hit) {
    clickResult = { ok: false, method: 'none', error: 'target_not_found' };
  } else {
    try { hit.scrollIntoView({ block: 'center' }); } catch (e) {}
    var fired = fire(hit);
    if (hit.firstElementChild) fire(hit.firstElementChild);
    clickResult = { ok: fired, method: method, target_text: txt(hit).slice(0, 80) };
  }

  // ---- 等 1.5s ----
  await new Promise(function (r) { setTimeout(r, 1500); });

  // ---- 抓主图 ----
  function cleanUrl(u) {
    if (!u) return '';
    if (u.indexOf('//') === 0) u = 'https:' + u;
    return u.trim();
  }
  var imgCandidates = [
    { sel: '.od-gallery-preview img.ant-image-img.preview-img', src: 'preview-img' },
    { sel: '.od-gallery-preview img[src]', src: 'gallery-img' },
    { sel: '[class*="module-od-pc-gallery"] .preview img', src: 'gallery-old' },
    { sel: '[class*="gallery-preview"] img', src: 'gallery-generic' },
  ];
  var mainImage = { ok: false, url: '', source: 'not_found' };
  for (var ci = 0; ci < imgCandidates.length; ci++) {
    var ie = document.querySelector(imgCandidates[ci].sel);
    if (ie && ie.src) {
      mainImage = {
        ok: true,
        url: cleanUrl(ie.src),
        source: imgCandidates[ci].src,
        naturalWidth: ie.naturalWidth || 0,
        naturalHeight: ie.naturalHeight || 0,
      };
      break;
    }
  }
  if (!mainImage.ok) {
    var imgs = document.querySelectorAll('img');
    for (var k = 0; k < imgs.length; k++) {
      if ((imgs[k].naturalWidth || 0) >= 300 && imgs[k].src) {
        mainImage = {
          ok: true,
          url: cleanUrl(imgs[k].src),
          source: 'fallback_natural',
          naturalWidth: imgs[k].naturalWidth,
          naturalHeight: imgs[k].naturalHeight,
        };
        break;
      }
    }
  }

  // ---- 抓价格 ----
  var priceRoot = document.querySelector('#mainPrice') ||
                  document.querySelector('[class*="module-od-main-price"]');
  var skuPrice = { ok: false, price: null, price_text: '', ladder_text: '', source: '' };
  if (priceRoot) {
    var primarySels = [
      '#mainPrice span.currency',
      '#mainPrice .currency',
      '[class*="module-od-main-price"] .currency',
      '#mainPrice [class*="discount-price"]',
      '#mainPrice [class*="price-now"]',
      '#mainPrice [class*="price-text"]',
    ];
    for (var pi = 0; pi < primarySels.length; pi++) {
      var nodes = document.querySelectorAll(primarySels[pi]);
      for (var pj = 0; pj < nodes.length; pj++) {
        var pt = txt(nodes[pj]);
        var pm = pt.match(/(\d+(?:\.\d+)?)/);
        if (pm) {
          skuPrice.price = parseFloat(pm[1]);
          skuPrice.price_text = pt.slice(0, 40);
          skuPrice.source = primarySels[pi];
          skuPrice.ok = true;
          break;
        }
      }
      if (skuPrice.ok) break;
    }
    var rootText = txt(priceRoot);
    if (!skuPrice.ok) {
      var nm; var numRe = /(\d+(?:\.\d+)?)/g; var found = [];
      while ((nm = numRe.exec(rootText)) !== null) {
        var v = parseFloat(nm[1]);
        if (!isNaN(v) && v >= 0.5 && v < 1000000) { found.push(v); break; }
        if (found.length > 30) break;
      }
      if (found.length) {
        skuPrice.price = found[0];
        skuPrice.price_text = '¥' + found[0];
        skuPrice.source = 'fallback_min';
        skuPrice.ok = true;
      }
    }
    var ladderSels = ['[class*="discount-price-list"]', '[class*="ladder"]', '[class*="batchsize"]'];
    for (var li = 0; li < ladderSels.length; li++) {
      var le = document.querySelector(ladderSels[li]);
      if (le) {
        var lt = txt(le);
        if (lt && lt.length > 4) { skuPrice.ladder_text = lt.slice(0, 400); break; }
      }
    }
    if (!skuPrice.ladder_text && (rootText.match(/¥/g) || []).length >= 2) {
      skuPrice.ladder_text = rootText.slice(0, 400);
    }
  }

  return { click: clickResult, main_image: mainImage, sku_price: skuPrice };
})();
