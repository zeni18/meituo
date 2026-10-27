/* Merchant terminology and free-plan labels for the original client. */
(() => {
  const labels = new Map([
    ['我的个人资料', '商家资料'], ['个人资料', '商家资料'], ['设置 / 个人资料', '设置 / 商家资料'],
    ['您的个人资料', '商家资料'], ['个人账户', '商家账户'],
    ['个人中心', '商家中心'], ['用户中心', '商家中心'],
    ['昵称', '商家名称'], ['显示名称', '商家名称'],
    ['请输入昵称', '请输入商家名称'], ['用户头像', '商家头像'],
    ['请在此处填写与您相关的个人信息。', '请在此处维护商家名称和账号资料。']
  ]);
  const controls = 'button,a,label,strong,h1,h2,h3,[role="heading"],[role="tab"],input';
  function update(root) {
    if (!(root instanceof Element)) return;
    root = root.closest(controls) || root;
    const nodes = root.matches(controls) ? [root, ...root.querySelectorAll(controls)] : [...root.querySelectorAll(controls)];
    for (const node of nodes) {
      if(node.matches('.account-menu__membership'))node.toggleAttribute('data-merchant-free-plan',['免费会员','免费计划'].includes(node.textContent.trim()));
      for (const attr of ['aria-label', 'title', 'placeholder']) {
        const value = node.getAttribute(attr);
        if (labels.has(value)) node.setAttribute(attr, labels.get(value));
      }
      // Only translate exact UI labels; never rewrite names, prompts or content.
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        if (text.parentElement.closest('script,style,textarea,[contenteditable="true"]')) continue;
        const value = text.nodeValue.trim();
        if (labels.has(value)) text.nodeValue = text.nodeValue.replace(value, labels.get(value));
      }
    }
  }
  const observer = new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'characterData') roots.add(record.target.parentElement);
      else if (record.type === 'attributes') roots.add(record.target);
      else for (const node of record.addedNodes) roots.add(node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
    }
    for (const root of roots) update(root);
  });
  update(document.body);
  observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-label','title','placeholder']});
})();
