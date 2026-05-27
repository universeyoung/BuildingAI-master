/**
 * grab_sku_price.js - 抓 SKU 切换后的价格（v0.3.2 修复 1688 改版 currency 拆分）
 *
 * 改版症状（教训 #21.6）：
 *   1688 把整数和小数拆成两个 sibling span：
 *     <span class="currency">6</span><span class="currency">.50</span>
 *   v0.2 取第一个 .currency 拿到 "6"，丢失了小数部分。
 *
 * v0.3.2 主路：找 .currency 后，**向上 2 级父容器**取 textContent 去空白，
 *   再正则匹配 `\d+\.?\d*`，能正确还原 "¥6.50"。
 *
 * 兜底：
 *   - .price-info / [class*="price"] 容器整块去空白匹配
 *   - 整个 #mainPrice 文本去空白后匹配第一个 ¥X.X
 * 阶梯价：[class*="ladder"] / [class*="discount-price-list"] 整块文本
 *
 * 返回：
 * {
 *   ok, price, price_text, ladder_text,
 *   source, all_numbers, debug
 * }
 */
(function () {
  function txt(el) { return el ? (el.innerText || el.textContent || '').trim() : ''; }
  function txtNoWs(el) {
    if (!el) return '';
    var s = el.textContent || el.innerText || '';
    return s.replace(/\s+/g, '');  // 去掉所有空白（含换行），把拆分的 currency 拼回来
  }

  var ROOT = document.querySelector('#mainPrice') ||
             document.querySelector('[class*="module-od-main-price"]');

  if (!ROOT) {
    return { ok: false, error: 'main_price_root_not_found' };
  }

  // ---- 1) 主价：v0.3.2 新策略 ----
  // 改版后 .currency 被拆成 <span>6</span><span>.50</span>
  // 解法：找 .currency 节点，向上找最近的「价格容器」，整个去空白后正则
  var price = null;
  var priceText = '';
  var source = '';
  var debugAttempts = [];

  // 1a. 优先用整个价格容器（去空白拼接）
  var containerSels = [
    '#mainPrice [class*="price-info"]',          // 改版后新容器
    '#mainPrice [class*="discount-price"]',
    '#mainPrice [class*="price-now"]',
    '#mainPrice [class*="price-text"]',
    '[class*="module-od-main-price"] [class*="price-info"]',
  ];
  for (var ci = 0; ci < containerSels.length; ci++) {
    var nodes = document.querySelectorAll(containerSels[ci]);
    for (var cj = 0; cj < nodes.length; cj++) {
      var compact = txtNoWs(nodes[cj]);  // "¥6.502件起批" 这种
      // 匹配 ¥xx.xx，必须带 ¥ 才信（防把数量误认价格）
      var m = compact.match(/¥(\d+(?:\.\d+)?)/);
      if (m) {
        price = parseFloat(m[1]);
        priceText = '¥' + m[1];
        source = containerSels[ci] + ' (compact)';
        debugAttempts.push({sel: containerSels[ci], compact: compact.slice(0,50), matched: m[1]});
        break;
      } else {
        debugAttempts.push({sel: containerSels[ci], compact: compact.slice(0,50), matched: null});
      }
    }
    if (price !== null) break;
  }

  // 1b. 兜底：找 .currency 节点，向上 2 级父容器整块去空白
  if (price === null) {
    var currencyNodes = document.querySelectorAll('#mainPrice .currency, [class*="module-od-main-price"] .currency');
    for (var ki = 0; ki < currencyNodes.length; ki++) {
      var node = currencyNodes[ki];
      var parent = node.parentElement;
      if (parent && parent.parentElement) parent = parent.parentElement;
      var compact2 = txtNoWs(parent);
      var m2 = compact2.match(/¥(\d+(?:\.\d+)?)/) || compact2.match(/^(\d+(?:\.\d+)?)/);
      if (m2) {
        price = parseFloat(m2[1]);
        priceText = '¥' + m2[1];
        source = '.currency parent2 (compact)';
        debugAttempts.push({sel: '.currency parent2', compact: compact2.slice(0,50), matched: m2[1]});
        break;
      }
    }
  }

  // 1c. 最后兜底：兼容老版（单 .currency 完整带价）
  if (price === null) {
    var primarySels = [
      '#mainPrice span.currency',
      '#mainPrice .currency',
    ];
    for (var i = 0; i < primarySels.length; i++) {
      var nodes2 = document.querySelectorAll(primarySels[i]);
      for (var j = 0; j < nodes2.length; j++) {
        var t = txt(nodes2[j]);
        var mt = t.match(/(\d+\.\d+)/);  // **必须有小数点**才信单 .currency（避新版只拿到整数）
        if (mt) {
          price = parseFloat(mt[1]);
          priceText = t.slice(0, 40);
          source = primarySels[i] + ' (legacy)';
          break;
        }
      }
      if (price !== null) break;
    }
  }

  // ---- 2) 兜底：扫整块所有数字 ----
  var rootText = txt(ROOT);
  var allNumbers = [];
  var numRe = /(\d+(?:\.\d+)?)/g;
  var nm;
  while ((nm = numRe.exec(rootText)) !== null) {
    var v = parseFloat(nm[1]);
    if (!isNaN(v) && v > 0 && v < 1000000) allNumbers.push(v);
    if (allNumbers.length > 30) break;
  }
  if (price === null && allNumbers.length) {
    // 取最小数字（通常是单价；起订量数字会很小但加单位前缀，我们取价格区第一个 >= 0.5 的）
    var firstReasonable = allNumbers.find(function (x) { return x >= 0.5; });
    if (firstReasonable !== undefined) {
      price = firstReasonable;
      priceText = '¥' + firstReasonable;
      source = 'fallback_min_in_main_price';
    }
  }

  // ---- 3) 阶梯价文本（不解析数值，留给 parsers.py）----
  var ladderText = '';
  var ladderSels = [
    '[class*="discount-price-list"]',
    '[class*="ladder"]',
    '[class*="od-pc-ladder"]',
    '[class*="module-od-discount-price"]',
    '[class*="batchsize"]',
  ];
  for (var li = 0; li < ladderSels.length; li++) {
    var le = document.querySelector(ladderSels[li]);
    if (le) {
      var lt = txt(le);
      if (lt && lt.length > 4) {
        ladderText = lt.slice(0, 400);
        break;
      }
    }
  }
  // 兜底：如果 mainPrice 整块出现 >= 2 个 ¥，整块作为 ladder_text
  if (!ladderText && (rootText.match(/¥/g) || []).length >= 2) {
    ladderText = rootText.slice(0, 400);
  }

  return {
    ok: price !== null,
    price: price,
    price_text: priceText,
    ladder_text: ladderText,
    source: source,
    all_numbers: allNumbers.slice(0, 20),
    debug: {
      root_text_preview: rootText.slice(0, 120),
      attempts: debugAttempts.slice(0, 6),
    },
  };
})();
