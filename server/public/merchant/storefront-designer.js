/* Reference-aligned store appearance editor, sharing the existing draft service. */
(() => {
  'use strict';
  const componentDesigner = window.MerchantStoreDesigner;
  const el = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  const icon = name => {
    const span = el('span', 'sf-icon');
    span.style.setProperty('--sf-icon', `url("/merchant/icons/${name}.svg")`);
    span.setAttribute('aria-hidden', 'true');
    return span;
  };
  const button = (label, action, cls = '', glyph) => {
    const b = el('button', 'sf-button ' + cls);
    b.type = 'button';
    if (glyph) b.append(icon(glyph));
    if (label) b.append(el('span', '', label));
    if (action) b.addEventListener('click', action);
    return b;
  };
  const templateNames = {modern: '现代', bright: '清新', night: '质感', warm: '暖木'};
  const templateImage = key => `/merchant/design-assets/hero-template-${key}.webp`;
  const colors = ['#ff7600', '#1677ff', '#16a34a', '#e53e5d', '#111827', '#8b5cf6'];
  const platformColors = {douyin: '#111111', kuaishou: '#ff5000', xiaohongshu: '#f32648', channels: '#16a66a', dianping: '#ff6633', meituan: '#ffc300', wechat: '#16a66a', wifi: '#159bd4'};
  const titles = {video_douyin: '抖音视频', video_kuaishou: '快手视频', video_xiaohongshu: '小红书视频', video_channels: '视频号', review_dianping: '大众点评', review_douyin: '抖音点评', review_meituan: '美团点评', review_amap: '高德点评', review_baidu: '百度点评', notes_dianping: '大众点评图文', deals_dianping: '大众点评团购', service_wifi: 'WiFi配置', service_wechat: '加微信', like_channels: '视频号转发', like_douyin: '抖音点赞'};
  const platformNames = {douyin: '抖音', kuaishou: '快手', xiaohongshu: '小红书', channels: '视频号', dianping: '大众点评', amap: '高德', baidu: '百度', meituan: '美团', ctrip: '携程', scenic: '景区', moments: '朋友圈', wechat: '微信', wifi: 'Wi-Fi', drive: '代驾'};
  const featureName = item => titles[item.code] || (item.label.includes(platformNames[item.platform]) ? item.label : platformNames[item.platform] + item.label);
  const featureImage = item => {
    const key = item.platform === 'scenic' ? 'ctrip' : item.platform;
    return `/merchant/design-assets/${key}.${['ctrip', 'drive'].includes(key) ? 'svg' : 'png'}`;
  };
  function mount(host, {api, storeId, onBack}) {
    const root = el('section', 'sf-editor');
    root.setAttribute('aria-label', '门店装修工作台');
    // Portal above the native shell; its sidebar creates a separate stacking context.
    const anchor = el('div', 'sf-designer-anchor');
    host.append(anchor);
    document.body.append(root);
    const app = host.closest('.layout-blank') || document.getElementById('__nuxt');
    const appWasInert = app?.inert || false;
    if (app) app.inert = true;
    document.body.classList.add('sf-editor-open');
    const s = {dead: false, ready: false, config: null, saved: '', revision: 0, saving: false, uploading: false, files: new Map(), items: [], undo: [], redo: [], child: null, dialog: null};
    let appearance, sorting, preview, status, error, saveButton, undoButton, redoButton, counter;
    const front = () => s.config.storefront;
    const dirty = () => s.ready && JSON.stringify(s.config) !== s.saved;
    const image = id => s.files.get(Number(id));
    const beforeUnload = event => {
      if (dirty()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);

    function controls() {
      if (!status) return;
      status.textContent = s.uploading ? '图片上传中…' : s.saving ? '正在保存…' : dirty() ? '有未保存修改' : s.revision ? '已保存' : '默认设置';
      status.dataset.dirty = String(dirty());
      saveButton.disabled = s.saving || s.uploading;
      undoButton.disabled = !s.undo.length || s.saving || s.uploading;
      redoButton.disabled = !s.redo.length || s.saving || s.uploading;
    }
    function update(change, redraw = true) {
      const previous = JSON.stringify(s.config);
      change();
      if (front().primary_feature && !s.config.features[front().primary_feature]) front().primary_feature = '';
      if (previous === JSON.stringify(s.config)) return;
      s.undo.push(previous);
      if (s.undo.length > 50) s.undo.shift();
      s.redo = [];
      if (redraw) renderPanels(); else renderPreview();
      controls();
    }
    function history(from, to) {
      if (!from.length || s.saving || s.uploading) return;
      to.push(JSON.stringify(s.config));
      s.config = JSON.parse(from.pop());
      renderPanels();
      controls();
    }
    function dialog(title, text, action, actionLabel = '放弃修改') {
      if (s.dialog?.open) return;
      const d = el('dialog', 'sf-dialog'), heading = el('h2', '', title);
      heading.id = 'sf-dialog-title';
      d.setAttribute('aria-labelledby', heading.id);
      const footer = el('footer');
      footer.append(button('取消', () => d.close()), button(actionLabel, () => {d.close(); action();}, 'sf-primary'));
      d.append(heading, el('p', '', text), footer);
      d.addEventListener('close', () => {d.remove(); if (s.dialog === d) s.dialog = null;});
      root.append(d);
      s.dialog = d;
      d.showModal();
    }
    function leave(action = onBack) {
      if (s.saving || s.uploading) return;
      if (dirty()) dialog('离开页面装修', '当前修改尚未保存，是否放弃修改并离开？', action);
      else action();
    }
    function switchControl(label, value, change, cls = '') {
      const wrap = el('label', 'sf-switch-row ' + cls), input = el('input');
      input.type = 'checkbox'; input.checked = value; input.setAttribute('role', 'switch');
      input.addEventListener('change', () => update(() => change(input.checked)));
      wrap.append(el('span', '', label), input, el('span', 'sf-switch'));
      return wrap;
    }
    function segment(label, options, value, change) {
      const field = el('div', 'sf-field'), group = el('div', 'sf-segments');
      group.setAttribute('role', 'group'); group.setAttribute('aria-label', label);
      field.append(el('span', 'sf-label', label));
      for (const [key, title] of options) {
        const b = button(title, () => update(() => change(key)));
        b.setAttribute('aria-pressed', String(value === key));
        group.append(b);
      }
      field.append(group);
      return field;
    }
    function panel(title, className = '') {
      const box = el('section', 'sf-card ' + className);
      box.append(el('h2', '', title));
      return box;
    }
    function renderAppearance() {
      appearance.replaceChildren();
      const f = front(), card = panel('门店与外观');
      const enabled = el('div', 'sf-enabled');
      enabled.append(switchControl('使用新版布局', f.enabled, value => {front().enabled = value;}), el('p', 'sf-hint', '保存门店装修设置；二维码与 NFC 入口待接入。'));
      card.append(enabled);
      const palette = el('div', 'sf-field'), swatches = el('div', 'sf-swatches');
      palette.append(el('span', 'sf-label', '主题颜色'));
      for (const color of colors) {
        const b = button('', () => update(() => {s.config.page.accent = color;}), 'sf-swatch');
        const selected = s.config.page.accent.toLowerCase() === color;
        b.style.setProperty('--swatch', color);
        b.setAttribute('aria-label', '选择颜色 ' + color);
        b.setAttribute('aria-pressed', String(selected));
        if (selected) b.append(icon('check'));
        swatches.append(b);
      }
      const custom = el('input', 'sf-custom-color');
      custom.type = 'color'; custom.value = /^#[0-9a-f]{6}$/i.test(s.config.page.accent) ? s.config.page.accent : '#ff7600';
      custom.setAttribute('aria-label', '自定义主题色');
      custom.addEventListener('change', () => update(() => {s.config.page.accent = custom.value;}));
      swatches.append(custom); palette.append(swatches); card.append(palette);

      const uploadField = el('div', 'sf-field'), uploadInput = el('input'), uploadButton = button(s.uploading ? '正在上传…' : '上传图片', () => uploadInput.click(), 'sf-upload', 'image');
      uploadInput.type = 'file'; uploadInput.accept = '.jpg,.jpeg,.png,.webp,.gif'; uploadInput.hidden = true;
      uploadInput.setAttribute('aria-label', '上传门店头图'); uploadButton.disabled = s.uploading;
      uploadInput.addEventListener('change', () => upload(uploadInput.files[0]));
      uploadField.append(el('span', 'sf-label', '门店头图'), uploadButton, uploadInput);
      if (image(s.config.header.background_file_id)) {
        const uploaded = el('div', 'sf-uploaded'), img = el('img');
        img.src = image(s.config.header.background_file_id).url; img.alt = '当前门店头图';
        uploaded.append(img, button('移除图片', () => update(() => {s.config.header.background_file_id = 0;}), 'sf-text'));
        uploadField.append(uploaded);
      }
      card.append(uploadField);
      const templates = el('div', 'sf-field'), choices = el('div', 'sf-templates');
      templates.append(el('span', 'sf-label', '头图模板'));
      for (const [key, name] of Object.entries(templateNames)) {
        const b = button('', () => update(() => {front().hero_template = key; s.config.header.background_file_id = 0;}), 'sf-template'), img = el('img');
        img.src = templateImage(key); img.alt = '';
        b.setAttribute('aria-label', name + '头图模板');
        b.setAttribute('aria-pressed', String(f.hero_template === key && !s.config.header.background_file_id));
        b.append(img, el('span', '', name)); choices.append(b);
      }
      templates.append(choices); card.append(templates);
      const tagline = el('label', 'sf-field'), input = el('input', 'sf-input');
      input.value = f.tagline; input.maxLength = 80; input.placeholder = '欢迎光临，感谢您的到来';
      input.addEventListener('input', () => update(() => {front().tagline = input.value;}, false));
      tagline.append(el('span', 'sf-label', '门店标语'), input);
      card.append(tagline, segment('头图高度', [['large', '大图'], ['compact', '紧凑']], f.hero_size, value => {front().hero_size = value;}));
      card.append(switchControl('显示收藏', f.show_favorite, value => {front().show_favorite = value;}));
      card.append(switchControl('显示团购区域', f.show_deals, value => {front().show_deals = value;}));
      const primary = panel('主按钮'), selectField = el('label', 'sf-field'), select = el('select', 'sf-input');
      select.add(new Option('不设置主按钮', ''));
      for (const code of f.order) {
        const item = s.items.find(i => i.code === code);
        if (item && s.config.features[code]) select.add(new Option(featureName(item), code));
      }
      select.value = f.primary_feature;
      select.addEventListener('change', () => update(() => {front().primary_feature = select.value;}));
      selectField.append(el('span', 'sf-label', '主推功能'), select);
      primary.append(selectField, segment('按钮样式', [['platform', '平台色'], ['black', '黑色']], f.primary_style, value => {front().primary_style = value;}));
      appearance.append(card, primary, button('组件装修', openComponents, 'sf-mobile-components'));
    }
    function move(code, offset) {
      const order = front().order, index = order.indexOf(code), target = index + offset;
      if (index < 0 || target < 0 || target >= order.length) return;
      update(() => { [order[index], order[target]] = [order[target], order[index]]; });
      sorting.querySelector(`[data-feature="${code}"] [data-action="${offset < 0 ? 'up' : 'down'}"]`)?.focus();
    }
    function renderSorting() {
      sorting.replaceChildren();
      const head = el('header', 'sf-sorting-heading'), copy = el('div');
      copy.append(el('h2', '', '功能排序'), el('p', 'sf-hint', '可调整顺序、隐藏或设置通栏'));
      const visible = Object.values(s.config.features).filter(Boolean).length;
      counter = el('span', 'sf-count', `${visible} / ${s.items.length} 项显示`);
      head.append(copy, counter);
      const list = el('ol', 'sf-feature-list');
      for (const [index, code] of front().order.entries()) {
        const item = s.items.find(i => i.code === code);
        if (!item) continue;
        const name = featureName(item), shown = s.config.features[code], wide = front().full_width.includes(code);
        const row = el('li', 'sf-feature' + (shown ? '' : ' is-hidden'));
        row.dataset.feature = code; row.setAttribute('aria-label', name);
        const img = el('img', 'sf-feature-icon'); img.src = featureImage(item); img.alt = '';
        const label = el('div', 'sf-feature-label'); label.append(el('strong', '', name));
        if (!shown) label.append(el('span', 'sf-tag', '已隐藏'));
        if (wide) label.append(el('span', 'sf-tag', '通栏'));
        if (front().primary_feature === code) label.append(el('span', 'sf-tag is-primary', '主推'));
        const actions = el('div', 'sf-feature-actions');
        const action = (title, glyph, fn, key) => {
          const b = button('', fn, 'sf-icon-button', glyph);
          b.setAttribute('aria-label', title + ' ' + name); b.title = title; b.dataset.action = key;
          actions.append(b); return b;
        };
        const width = action(wide ? '切换双列' : '切换通栏', wide ? 'square' : 'grid', () => update(() => {
          front().full_width = wide ? front().full_width.filter(c => c !== code) : [...front().full_width, code];
        }), 'width');
        width.setAttribute('aria-pressed', String(wide));
        action('上移', 'arrow-up', () => move(code, -1), 'up').disabled = index === 0;
        action('下移', 'arrow-down', () => move(code, 1), 'down').disabled = index === front().order.length - 1;
        const toggle = action(shown ? '隐藏' : '显示', shown ? 'eye' : 'eye-off', () => update(() => {s.config.features[code] = !shown;}), 'visible');
        toggle.setAttribute('aria-pressed', String(shown));
        row.append(img, label, actions); list.append(row);
      }
      sorting.append(head, list);
    }
    function previewAction(item) {
      dialog('功能预览', `${featureName(item)}：这里展示门店入口的装修效果。实际功能需接入对应服务。`, () => {}, '知道了');
    }
    function renderPreview() {
      const previousScroll = preview.querySelector('.sf-phone-scroll')?.scrollTop || 0;
      preview.replaceChildren();
      const label = el('div', 'sf-preview-heading');
      label.append(icon('smartphone'), el('span', '', '实时预览'));
      const phone = el('div', 'sf-phone'), screen = el('div', 'sf-phone-scroll');
      screen.setAttribute('aria-label', '门店手机预览'); screen.setAttribute('role', 'region');
      const f = front(), accent = /^#[0-9a-f]{6}$/i.test(s.config.page.accent) ? s.config.page.accent : '#ff7600';
      phone.style.setProperty('--sf-accent', accent);
      if (!f.enabled) {
        const off = el('div', 'sf-preview-disabled');
        off.append(icon('layout'), el('strong', '', '新版布局已关闭'), el('p', '', '开启后继续预览，当前配置会保留。'));
        screen.append(off);
      } else {
        const hero = el('div', 'sf-hero'), cover = el('img');
        hero.dataset.size = f.hero_size;
        cover.src = image(s.config.header.background_file_id)?.url || templateImage(f.hero_template);
        cover.alt = '门店头图'; hero.append(cover);
        const identity = el('div', 'sf-store-identity'), avatar = el('div', 'sf-avatar');
        if (image(s.store.logo_file_id)) {
          const logo = el('img'); logo.src = image(s.store.logo_file_id).url; logo.alt = ''; avatar.append(logo);
        } else avatar.textContent = Array.from(s.store.name)[0] || '店';
        const title = el('div', 'sf-store-title');
        title.append(el('h3', '', s.store.name), el('p', '', f.tagline));
        identity.append(avatar, title);
        if (f.show_favorite) {
          const favorite = el('div', 'sf-favorite');
          favorite.append(icon('star'), el('span', '', '收藏')); identity.append(favorite);
        }
        const content = el('div', 'sf-phone-content');
        const features = f.order.map(code => s.items.find(i => i.code === code)).filter(item => item && s.config.features[item.code]);
        const primary = features.find(item => item.code === f.primary_feature);
        if (primary) {
          const main = button(featureName(primary), () => previewAction(primary), 'sf-primary-feature'), img = el('img');
          const background = f.primary_style === 'black' ? '#111111' : platformColors[primary.platform] || accent;
          main.style.background = background; main.style.color = background === '#ffc300' ? '#191919' : '#ffffff';
          img.src = featureImage(primary); img.alt = '';
          main.prepend(img); main.append(icon('chevron-right')); content.append(main);
        }
        const grid = el('div', 'sf-preview-grid');
        for (const item of features.filter(i => i.code !== primary?.code && !i.code.startsWith('deals_'))) {
          const tile = button(featureName(item), () => previewAction(item), 'sf-preview-tile'), img = el('img');
          tile.dataset.feature = item.code;
          if (f.full_width.includes(item.code)) tile.classList.add('is-wide');
          img.src = featureImage(item); img.alt = '';
          tile.prepend(img); tile.append(icon('chevron-right')); grid.append(tile);
        }
        if (!features.length) grid.append(el('p', 'sf-empty', '暂未显示功能，可在功能排序中开启。'));
        content.append(grid);
        const deals = features.filter(item => item.code.startsWith('deals_'));
        if (f.show_deals && deals.length) {
          const area = el('section', 'sf-deals'), links = el('div', 'sf-deals-grid');
          area.append(el('h4', '', '门店团购'));
          for (const item of deals) {
            const link = button(featureName(item), () => previewAction(item), 'sf-deal-link', 'chevron-right');
            if (f.full_width.includes(item.code)) link.classList.add('is-wide');
            links.append(link);
          }
          area.append(links);
          content.append(area);
        }
        screen.append(hero, identity, content);
      }
      phone.append(screen);
      preview.append(label, phone, el('p', 'sf-preview-note', '手机预览 · 页面展示效果'));
      screen.scrollTop = previousScroll;
    }
    function renderPanels() {
      if (s.dead || !s.ready) return;
      const leftScroll = appearance.scrollTop, listScroll = sorting.scrollTop;
      renderAppearance(); renderSorting(); renderPreview();
      appearance.scrollTop = leftScroll; sorting.scrollTop = listScroll;
    }
    async function upload(file) {
      if (!file || s.uploading) return;
      if (file.size > 5 * 1024 * 1024) {error.textContent = '头图不能超过 5MB'; return;}
      if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)) {error.textContent = '请选择 JPG、PNG、GIF 或 WebP 图片'; return;}
      s.uploading = true; error.textContent = ''; controls(); renderAppearance();
      try {
        const form = new FormData(); form.append('file', file); form.append('kind', 'image'); form.append('attach_only', '1');
        const tenant = new URLSearchParams(location.search).get('tenant_id');
        const response = await fetch('/api/merchantWorkspace/storeLogo' + (tenant ? '?tenant_id=' + encodeURIComponent(tenant) : ''), {method: 'POST', credentials: 'same-origin', body: form});
        const result = await response.json();
        if (result.code !== 1) throw Error(result.msg || '图片上传失败');
        if (s.dead) return;
        s.files.set(Number(result.data.file.id), result.data.file);
        update(() => {s.config.header.background_file_id = Number(result.data.file.id);});
      } catch (e) {if (!s.dead) error.textContent = e.message;}
      finally {s.uploading = false; if (!s.dead) {controls(); renderAppearance();}}
    }
    async function save() {
      if (s.saving || s.uploading) return;
      const snapshot = JSON.stringify(s.config);
      s.saving = true; error.textContent = ''; controls();
      try {
        const result = await api('storeDesignSave', {}, {store_id: storeId, revision: s.revision, config: JSON.parse(snapshot)});
        if (s.dead) return;
        s.revision = result.revision; s.saved = snapshot;
      } catch (e) {if (!s.dead) error.textContent = e.message;}
      finally {s.saving = false; if (!s.dead) controls();}
    }
    function openComponents() {
      if (!componentDesigner) return;
      leave(() => {
        s.ready = false;
        if (app) app.inert = appWasInert;
        document.body.classList.remove('sf-editor-open');
        root.classList.add('sf-show-components');
        anchor.append(root);
        root.replaceChildren();
        s.child = componentDesigner.mount(root, {api, storeId, onBack: () => {
          s.child?.destroy?.(); s.child = null;
          root.classList.remove('sf-show-components');
          document.body.append(root);
          if (app) app.inert = true;
          document.body.classList.add('sf-editor-open');
          load();
        }});
      });
    }
    function build() {
      root.replaceChildren();
      const head = el('header', 'sf-header'), identity = el('div', 'sf-editor-title');
      const back = button('', () => leave(), 'sf-icon-button', 'arrow-left');
      back.setAttribute('aria-label', '返回门店详情');
      identity.append(el('h1', '', '页面装修'), el('span', '', s.store.name));
      const actions = el('div', 'sf-header-actions');
      status = el('span', 'sf-save-status'); status.setAttribute('role', 'status');
      undoButton = button('', () => history(s.undo, s.redo), 'sf-icon-button', 'rotate-ccw'); undoButton.setAttribute('aria-label', '撤销');
      redoButton = button('', () => history(s.redo, s.undo), 'sf-icon-button', 'rotate-cw'); redoButton.setAttribute('aria-label', '重做');
      const more = button('组件装修', openComponents, 'sf-text');
      const close = button('', () => leave(), 'sf-icon-button', 'x'); close.setAttribute('aria-label', '关闭装修');
      saveButton = button('保存', save, 'sf-primary', 'check');
      actions.append(status, undoButton, redoButton, more, close, saveButton);
      head.append(back, identity, actions);
      error = el('p', 'sf-error'); error.setAttribute('role', 'alert');
      const layout = el('div', 'sf-layout');
      appearance = el('aside', 'sf-appearance'); appearance.setAttribute('aria-label', '门店与外观设置');
      sorting = el('section', 'sf-card sf-sorting'); sorting.setAttribute('aria-label', '功能排序');
      preview = el('aside', 'sf-preview'); preview.setAttribute('aria-label', '实时预览');
      layout.append(appearance, sorting, preview);
      root.append(head, error, layout);
      renderPanels(); controls();
    }
    async function load() {
      s.ready = false;
      root.replaceChildren(el('p', 'sf-loading', '正在读取门店装修…'));
      try {
        const data = await api('storeDesign', {store_id: storeId});
        if (s.dead) return;
        Object.assign(s, {store: data.store, config: data.config, revision: data.revision, items: data.catalog.flatMap(g => g.items), ready: true, undo: [], redo: []});
        s.files.clear(); for (const f of data.files) s.files.set(Number(f.id), f);
        s.saved = JSON.stringify(s.config);
        build();
      } catch (e) {
        if (!s.dead) root.replaceChildren(el('p', 'sf-loading', e.message), button('重试', load), button('返回门店详情', onBack));
      }
    }
    root.destroy = () => {
      s.dead = true; s.ready = false; s.child?.destroy?.(); s.dialog?.close();
      window.removeEventListener('beforeunload', beforeUnload);
      document.body.classList.remove('sf-editor-open');
      if (app) app.inert = appWasInert;
      root.remove(); anchor.remove();
    };
    load();
    return root;
  }
  window.MerchantStoreDesigner = {mount};
})();
