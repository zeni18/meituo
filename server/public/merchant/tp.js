/* Merchant UI v2 — TP display.
   The billing unit formerly shown as 算力 / 积分 is displayed as TP:
   amounts become "<TP mark> 40"; the bare word becomes "TP".
   Display-only: API fields, prices and stored values are unchanged.
   The TP mark is U+E000, drawn by the "TP Glyph" font (ui-v2.css), so text
   nodes are rewritten in place and stay safe under Vue re-renders.
   Spec: docs/design/merchant-ui-v2.md */
(() => {
  'use strict';
  const MARK = '';
  const NUM = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const UNIT = '(?:算力|积分)';
  const CJK = /[㐀-鿿＀-￯]/;
  const rules = [
    // 40 算力 / 65.00 算力 / 40算力/张 / 10 点算力
    [new RegExp(NUM + '\\s*(?:点\\s*)?' + UNIT, 'g'), MARK + ' $1'],
    // 算力 ◇ 0 / 算力：120 / 积分 12
    [new RegExp(UNIT + '\\s*(?:[:：]|◇|✧|◆)?\\s*' + NUM, 'g'), MARK + ' $1'],
    // ✧ 0 (account menu points)
    [/[✧◇]\s*(?=\d)/g, MARK + ' '],
    // 剩余算力 / 剩余积分
    [new RegExp('剩余' + UNIT, 'g'), '剩余 TP']
  ];
  const word = (s) => s.replace(/算力|积分/g, (m, off, str) => {
    const before = str[off - 1] || '', after = str[off + m.length] || '';
    return (CJK.test(before) ? ' ' : '') + 'TP' + (CJK.test(after) ? ' ' : '');
  });
  const textRe = /算力|积分|[✧◇]\s*\d/;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT']);

  function convert(s) {
    let out = s;
    for (const [re, rep] of rules) out = out.replace(re, rep);
    return word(out);
  }
  function attrConvert(s) {
    return word(s.replace(new RegExp(NUM + '\\s*(?:点\\s*)?' + UNIT, 'g'), '$1 TP').replace(new RegExp(UNIT + '\\s*(?:[:：])?\\s*' + NUM, 'g'), 'TP $1'));
  }
  function skip(el) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (SKIP.has(e.tagName) || e.isContentEditable || e.hasAttribute?.('data-no-tp')) return true;
    }
    return false;
  }
  function fixText(node) {
    const v = node.nodeValue;
    if (!v || !textRe.test(v)) return;
    const parent = node.parentElement;
    if (!parent || skip(parent)) return;
    const next = convert(v);
    if (next === v) return;
    node.nodeValue = next;
    if (next.includes(MARK)) {
      const ff = getComputedStyle(parent).fontFamily;
      if (!/Inter|Imagine Sans|TP Glyph/.test(ff)) parent.classList.add('tp-font');
    }
  }
  function fixAttrs(el) {
    for (const name of ['title', 'aria-label', 'placeholder', 'alt']) {
      const v = el.getAttribute?.(name);
      if (v && /算力|积分/.test(v)) { const n = attrConvert(v); if (n !== v) el.setAttribute(name, n); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
    fixAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
  }
  function fixTitle() { if (/算力|积分/.test(document.title)) document.title = attrConvert(document.title); }

  let queue = new Set(), scheduled = false;
  function flush() {
    scheduled = false;
    const items = [...queue]; queue = new Set();
    for (const n of items) if (n.isConnected) walk(n);
    fixTitle();
  }
  function enqueue(n) { queue.add(n); if (!scheduled) { scheduled = true; requestAnimationFrame(flush); } }

  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') enqueue(m.target);
      else if (m.type === 'attributes') enqueue(m.target);
      else m.addedNodes.forEach(enqueue);
    }
  });
  function start() {
    walk(document.body); fixTitle();
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder', 'alt'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.MerchantTP = { convert, mark: MARK };
})();
