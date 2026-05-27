/**
 * grab_main_image.js - 抓 SKU 切换后的主图（v0.2 适配 module-od-* 新模板）
 *
 * 锚点：.od-gallery-preview img.ant-image-img.preview-img
 * 兜底：
 *   - .od-gallery-preview img[src]
 *   - .module-od-pc-gallery .preview img
 *   - 第一张 naturalWidth >= 300 的 img
 *
 * 返回：{ ok, url, source, naturalWidth, naturalHeight }
 */
(function () {
  function clean(u) {
    if (!u) return '';
    if (u.indexOf('//') === 0) u = 'https:' + u;
    return u.trim();
  }

  var candidates = [
    { sel: '.od-gallery-preview img.ant-image-img.preview-img', src: 'preview-img' },
    { sel: '.od-gallery-preview img[src]', src: 'gallery-img' },
    { sel: '[class*="module-od-pc-gallery"] .preview img', src: 'gallery-old' },
    { sel: '[class*="gallery-preview"] img', src: 'gallery-generic' },
  ];

  for (var i = 0; i < candidates.length; i++) {
    var el = document.querySelector(candidates[i].sel);
    if (el && el.src) {
      return {
        ok: true,
        url: clean(el.src),
        source: candidates[i].src,
        naturalWidth: el.naturalWidth || 0,
        naturalHeight: el.naturalHeight || 0,
      };
    }
  }

  // 最后兜底：全页找 naturalWidth >= 300 的第一张
  var imgs = document.querySelectorAll('img');
  for (var k = 0; k < imgs.length; k++) {
    if ((imgs[k].naturalWidth || 0) >= 300 && imgs[k].src) {
      return {
        ok: true,
        url: clean(imgs[k].src),
        source: 'fallback_natural',
        naturalWidth: imgs[k].naturalWidth,
        naturalHeight: imgs[k].naturalHeight,
      };
    }
  }

  return { ok: false, url: '', source: 'not_found' };
})();
