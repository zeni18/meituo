#!/usr/bin/env python3
"""把原型打包成单个 HTML。
只读取真实后台 likeadmin-aigc/public 下的图标与示例图（不修改任何项目文件）：
  - 侧栏图标：public/merchant/nav-v2.js 里的 ICON 表
  - 线性图标：public/merchant/icons/*.svg（Feather，MIT）
  - 示例图：public/merchant/design-assets、images、resource/image/common
用法：python3 build.py [输出路径]"""
import base64, io, json, os, re, sys
from PIL import Image

H = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(H, '..', '..', '..'))
PUB = os.path.join(ROOT, 'likeadmin-aigc', 'public')
MER = os.path.join(PUB, 'merchant')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(H, '..', '视频剪辑-高保真交互原型.html')
rd = lambda f: open(os.path.join(H, f), encoding='utf8').read()

# 侧栏图标（与真实后台同一套）
nav = {}
for line in open(os.path.join(MER, 'nav-v2.js'), encoding='utf8'):
    m = re.match(r"\s*(\w+):\s*'(<path.*)',?\s*$", line)
    if m: nav[m.group(1)] = m.group(2)
need_nav = ['workbench','tools','image','video','avatar','clip','materials','works','geo','store','automation','brand','pin','chevron']
miss = [k for k in need_nav if k not in nav]
assert not miss, 'nav icons missing: %s' % miss

# 线性图标 sprite
used = set(re.findall(r"ic\('([a-z0-9-]+)'", ''.join(rd(f) for f in ['a-core.js','b-render.js','c-view.js','d-events.js'])))
EXTRA = {  # 后台 icons 目录里没有的几个，按 Feather 同款路径补齐
 'menu':'<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
 'bell':'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
 'copy':'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
 'type':'<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
 'chevron-up':'<polyline points="18 15 12 9 6 15"/>',
 'minus':'<line x1="5" y1="12" x2="19" y2="12"/>',
 'sidebar':'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>'}
sym, missing = [], []
for n in sorted(used):
    p = os.path.join(MER, 'icons', n + '.svg')
    if os.path.exists(p):
        inner = re.search(r'<svg[^>]*>(.*)</svg>', open(p, encoding='utf8').read(), re.S).group(1).strip()
    elif n in EXTRA: inner = EXTRA[n]
    else: missing.append(n); continue
    sym.append('<symbol id="i-%s" viewBox="0 0 24 24">%s</symbol>' % (n, inner))
assert not missing, 'line icons missing: %s' % missing
sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + ''.join(sym) + '</svg>'

# 示例图，压缩后内联
def img(path, w=None, fmt='WEBP', q=78):
    im = Image.open(path)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if w and im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, fmt, quality=q, method=6)
    return 'data:image/%s;base64,%s' % (fmt.lower(), base64.b64encode(b.getvalue()).decode())
DA = os.path.join(MER, 'design-assets')
IMG = {
 'bright': img(os.path.join(DA, 'hero-template-bright.webp'), 760), 'modern': img(os.path.join(DA, 'hero-template-modern.webp'), 760),
 'night': img(os.path.join(DA, 'hero-template-night.webp'), 760), 'warm': img(os.path.join(DA, 'hero-template-warm.webp'), 760),
 'avatar': img(os.path.join(DA, 'v2', 'tool-avatar.webp')), 'product': img(os.path.join(DA, 'v2', 'tool-product.webp')),
 'wear': img(os.path.join(DA, 'v2', 'tool-wear.webp')), 'clip': img(os.path.join(DA, 'v2', 'tool-clip.webp')),
 'empty': img(os.path.join(MER, 'images', 'clip-empty-materials.png'), 240),
 'user': img(os.path.join(PUB, 'resource', 'image', 'common', 'default_avatar.png'), 96)}

js = '\n'.join(rd(f) for f in ['a-core.js', 'b-render.js', 'c-view.js', 'd-events.js'])
assert '</script' not in js
html = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>视频剪辑 · 高保真交互原型</title><style>' + rd('style.css') + '</style></head><body>' + sprite + rd('body.html') +
        '<script>const IMG=' + json.dumps(IMG) + ';const NAV=' + json.dumps({k: nav[k] for k in need_nav}, ensure_ascii=False) + ';\n' + js + '\n</script></body></html>')
open(OUT, 'w', encoding='utf8').write(html)
print('built', os.path.abspath(OUT), len(html) // 1024, 'KB;', len(sym), 'icons')
