/* Shared selects for added merchant/OEM pages. Keep the real form control and its events. */
(() => {
  'use strict';
  if (window.AddedPageSelects || !('showPopover' in HTMLElement.prototype)) return;
  const scope = '.ml-library,.mc-studio,.mw-workspace,.oem-directory,.hp-page';
  const controls = new Map();
  let active = null, serial = 0, frame = 0;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function title(select) {
    const labelled = (select.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    return select.getAttribute('aria-label') || labelled || select.closest('label')?.querySelector(':scope > span:not(.ds-select)')?.textContent?.trim() || select.name || '请选择';
  }
  function enhance(select) {
    if (controls.has(select) || select.multiple || select.size > 1 || !select.closest(scope)) return;
    const wrap = node('span', 'ds-select' + (select.closest('.oem-directory') ? ' ds-select-admin' : ''));
    const trigger = node('button', 'ds-select-trigger'), value = node('span', 'ds-select-value'), arrow = node('span', 'ds-select-arrow');
    const panel = node('div', 'ds-select-panel'), search = node('input', 'ds-select-search'), list = node('div', 'ds-select-list');
    const id = 'ds-select-' + (++serial), originalTab = select.getAttribute('tabindex'), originalAria = select.getAttribute('aria-hidden');
    const owner = {select, wrap, trigger, panel, list, search, open: false, index: -1, query: '', items: [], options: []};
    controls.set(select, owner);
    select.before(wrap); wrap.append(select, trigger, panel);
    select.classList.add('ds-select-source'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    trigger.type = 'button'; trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', id); trigger.setAttribute('aria-expanded', 'false');
    arrow.setAttribute('aria-hidden', 'true'); trigger.append(value, arrow);
    panel.setAttribute('popover', 'manual'); panel.append(search, list);
    list.id = id; list.setAttribute('role', 'listbox');
    search.type = 'search'; search.autocomplete = 'off'; search.placeholder = '搜索选项';
    function sync() {
      const label = title(select), text = select.selectedOptions[0]?.textContent || '请选择';
      if (value.textContent !== text) value.textContent = text;
      trigger.setAttribute('aria-label', label); list.setAttribute('aria-label', label);
      search.setAttribute('aria-label', '搜索' + label);
      trigger.disabled = select.matches(':disabled'); trigger.setAttribute('aria-required', String(select.required));
      wrap.hidden = select.hidden;
      if (select.validity.valid) trigger.removeAttribute('aria-invalid');
      if (owner.open) {
        if (trigger.disabled || !select.isConnected || select.closest('dialog:not([open]),[hidden]')) close();
        else { build(); position(); }
      }
    }
    function options() { return Array.from(select.options); }
    function build() {
      owner.options = options(); owner.items = []; list.replaceChildren();
      search.hidden = owner.options.filter(o => !o.hidden).length <= 10;
      const needle = owner.query.toLocaleLowerCase(); let lastGroup = null;
      owner.options.forEach((option, index) => {
        if (option.hidden || !option.textContent.toLocaleLowerCase().includes(needle)) return;
        const group = option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement : null;
        if (group && group !== lastGroup) list.append(node('div', 'ds-select-group', group.label));
        lastGroup = group;
        const item = node('div', 'ds-select-option'), text = node('span', 'ds-select-option-text', option.textContent), tick = node('span', 'ds-select-check');
        const disabled = option.disabled || Boolean(group?.disabled);
        item.id = id + '-option-' + index; item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(index === select.selectedIndex)); item.setAttribute('aria-disabled', String(disabled));
        tick.setAttribute('aria-hidden', 'true'); item.append(text, tick); list.append(item);
        owner.items.push({el: item, index, disabled});
        item.addEventListener('pointermove', () => { if (!disabled) focusOption(index, false); });
        item.addEventListener('pointerdown', e => e.preventDefault());
        item.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (!disabled) choose(index); });
      });
      if (!owner.items.length) list.append(node('div', 'ds-select-empty', '暂无匹配选项'));
      const valid = owner.items.filter(x => !x.disabled);
      if (!valid.some(x => x.index === owner.index)) owner.index = valid.find(x => x.index === select.selectedIndex)?.index ?? valid[0]?.index ?? -1;
      focusOption(owner.index, false);
    }
    function focusOption(index, scroll = true) {
      owner.index = index;
      owner.items.forEach(x => x.el.classList.toggle('is-active', x.index === index));
      const item = owner.items.find(x => x.index === index);
      for (const control of [trigger, search]) {
        if (item) control.setAttribute('aria-activedescendant', item.el.id);
        else control.removeAttribute('aria-activedescendant');
      }
      if (scroll && item) item.el.scrollIntoView({block: 'nearest'});
    }
    function position() {
      if (!owner.open) return;
      const rect = trigger.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight || !rect.width) return close();
      panel.style.width = Math.min(Math.max(rect.width, 184), innerWidth - 24) + 'px';
      const below = innerHeight - rect.bottom - 16, above = rect.top - 16;
      const up = below < 180 && above > below, room = Math.max(80, up ? above : below);
      panel.style.maxHeight = Math.min(336, room) + 'px';
      const height = panel.getBoundingClientRect().height;
      panel.style.left = Math.max(12, Math.min(rect.left, innerWidth - panel.getBoundingClientRect().width - 12)) + 'px';
      panel.style.top = Math.max(8, up ? rect.top - height - 8 : rect.bottom + 8) + 'px';
    }
    function open() {
      sync(); if (trigger.disabled || wrap.hidden) return;
      active?.close(); owner.query = ''; search.value = ''; owner.index = select.selectedIndex;
      build(); owner.open = true; active = owner;
      trigger.setAttribute('aria-expanded', 'true'); panel.showPopover(); position();
      focusOption(owner.index);
    }
    function close(focus = false) {
      if (!owner.open) return;
      owner.open = false; if (panel.matches(':popover-open')) panel.hidePopover();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant'); search.removeAttribute('aria-activedescendant');
      if (active === owner) active = null;
      if (focus && trigger.isConnected) trigger.focus({preventScroll: true});
    }
    function choose(index) {
      const option = owner.options[index]; if (!option || option.disabled || option.parentElement?.disabled) return;
      const changed = select.selectedIndex !== index;
      select.selectedIndex = index; close(true); sync();
      if (changed) {
        select.dispatchEvent(new Event('input', {bubbles: true}));
        select.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
    let typed = '', typedAt = 0;
    function keydown(e) {
      const isSearch = e.target === search;
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && (!isSearch || e.key.startsWith('Arrow'))) {
        e.preventDefault(); e.stopPropagation();
        if (!owner.open) { open(); return; }
        const enabled = owner.items.filter(x => !x.disabled), current = enabled.findIndex(x => x.index === owner.index);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1 : (current + (e.key === 'ArrowUp' ? -1 : 1) + enabled.length) % enabled.length;
        if (enabled[next]) focusOption(enabled[next].index);
      } else if (e.key === 'Enter' || (e.key === ' ' && !isSearch)) {
        e.preventDefault(); e.stopPropagation(); if (owner.open) choose(owner.index); else open();
      } else if (!isSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); if (!owner.open) open();
        const now = Date.now(); typed = now - typedAt > 700 ? e.key : typed + e.key; typedAt = now;
        const match = owner.items.find(x => !x.disabled && owner.options[x.index].textContent.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()));
        if (match) focusOption(match.index);
      }
    }
    trigger.addEventListener('click', e => { e.preventDefault(); owner.open ? close() : open(); });
    trigger.addEventListener('keydown', keydown); search.addEventListener('keydown', keydown);
    search.addEventListener('input', () => { owner.query = search.value; build(); position(); });
    select.addEventListener('change', sync); select.addEventListener('input', sync);
    select.addEventListener('invalid', e => { e.preventDefault(); trigger.setAttribute('aria-invalid', 'true'); trigger.focus(); });
    select.addEventListener('focus', () => trigger.focus());
    const observer = new MutationObserver(sync);
    observer.observe(select, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'required', 'label', 'selected', 'value', 'aria-label', 'aria-labelledby']});
    owner.sync = sync; owner.close = close; owner.position = position;
    owner.destroy = () => {
      close(); observer.disconnect(); controls.delete(select);
      select.classList.remove('ds-select-source');
      if (originalTab === null) select.removeAttribute('tabindex'); else select.setAttribute('tabindex', originalTab);
      if (originalAria === null) select.removeAttribute('aria-hidden'); else select.setAttribute('aria-hidden', originalAria);
      if (wrap.isConnected) { wrap.before(select); wrap.remove(); }
    };
    sync();
  }
  function scan(target = document) {
    if (target.nodeType !== Node.ELEMENT_NODE && target !== document) return;
    if (target.matches?.('select')) enhance(target);
    target.querySelectorAll('select').forEach(select => {
      if (controls.has(select)) controls.get(select).sync(); else enhance(select);
    });
  }
  function prune() {
    for (const [select, owner] of controls) if (!select.isConnected || !select.closest(scope)) owner.destroy();
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') { if (!record.target.closest('.ds-select')) scan(record.target); continue; }
      for (const added of record.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE || added.closest('.ds-select')) continue;
        scan(added);
      }
    }
    prune();
  });
  observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden']});
  document.addEventListener('pointerdown', e => { if (active && !active.wrap.contains(e.target)) active.close(); }, true);
  document.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); active.close(true); }
    else if (e.key === 'Tab') active.close();
  }, true);
  document.addEventListener('reset', () => setTimeout(() => controls.forEach(owner => owner.sync()), 0), true);
  document.addEventListener('close', e => { if (active && e.target.contains(active.wrap)) active.close(); }, true);
  const reposition = e => {
    if (!active || (e.type === 'scroll' && active.panel.contains(e.target))) return;
    cancelAnimationFrame(frame); frame = requestAnimationFrame(() => active?.position());
  };
  document.addEventListener('scroll', reposition, true); window.addEventListener('resize', reposition);
  window.AddedPageSelects = {refresh: scan}; scan();
})();
