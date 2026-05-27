/* ============================================================
   辰启-公共模块：Ozon 搜索/类目页商品标题提取脚本（浏览器端）
   权威源：agent-core/skills/_chenqi_common/ozon_seo_extract.js

   用法：
     由 browser sub-agent 注入到已经打开的 Ozon 搜索页/类目页 console
     一次执行返回 JSON 字符串：
       { url, count, titles: [...], errors: [...] }

   依赖：无
   兼容：Ozon 当前版本（2026-05），商品卡片选择器 a.tile-clickable-element

   设计要点：
     - 单段 IIFE，避免多次 console eval 复读浪费 token
     - 同时去重（title 完全相同的合一份）
     - 过滤过短（<10 字符）和明显非标题文本
     - 容忍 selector 失效（fallback 到 a[href*="/product/"]）
============================================================ */
(function () {
  const MIN_LEN = 10;
  const MAX_RESULTS = 60;
  const errors = [];
  const titles = [];
  const seen = new Set();

  // 主选择器
  let nodes = document.querySelectorAll('a.tile-clickable-element');
  if (!nodes || nodes.length === 0) {
    errors.push('primary selector empty, fallback to a[href*="/product/"]');
    nodes = document.querySelectorAll('a[href*="/product/"]');
  }

  for (const a of nodes) {
    if (titles.length >= MAX_RESULTS) break;
    // 取卡片内文字最长的那一段作为标题（避免拿到价格/评价数等短文字）
    let txt = (a.innerText || a.textContent || '').trim();
    if (!txt) continue;
    // 卡片可能有多行，挑最长的一行
    const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      lines.sort((a, b) => b.length - a.length);
      txt = lines[0];
    }
    // 过滤短文本和明显非标题（含 % / отзыв / ₽）
    if (txt.length < MIN_LEN) continue;
    if (/%|отзыв|₽|\bруб\b/i.test(txt) && txt.length < 25) continue;
    if (seen.has(txt)) continue;
    seen.add(txt);
    titles.push(txt);
  }

  const out = {
    url: location.href,
    count: titles.length,
    titles: titles,
    errors: errors,
  };
  // 返回 JSON 字符串（agent 用 JSON.parse 即可）
  return JSON.stringify(out);
})();
