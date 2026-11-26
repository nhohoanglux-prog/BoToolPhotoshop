#!/usr/bin/env python3
"""Tạo lại capnhat.json (từ đầu file các tool + CHANGELOG.md) và đóng gói BoToolPhotoshop.zip.
Chạy ở thư mục gốc kho:  python3 dong_goi.py [đường_dẫn_zip]
Ghi chú cập nhật lấy từ CHANGELOG.md, mỗi dòng dạng:
  - <TênFile.jsx> v<phiên bản>: <thay đổi>
  - Panel Tool Launcher v<phiên bản>: <thay đổi>"""
import json, os, re, sys, zipfile
ROOT = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(ROOT, '1_CaiPanel', 'com.phuc.toollauncher')
TOOLDIR = os.path.join(ROOT, '2_ThuMucTool')

def header(path):
    t = open(path, encoding='utf-8-sig').read(4000)
    g = lambda k: (re.search(r'@' + k + r'\s*:\s*([^\r\n*]+)', t) or [None, ''])[1].strip()
    return {k: g(k) for k in ('name', 'group', 'desc', 'version', 'date')}

# Đọc CHANGELOG: [(ngày, dòng)]
news, date = [], ''
for line in open(os.path.join(ROOT, 'CHANGELOG.md'), encoding='utf-8'):
    m = re.match(r'##\s*(\d{4}-\d{2}-\d{2})', line)
    if m: date = m.group(1); continue
    if line.startswith('- ') and date: news.append((date, line[2:].strip()))

def note_for(prefix, version):
    for d, txt in news:
        m = re.match(re.escape(prefix) + r'\s+v' + re.escape(version) + r'\s*:\s*(.+)', txt)
        if m: n = m.group(1); return n[:1].upper() + n[1:]
    return ''

main = open(os.path.join(EXT, 'js', 'main.js'), encoding='utf-8').read()
pv = re.search(r"PANEL_VERSION = '([^']+)'", main).group(1)
pd = re.search(r"PANEL_DATE = '([^']+)'", main).group(1)
files = sorted(os.path.relpath(os.path.join(dp, f), EXT).replace(os.sep, '/') for dp, _, fs in os.walk(EXT) for f in fs)
info = {'panel': {'version': pv, 'date': pd, 'notes': note_for('Panel Tool Launcher', pv), 'files': files}, 'tools': [],
        'news': [{'date': d, 'text': t} for d, t in news[:10]]}
for f in sorted(os.listdir(TOOLDIR)):
    if not f.lower().endswith('.jsx') or f.startswith('_'): continue
    h = header(os.path.join(TOOLDIR, f))
    assert h['version'] and h['date'], 'Thiếu @version/@date trong ' + f
    info['tools'].append({'path': f, 'name': h['name'], 'version': h['version'], 'date': h['date'], 'notes': note_for(f, h['version'])})
json.dump(info, open(os.path.join(ROOT, 'capnhat.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# Plugin SketchUp: đóng gói 3_SketchUp/MaNguon thành MatBangXien.rbz (zip đổi đuôi)
SU = os.path.join(ROOT, '3_SketchUp')
SRC = os.path.join(SU, 'MaNguon')
rbz = os.path.join(SU, 'MatBangXien.rbz')
with zipfile.ZipFile(rbz, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dp, _, fs in os.walk(SRC):
        for f in sorted(fs):
            fp = os.path.join(dp, f)
            zf.write(fp, os.path.relpath(fp, SRC).replace(os.sep, '/'))
# capnhat_sketchup.json: nút "⬇ Cập nhật" trong plugin đọc file này (version so với VERSION trong plugin)
loader = open(os.path.join(SRC, 'phuc_mat_bang_xien.rb'), encoding='utf-8').read()
sv = re.search(r"VERSION = '([^']+)'", loader).group(1)
sd = re.search(r"DATE = '([^']+)'", loader).group(1)
sfiles = sorted(os.path.relpath(os.path.join(dp, f), SRC).replace(os.sep, '/') for dp, _, fs in os.walk(SRC) for f in fs)
json.dump({'version': sv, 'date': sd, 'notes': note_for('SketchUp Mặt bằng xiên', sv), 'files': sfiles},
          open(os.path.join(SU, 'capnhat_sketchup.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
outdir = os.path.dirname(sys.argv[1]) if len(sys.argv) > 1 else '/mnt/project-files'
with zipfile.ZipFile(os.path.join(outdir, 'MatBangXien_SketchUp.zip'), 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.write(rbz, 'MatBangXien_SketchUp/MatBangXien.rbz')
    zf.write(os.path.join(SU, 'HuongDan_SketchUp.txt'), 'MatBangXien_SketchUp/HuongDan_SketchUp.txt')

out = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/BoToolPhotoshop.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for item in ['capnhat.json', 'HuongDan.txt', '1_CaiPanel', '2_ThuMucTool', '3_SketchUp']:
        p = os.path.join(ROOT, item)
        paths = [p] if os.path.isfile(p) else [os.path.join(dp, f) for dp, _, fs in os.walk(p) for f in fs]
        for fp in paths:
            zf.write(fp, os.path.join('BoToolPhotoshop', os.path.relpath(fp, ROOT)))
print('OK', out, 'sketchup', sv, 'panel', pv, [(t['path'], t['version'], bool(t['notes'])) for t in info['tools']])
