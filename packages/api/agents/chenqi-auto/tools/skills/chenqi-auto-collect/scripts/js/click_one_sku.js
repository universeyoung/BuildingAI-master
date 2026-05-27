/**
 * click_one_sku.js - 点击 1 个 SKU option（v0.3.2 推荐用全局变量传参）
 *
 * 【v0.3.2 推荐】先注入 window.__SKU_PARAMS__ = {selector, fallback_di, fallback_oi, panel_hit}
 *  再 execute_javascript 本脚本，**完全避开模板字符串替换的 SyntaxError 坑**（教训 #21.7）
 *
 * 【v0.2 兼容】如果未设 __SKU_PARAMS__，fallback 到占位符替换：
 *   __SELECTOR__       - 主选择器字符串
 *   __FALLBACK_DI__    - 维度索引（int）
 *   __FALLBACK_OI__    - 选项索引（int）
 *   __PANEL_HIT__      - SKU 根面板选择器
 *
 * 策略：
 *   1) 主选择器命中 → 派发完整 mousedown/mouseup/click
 *   2) 主失败 → 在 PANEL_HIT 内取第 di 个 .feature-item，再取第 oi 个 option 子节点
 *   3) 派发 mouse events 后等待 1.2s 让前端渲染主图/价格
 *
 * 返回：{ ok, hit, method, error?, sleep_ms, target_text, params_source }
 */
(function () {
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

  // ---- v0.3.2: 优先读全局变量（避免占位符替换的 SyntaxError） ----
  var SELECTOR = '';
  var DI = NaN;
  var OI = NaN;
  var PANEL = '';
  var paramsSource = '';

  if (typeof window !== 'undefined' && window.__SKU_PARAMS__ && typeof window.__SKU_PARAMS__ === 'object') {
    var p = window.__SKU_PARAMS__;
    SELECTOR = p.selector || '';
    DI = (p.fallback_di === 0 || p.fallback_di) ? parseInt(p.fallback_di, 10) : NaN;
    OI = (p.fallback_oi === 0 || p.fallback_oi) ? parseInt(p.fallback_oi, 10) : NaN;
    PANEL = p.panel_hit || '';
    paramsSource = 'window.__SKU_PARAMS__';
  } else {
    // ---- v0.2 fallback: 占位符替换（向后兼容） ----
    SELECTOR = '__SELECTOR__';
    DI = parseInt('__FALLBACK_DI__', 10);
    OI = parseInt('__FALLBACK_OI__', 10);
    PANEL = '__PANEL_HIT__';
    paramsSource = 'placeholders';
    // 防漏：占位符未替换时清掉
    if (SELECTOR === '__' + 'SELECTOR__') SELECTOR = '';
    if (PANEL === '__' + 'PANEL_HIT__') PANEL = '';
  }

  var hit = null;
  var method = '';

  // 1) 主选择器
  if (SELECTOR) {
    try { hit = document.querySelector(SELECTOR); } catch (e) {}
    if (hit) method = 'primary_selector';
  }

  // 2) 兜底：PANEL 内 .feature-item:nth-of-type(DI+1) > a/button/li/option:nth(OI+1)
  if (!hit && PANEL && !isNaN(DI) && !isNaN(OI)) {
    var panel = document.querySelector(PANEL);
    if (panel) {
      var rows = panel.querySelectorAll('.feature-item, [class*="feature-item"]');
      if (!rows.length) rows = panel.children;
      var row = rows[DI];
      if (row) {
        // v0.2: option 主锚点 .expand-view-item
        var opts = row.querySelectorAll('.expand-view-item, [class*="expand-view-item"], .option, .feature-option, .sku-item, [class*="sku-item"], a, button, li');
        // 去掉嵌套
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

  if (!hit) {
    return { ok: false, error: 'target_not_found', selector_tried: SELECTOR, panel: PANEL, di: DI, oi: OI, params_source: paramsSource };
  }

  // scroll into view
  try { hit.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) {
    try { hit.scrollIntoView(); } catch (e2) {}
  }

  // 派发事件
  var fired = fire(hit);
  // 有的 SKU 真正交互的是子 div，也派发到 firstElementChild 加固
  if (hit.firstElementChild) fire(hit.firstElementChild);

  return {
    ok: fired,
    hit: true,
    method: method,
    target_text: txt(hit).slice(0, 80),
    sleep_ms: 1200,  // 调用方应等待这么久再抓主图/价格
    params_source: paramsSource,
  };
})();
