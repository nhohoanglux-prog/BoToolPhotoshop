#target photoshop
/*
  @name: Số trang tự động
  @group: Artboard
  @desc: Gắn số trang cho mọi artboard kiểu Canva (01, Trang 01, 01 / 43), đối xứng như sách; sửa 1 số rồi bấm Cập nhật tất cả.
  @version: 1.0.0
  @date: 2026-11-25

  SoTrangTuDong.jsx – Số trang tự động cho các artboard
  - Thứ tự trang giống DanhSoArtboard.jsx: hàng từ trên xuống, trong hàng từ trái sang.
  - Mỗi artboard có 1 layer chữ tên "[Số trang] 02" nằm trên cùng artboard đó.
  - Kiểu chung (mẫu chữ, vị trí, lề, font, cỡ, màu, trang bỏ qua) được LƯU TRONG FILE
    (XMP của tài liệu), nên mở tool lần sau là thấy đúng kiểu đang dùng, sửa 1 chỗ rồi bấm
    "Xong" là mọi số trang cập nhật theo (kể cả khi đã thêm / bớt / dời artboard).
  - Sửa trực tiếp 1 số trang (đổi font / cỡ / màu / thêm hiệu ứng) rồi chạy tool: tool tự
    lấy kiểu từ số trang đang chọn và áp cho tất cả.
  - Layer số trang cũ được cập nhật tại chỗ (giữ hiệu ứng), trang bỏ qua thì xoá số.
  - Mọi thay đổi gom 1 bước History.
*/

var TOOL_VERSION = '1.0.0';
var TAG = '[Số trang]';
var c = function (x) { return charIDToTypeID(x); };
var s = function (x) { return stringIDToTypeID(x); };

var STYLES = [
    { name: '01', tpl: '{so}' },
    { name: 'Trang 01', tpl: 'Trang {so}' },
    { name: '01 / 43', tpl: '{so} / {tong}' },
    { name: 'Tùy chỉnh…', tpl: null }
];
var POS = ['Trên trái', 'Trên giữa', 'Trên phải', 'Giữa trái', 'Chính giữa', 'Giữa phải', 'Dưới trái', 'Dưới giữa', 'Dưới phải'];

// ---------------------------------------------------------------------------
// Artboard: lấy danh sách + sắp theo thứ tự trang
// ---------------------------------------------------------------------------
function getArtboards() {
    var ref = new ActionReference();
    ref.putProperty(c('Prpr'), c('NmbL'));
    ref.putEnumerated(c('Dcmn'), c('Ordn'), c('Trgt'));
    var count = executeActionGet(ref).getInteger(c('NmbL'));
    var start = 1;
    try { app.activeDocument.backgroundLayer; start = 0; } catch (e) { start = 1; }
    var list = [];
    for (var i = start; i <= count; i++) {
        var r = new ActionReference();
        r.putIndex(c('Lyr '), i);
        var d;
        try { d = executeActionGet(r); } catch (e) { continue; }
        if (!d.hasKey(s('artboardEnabled')) || !d.getBoolean(s('artboardEnabled'))) continue;
        var rect = d.getObjectValue(s('artboard')).getObjectValue(s('artboardRect'));
        var top = rect.getDouble(s('top')), left = rect.getDouble(s('left'));
        var bottom = rect.getDouble(s('bottom')), right = rect.getDouble(s('right'));
        list.push({ id: d.getInteger(s('layerID')), name: d.getString(c('Nm  ')), top: top, left: left, h: bottom - top, w: right - left });
    }
    return list;
}

function sortByPosition(list) {
    if (!list.length) return [];
    var minH = list[0].h;
    for (var i = 1; i < list.length; i++) if (list[i].h < minH) minH = list[i].h;
    var tol = Math.max(1, minH * 0.3);
    var byTop = list.slice().sort(function (a, b) { return a.top - b.top; });
    var rows = [], cur = [byTop[0]], rowTop = byTop[0].top;
    for (var j = 1; j < byTop.length; j++) {
        if (Math.abs(byTop[j].top - rowTop) <= tol) cur.push(byTop[j]);
        else { rows.push(cur); cur = [byTop[j]]; rowTop = byTop[j].top; }
    }
    rows.push(cur);
    var out = [];
    for (var k = 0; k < rows.length; k++) {
        rows[k].sort(function (a, b) { return a.left - b.left; });
        for (var m = 0; m < rows[k].length; m++) {
            var it = rows[k][m];
            it.col = m; it.rowLen = rows[k].length;
            out.push(it);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Kiểu: đọc / ghi trong file (XMP) + nhớ kiểu dùng gần nhất cho file mới
// ---------------------------------------------------------------------------
var XMP_NS = 'http://ns.botoolphotoshop/sotrang/1.0/';
function xmpReady() {
    try {
        if (!ExternalObject.AdobeXMPScript) ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');
        XMPMeta.registerNamespace(XMP_NS, 'botoolsotrang');
        return true;
    } catch (e) { return false; }
}
function styleToString(o) {
    var a = [];
    for (var k in o) if (o.hasOwnProperty(k)) a.push(k + '=' + encodeURIComponent(String(o[k])));
    return a.join('&');
}
function styleFromString(str, o) {
    if (!str) return false;
    var parts = String(str).split('&'), got = false;
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].split('=');
        if (p.length < 2 || !o.hasOwnProperty(p[0])) continue;
        var v = decodeURIComponent(p[1]);
        var t = typeof o[p[0]];
        o[p[0]] = t == 'number' ? (parseFloat(v) || 0) : t == 'boolean' ? (v == 'true') : v;
        got = true;
    }
    return got;
}
function loadDocStyle(doc) {
    if (!xmpReady()) return '';
    try {
        var x = new XMPMeta(doc.xmpMetadata.rawData);
        var p = x.getProperty(XMP_NS, 'style');
        return p ? String(p.value) : '';
    } catch (e) { return ''; }
}
function saveDocStyle(doc, str) {
    if (!xmpReady()) return false;
    try {
        var x = new XMPMeta(doc.xmpMetadata.rawData);
        x.setProperty(XMP_NS, 'style', str);
        doc.xmpMetadata.rawData = x.serialize();
        return true;
    } catch (e) { return false; }
}
function loadLastStyle() {
    try { return app.getCustomOptions('SoTrangTuDong_last').getString(s('v')); } catch (e) { return ''; }
}
function saveLastStyle(str) {
    try { var d = new ActionDescriptor(); d.putString(s('v'), str); app.putCustomOptions('SoTrangTuDong_last', d, true); } catch (e) { }
}

function defaultStyle(arts) {
    var minSide = 3000;
    if (arts.length) minSide = Math.min(arts[0].w, arts[0].h);
    return {
        styleIdx: 0, tpl: '{so}', pos: 8,
        mx: Math.max(10, Math.round(minSide * 0.04)), my: Math.max(10, Math.round(minSide * 0.03)),
        mirror: true, font: 'ArialMT', size: Math.max(8, Math.round(minSide * 0.018)), color: '333333',
        fromPage: 2, start: 2, skipLast: false, skipList: '', pad: true
    };
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
function pad(n, digits) { var t = String(n); while (t.length < digits) t = '0' + t; return t; }
function parseList(str, total) {
    var set = {}, parts = String(str || '').replace(/[;，]/g, ',').split(',');
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i].replace(/\s+/g, '');
        if (!p) continue;
        var m = p.match(/^(\d+)[-–](\d+)$/);
        if (m) { var a = parseInt(m[1], 10), b = parseInt(m[2], 10); if (a > b) { var t = a; a = b; b = t; } for (var k = a; k <= b && k <= total; k++) set[k] = true; }
        else if (/^\d+$/.test(p)) set[parseInt(p, 10)] = true;
    }
    return set;
}
function hexToColor(hex) {
    hex = String(hex || '000000').replace(/[^0-9a-fA-F]/g, '');
    if (hex.length == 3) hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    while (hex.length < 6) hex += '0';
    var col = new SolidColor();
    col.rgb.hexValue = hex.substr(0, 6).toUpperCase();
    return col;
}
function colorToHex(col) { try { return col.rgb.hexValue; } catch (e) { return '000000'; } }
function cleanHex(t) { t = String(t || '').replace(/[^0-9a-fA-F]/g, ''); return t.length >= 6 ? t.substr(0, 6).toUpperCase() : (t.length == 3 ? t.toUpperCase() : ''); }
function fontExists(ps) { try { app.fonts.getByName(ps); return true; } catch (e) { return false; } }

function layerSetById(doc, id) {
    for (var i = 0; i < doc.layerSets.length; i++) {
        try { if (doc.layerSets[i].id == id) return doc.layerSets[i]; } catch (e) { }
    }
    return null;
}
function findNumberLayers(set, out) {
    for (var i = 0; i < set.layers.length; i++) {
        var l = set.layers[i];
        if (l.typename == 'LayerSet') findNumberLayers(l, out);
        else if (l.name.indexOf(TAG) == 0) out.push(l);
    }
    return out;
}
function px(u) { return typeof u == 'number' ? u : u.as('px'); }

// Gắn số từ trang thứ fromPage (vị trí, 1 = bìa); trang đó mang số start.
function firstIdx(st, arts) { return Math.max(0, Math.min(arts.length - 1, (st.fromPage || 1) - 1)); }
function pageNum(st, arts, i) { return st.start + (i - firstIdx(st, arts)); }
// Văn bản cho trang thứ i (0-based)
function pageText(st, arts, i) {
    var total = pageNum(st, arts, arts.length - 1);
    var digits = st.pad ? Math.max(2, String(total).length) : 1;
    var t = st.tpl || '{so}';
    t = t.replace(/\{so\}/gi, pad(pageNum(st, arts, i), digits));
    t = t.replace(/\{tong\}/gi, pad(total, digits));
    t = t.replace(/\{ten\}/gi, arts[i].name);
    return t;
}
function isSkipped(st, arts, i, list) {
    if (i < firstIdx(st, arts)) return true;
    if (st.skipLast && i == arts.length - 1) return true;
    return !!list[i + 1];
}

// ---------------------------------------------------------------------------
// Áp kiểu cho tất cả artboard
// ---------------------------------------------------------------------------
function applyAll(st, arts, fxFromId) {
    var doc = app.activeDocument;
    var res = doc.resolution;
    var list = parseList(st.skipList, arts.length);
    var col = hexToColor(st.color);
    var font = fontExists(st.font) ? st.font : null;
    var stat = { added: 0, updated: 0, removed: 0, warns: [] };
    if (!font) stat.warns.push('Không tìm thấy font "' + st.font + '", giữ font hiện có.');

    var fxOK = false;
    if (fxFromId) { try { selectById(fxFromId); executeAction(c('CpFX'), undefined, DialogModes.NO); fxOK = true; } catch (e) { fxOK = false; } }

    for (var i = 0; i < arts.length; i++) {
        var ab = arts[i];
        var set = layerSetById(doc, ab.id);
        if (!set) { stat.warns.push('Không tìm thấy artboard "' + ab.name + '".'); continue; }
        var nums = findNumberLayers(set, []);
        // Trùng: giữ cái đầu, xoá phần dư
        for (var d = nums.length - 1; d >= 1; d--) { try { nums[d].remove(); stat.removed++; } catch (e) { } }
        var lyr = nums.length ? nums[0] : null;

        if (isSkipped(st, arts, i, list)) {
            if (lyr) { try { lyr.remove(); stat.removed++; } catch (e) { } }
            continue;
        }

        var isNew = false;
        if (!lyr) {
            lyr = set.artLayers.add();
            lyr.kind = LayerKind.TEXT;
            try { lyr.move(set, ElementPlacement.PLACEATBEGINNING); } catch (e) { }
            isNew = true;
        }
        var txt = pageText(st, arts, i);
        var v = Math.floor(st.pos / 3), h = st.pos % 3;
        if (st.mirror && ab.rowLen >= 2 && ab.col % 2 == 0) h = 2 - h;   // trang trái của cặp: lật ngang

        var ti = lyr.textItem;
        try { if (ti.kind != TextType.POINTTEXT) ti.kind = TextType.POINTTEXT; } catch (e) { }
        ti.contents = txt;
        if (font) ti.font = font;
        ti.size = new UnitValue(st.size * 72 / res, 'pt');   // px -> pt theo độ phân giải file
        ti.color = col;
        try { ti.justification = h == 0 ? Justification.LEFT : h == 1 ? Justification.CENTER : Justification.RIGHT; } catch (e) { }
        if (isNew) ti.position = [new UnitValue(ab.left + ab.w / 2, 'px'), new UnitValue(ab.top + ab.h / 2, 'px')];
        lyr.name = TAG + ' ' + txt;

        // Canh theo khung chữ thật (bounds) trong artboard
        var b = lyr.boundsNoEffects || lyr.bounds;
        var L = px(b[0]), T = px(b[1]), R = px(b[2]), B = px(b[3]);
        var lw = R - L, lh = B - T;
        var tx = h == 0 ? ab.left + st.mx : h == 1 ? ab.left + (ab.w - lw) / 2 : ab.left + ab.w - st.mx - lw;
        var ty = v == 0 ? ab.top + st.my : v == 1 ? ab.top + (ab.h - lh) / 2 : ab.top + ab.h - st.my - lh;
        var dx = Math.round(tx - L), dy = Math.round(ty - T);
        if (dx || dy) lyr.translate(new UnitValue(dx, 'px'), new UnitValue(dy, 'px'));

        if (fxOK) { try { doc.activeLayer = lyr; executeAction(c('PaFX'), undefined, DialogModes.NO); } catch (e) { } }
        if (isNew) stat.added++; else stat.updated++;
    }
    return stat;
}
function removeAll(arts) {
    var doc = app.activeDocument, n = 0;
    for (var i = 0; i < arts.length; i++) {
        var set = layerSetById(doc, arts[i].id);
        if (!set) continue;
        var nums = findNumberLayers(set, []);
        for (var k = nums.length - 1; k >= 0; k--) { try { nums[k].remove(); n++; } catch (e) { } }
    }
    return n;
}
function selectById(id) {
    var d = new ActionDescriptor(), r = new ActionReference();
    r.putIdentifier(c('Lyr '), id);
    d.putReference(c('null'), r);
    d.putBoolean(c('MkVs'), false);
    executeAction(c('slct'), d, DialogModes.NO);
}

// Chạy trong suspendHistory (1 bước History)
function runOp(title, mode, st, arts, fxFromId) {
    $.global.__ST = { mode: mode, st: st, arts: arts, fx: fxFromId, out: null, err: '' };
    try { app.activeDocument.suspendHistory(title, '__ST_run()'); }
    catch (e) { if (!$.global.__ST.err) $.global.__ST.err = e.message; }
    return $.global.__ST;
}
function __ST_run() {
    var g = $.global.__ST;
    try { g.out = g.mode == 'remove' ? { removed: removeAll(g.arts), warns: [] } : applyAll(g.st, g.arts, g.fx); }
    catch (e) { g.err = e.message + (e.line ? ' (dòng ' + e.line + ')' : ''); }
}

// Lấy kiểu từ layer số trang đang chọn (nếu có)
function styleFromActive(st, arts) {
    try {
        var l = app.activeDocument.activeLayer;
        if (l.typename != 'ArtLayer' || l.kind != LayerKind.TEXT || l.name.indexOf(TAG) != 0) return null;
        var ti = l.textItem, res = app.activeDocument.resolution;
        var o = { font: st.font, size: st.size, color: st.color, id: l.id };
        try { o.font = ti.font; } catch (e) { }
        try { o.size = Math.round(ti.size.as('pt') * res / 72); } catch (e) { }
        try { o.color = colorToHex(ti.color); } catch (e) { }
        // Vị trí: tìm artboard chứa layer, suy ra góc + lề
        var top = l.parent;
        while (top && top.parent && top.parent.typename == 'LayerSet') top = top.parent;
        for (var i = 0; top && i < arts.length; i++) {
            if (arts[i].id != top.id) continue;
            var ab = arts[i], b = l.boundsNoEffects || l.bounds;
            var L = px(b[0]) - ab.left, T = px(b[1]) - ab.top, R = ab.left + ab.w - px(b[2]), B = ab.top + ab.h - px(b[3]);
            var cx = (L + (ab.w - R)) / 2 / ab.w, cy = (T + (ab.h - B)) / 2 / ab.h;
            var h = cx < 1 / 3 ? 0 : cx > 2 / 3 ? 2 : 1, v = cy < 1 / 3 ? 0 : cy > 2 / 3 ? 2 : 1;
            o.mx = Math.round(h == 0 ? L : h == 2 ? R : st.mx);
            o.my = Math.round(v == 0 ? T : v == 2 ? B : st.my);
            if (st.mirror && ab.rowLen >= 2 && ab.col % 2 == 0) h = 2 - h;   // trang trái: đổi về kiểu trang phải
            o.pos = v * 3 + h;
            break;
        }
        return o;
    } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// Chọn font (tìm theo tên)
// ---------------------------------------------------------------------------
function pickFont(cur) {
    var w = new Window('dialog', 'Chọn font');
    w.alignChildren = 'fill'; w.margins = 8; w.spacing = 4;
    var q = w.add('edittext', undefined, ''); q.characters = 34;
    q.helpTip = 'Gõ một phần tên font, ví dụ: arial, montserrat, roboto';
    var lb = w.add('listbox', undefined, [], {}); lb.preferredSize = [320, 260];
    var bg = w.add('group'); bg.alignment = 'right';
    var bOK = bg.add('button', undefined, 'Chọn', { name: 'ok' });
    bg.add('button', undefined, 'Hủy', { name: 'cancel' });
    var all = [];
    for (var i = 0; i < app.fonts.length; i++) { try { var f = app.fonts[i]; all.push({ n: f.name, ps: f.postScriptName }); } catch (e) { } }
    function fill() {
        lb.removeAll();
        var t = q.text.toLowerCase(), n = 0;
        for (var k = 0; k < all.length && n < 300; k++) {
            if (t && all[k].n.toLowerCase().indexOf(t) < 0 && all[k].ps.toLowerCase().indexOf(t) < 0) continue;
            var it = lb.add('item', all[k].n); it.ps = all[k].ps; n++;
            if (all[k].ps == cur) it.selected = true;
        }
    }
    q.onChanging = fill;
    lb.onDoubleClick = function () { if (lb.selection) w.close(1); };
    fill();
    w.onShow = function () { q.active = true; };
    if (w.show() != 1 || !lb.selection) return null;
    return lb.selection.ps;
}

// ---------------------------------------------------------------------------
// Hộp thoại (gọn, nhớ vị trí)
// ---------------------------------------------------------------------------
function placeWindow(w) {
    try {
        var fb = w.frameBounds, fw = fb.right - fb.left, fh = fb.bottom - fb.top;
        var x = null, y = null;
        try { var d = app.getCustomOptions('SoTrangTuDong_win'); x = d.getInteger(s('x')); y = d.getInteger(s('y')); } catch (e) { }
        var scr = $.screens[0];
        if (x != null) for (var i = 0; i < $.screens.length; i++) {
            var sc = $.screens[i];
            if (x + 40 >= sc.left && x < sc.right - 40 && y >= sc.top && y < sc.bottom - 40) { scr = sc; break; }
        }
        if (x == null) { x = scr.right - fw - 40; y = scr.top + 90; }
        x = Math.max(scr.left, Math.min(x, scr.right - fw));
        y = Math.min(y, scr.bottom - fh - 50);
        y = Math.max(y, scr.top + 10);
        w.frameLocation = [x, y];
    } catch (e2) { }
}

var HELP = 'SỐ TRANG TỰ ĐỘNG\n\n' +
    '• Bấm "Cập nhật tất cả" là gắn / cập nhật số cho MỌI artboard theo thứ tự trang (trên xuống, trái sang).\n' +
    '• Muốn đổi kiểu: chạy lại tool, sửa 1 chỗ, bấm "Cập nhật tất cả" là tất cả đổi theo. Kiểu được lưu ngay trong file PSD.\n' +
    '• Thêm / bớt / dời artboard: chạy lại tool, bấm "Cập nhật tất cả" là số tự đánh lại.\n' +
    '• Sửa tay 1 số trang (font, cỡ, màu, hiệu ứng, kéo sang chỗ khác) rồi CHỌN layer đó và chạy tool: tool lấy kiểu + vị trí của nó, bấm "Cập nhật tất cả" là mọi trang theo (trang trái tự đối xứng).\n' +
    '• Mẫu chữ: {so} = số trang, {tong} = tổng số trang, {ten} = tên artboard. Ví dụ: "Trang {so} / {tong}".\n' +
    '• "Gắn số từ trang thứ 2, mang số 2" = bìa không hiện số nhưng vẫn tính là trang 1. Muốn bìa không tính: để "mang số 1".\n' +
    '• Bỏ: gõ vị trí trang không muốn hiện số, ví dụ "5, 10-12" (vẫn được tính).\n' +
    '• Đối xứng trang đôi (như sách): trang bên trái của mỗi cặp lật vị trí, Dưới phải thành Dưới trái. Trang đứng 1 mình trong hàng (bìa) giữ nguyên.\n' +
    '• Layer số tên "[Số trang] …", đừng đổi tên để tool còn nhận ra.';

function showDialog(st, arts, fromActive) {
    var doc = app.activeDocument;
    var startState = doc.activeHistoryState;
    var previewed = false, lastKey = '', result = null;

    var w = new Window('dialog', 'Số trang tự động  v' + TOOL_VERSION);
    w.orientation = 'column'; w.alignChildren = 'fill'; w.margins = [8, 6, 8, 6]; w.spacing = 4;
    function row() { var g = w.add('group'); g.orientation = 'row'; g.alignChildren = 'center'; g.spacing = 5; return g; }
    function num(g, label, val, tip) {
        if (label) g.add('statictext', undefined, label);
        var e = g.add('edittext', undefined, String(val)); e.characters = 4; if (tip) e.helpTip = tip; return e;
    }

    // Hàng 1: kiểu + mẫu chữ
    var r1 = row(); r1.add('statictext', undefined, 'Kiểu:');
    var names = []; for (var i = 0; i < STYLES.length; i++) names.push(STYLES[i].name);
    var ddStyle = r1.add('dropdownlist', undefined, names); ddStyle.preferredSize.width = 175;
    ddStyle.selection = Math.max(0, Math.min(STYLES.length - 1, st.styleIdx));
    r1.add('statictext', undefined, 'Mẫu:');
    var eTpl = r1.add('edittext', undefined, st.tpl); eTpl.characters = 16;
    eTpl.helpTip = '{so} = số trang, {tong} = tổng số trang, {ten} = tên artboard';
    var cbPad = r1.add('checkbox', undefined, '01'); cbPad.value = st.pad; cbPad.helpTip = 'Thêm số 0 phía trước (01 thay vì 1)';

    // Hàng 2: vị trí + lề
    var r2 = row(); r2.add('statictext', undefined, 'Vị trí:');
    var ddPos = r2.add('dropdownlist', undefined, POS); ddPos.selection = st.pos; ddPos.preferredSize.width = 110;
    var eMx = num(r2, 'Lề ngang', st.mx, 'Khoảng cách tới mép trái/phải artboard (px)');
    var eMy = num(r2, 'dọc', st.my, 'Khoảng cách tới mép trên/dưới artboard (px)');
    r2.add('statictext', undefined, 'px');
    var cbMirror = r2.add('checkbox', undefined, 'Đối xứng trang đôi'); cbMirror.value = st.mirror;
    cbMirror.helpTip = 'Trang bên trái của mỗi cặp: lật vị trí sang bên trái';

    // Hàng 3: font, cỡ, màu
    var r3 = row(); r3.add('statictext', undefined, 'Font:');
    var eFont = r3.add('edittext', undefined, st.font); eFont.characters = 16;
    eFont.helpTip = 'Tên PostScript của font. Bấm "Tìm…" để chọn.';
    var bFont = r3.add('button', undefined, 'Tìm…'); bFont.preferredSize = [48, 22];
    var eSize = num(r3, 'Cỡ', st.size, 'Cỡ chữ tính bằng px');
    r3.add('statictext', undefined, 'px  Màu #');
    var eCol = r3.add('edittext', undefined, st.color); eCol.characters = 6;
    var sw = r3.add('group'); sw.preferredSize = [22, 18];
    var bCol = r3.add('button', undefined, '…'); bCol.preferredSize = [26, 22]; bCol.helpTip = 'Bảng chọn màu';

    // Hàng 4: trang bỏ qua + bắt đầu
    var r4 = row();
    var eFrom = num(r4, 'Gắn số từ trang thứ', st.fromPage, 'Trang thứ mấy (tính theo thứ tự, bìa = 1) bắt đầu có số. Các trang trước đó không có số.');
    var eStart = num(r4, 'mang số', st.start, 'Số hiện trên trang đó. Ví dụ bìa tính là trang 1 thì trang thứ 2 mang số 2.');
    r4.add('statictext', undefined, 'Bỏ:');
    var cbLast = r4.add('checkbox', undefined, 'Trang cuối'); cbLast.value = st.skipLast;
    var eSkip = r4.add('edittext', undefined, st.skipList); eSkip.characters = 9; eSkip.helpTip = 'Bỏ số ở các trang (theo thứ tự), ví dụ: 5, 10-12. Trang bỏ vẫn được tính.';

    // Hàng 5: trạng thái + nút
    var status = w.add('statictext', undefined, ' ', { truncate: 'end' }); status.preferredSize.width = 520;
    var r5 = row(); r5.alignment = 'right';
    var bRemove = r5.add('button', undefined, 'Gỡ hết số'); bRemove.helpTip = 'Xoá mọi layer số trang';
    var bPrev = r5.add('button', undefined, 'Xem trước');
    var bHelp = r5.add('button', undefined, '?'); bHelp.preferredSize = [26, 24];
    var bOK = r5.add('button', undefined, 'Cập nhật tất cả', { name: 'ok' });
    bOK.helpTip = 'Gắn / cập nhật số cho mọi trang theo kiểu này (font, cỡ, màu, vị trí) rồi đóng';
    var bCancel = r5.add('button', undefined, 'Hủy', { name: 'cancel' });

    var fxFrom = fromActive ? fromActive.id : 0;

    function drawSwatch() {
        try {
            var hx = cleanHex(eCol.text) || '000000';
            if (hx.length == 3) hx = hx.charAt(0) + hx.charAt(0) + hx.charAt(1) + hx.charAt(1) + hx.charAt(2) + hx.charAt(2);
            var rgb = [parseInt(hx.substr(0, 2), 16) / 255, parseInt(hx.substr(2, 2), 16) / 255, parseInt(hx.substr(4, 2), 16) / 255, 1];
            sw.graphics.backgroundColor = sw.graphics.newBrush(sw.graphics.BrushType.SOLID_COLOR, rgb);
        } catch (e) { }
    }
    function intOf(e, def, min) { var v = parseInt(e.text, 10); if (isNaN(v)) v = def; if (min != null && v < min) v = min; return v; }
    function collect() {
        return {
            styleIdx: ddStyle.selection.index, tpl: eTpl.text || '{so}', pos: ddPos.selection.index,
            mx: intOf(eMx, st.mx, 0), my: intOf(eMy, st.my, 0), mirror: cbMirror.value,
            font: eFont.text.replace(/^\s+|\s+$/g, ''), size: intOf(eSize, st.size, 1), color: cleanHex(eCol.text) || st.color,
            fromPage: Math.min(arts.length, intOf(eFrom, 1, 1)), start: intOf(eStart, 1, 0), skipLast: cbLast.value, skipList: eSkip.text, pad: cbPad.value
        };
    }
    function countShown(o) {
        var list = parseList(o.skipList, arts.length), n = 0;
        for (var k = 0; k < arts.length; k++) if (!isSkipped(o, arts, k, list)) n++;
        return n;
    }
    function updateStatus(msg) {
        var o = collect();
        var fi = firstIdx(o, arts);
        status.text = (msg ? msg + '  ·  ' : '') + arts.length + ' trang, gắn số ' + countShown(o) + ' trang. Trang thứ ' + (fi + 1) + ' hiện "' + pageText(o, arts, fi) + '", trang cuối "' + pageText(o, arts, arts.length - 1) + '"';
    }
    function revert() {
        if (previewed) { try { doc.activeHistoryState = startState; } catch (e) { } previewed = false; lastKey = ''; }
    }
    function preview(silent) {
        var o = collect(), key = styleToString(o);
        if (previewed && key == lastKey) return o;
        revert();
        var g = runOp('Số trang tự động', 'apply', o, arts, fxFrom);
        previewed = true; lastKey = key;
        try { app.refresh(); } catch (e) { }
        if (g.err) { status.text = 'Lỗi: ' + g.err; if (!silent) alert('Có lỗi: ' + g.err + '\n\nBạn chụp màn hình gửi lại giúp mình nhé.'); return null; }
        var out = g.out;
        updateStatus('Đã xem trước: thêm ' + out.added + ', sửa ' + out.updated + ', xoá ' + out.removed);
        o.__warns = out.warns; o.__out = out;
        return o;
    }

    ddStyle.onChange = function () {
        var t = STYLES[ddStyle.selection.index].tpl;
        if (t != null) eTpl.text = t;
        updateStatus();
    };
    eTpl.onChanging = function () {
        var idx = STYLES.length - 1;
        for (var k = 0; k < STYLES.length - 1; k++) if (STYLES[k].tpl == eTpl.text) { idx = k; break; }
        if (ddStyle.selection.index != idx) { var h = ddStyle.onChange; ddStyle.onChange = null; ddStyle.selection = idx; ddStyle.onChange = h; }
        updateStatus();
    };
    cbPad.onClick = cbLast.onClick = function () { updateStatus(); };
    eSkip.onChanging = eStart.onChanging = eFrom.onChanging = function () { updateStatus(); };
    eCol.onChanging = function () { drawSwatch(); };
    bCol.onClick = function () {
        var old = app.foregroundColor;
        try {
            app.foregroundColor = hexToColor(cleanHex(eCol.text) || st.color);
            if (app.showColorPicker()) { eCol.text = colorToHex(app.foregroundColor); drawSwatch(); }
        } catch (e) { }
        try { app.foregroundColor = old; } catch (e) { }
    };
    bFont.onClick = function () {
        status.text = 'Đang đọc danh sách font…';
        var ps = pickFont(eFont.text);
        if (ps) eFont.text = ps;
        updateStatus();
    };
    bHelp.onClick = function () { alert(HELP); };
    bPrev.onClick = function () { preview(false); };
    bRemove.onClick = function () {
        if (!confirm('Xoá mọi layer số trang trong ' + arts.length + ' artboard?')) return;
        revert();
        var g = runOp('Gỡ số trang', 'remove', null, arts, 0);
        if (g.err) { alert('Có lỗi: ' + g.err); return; }
        result = { removed: g.out.removed };
        w.close(1);
    };
    bOK.onClick = function () {
        var o = preview(false);
        if (!o) return;
        result = o; w.close(1);
    };
    bCancel.onClick = function () { revert(); w.close(2); };
    w.onClose = function () {
        if (!result) revert();
        try { var fl = w.frameLocation, d = new ActionDescriptor(); d.putInteger(s('x'), fl[0]); d.putInteger(s('y'), fl[1]); app.putCustomOptions('SoTrangTuDong_win', d, true); } catch (e) { }
    };
    w.onShow = function () {
        placeWindow(w); drawSwatch();
        updateStatus(fromActive ? 'Đã lấy font, cỡ, màu, vị trí từ số trang đang chọn' : '');
    };
    w.show();
    return result;
}

// ---------------------------------------------------------------------------
function main() {
    if (!app.documents.length) { alert('Hãy mở file có artboard trước.'); return; }
    var doc = app.activeDocument;
    var arts = sortByPosition(getArtboards());
    if (!arts.length) { alert('File này không có artboard nào.'); return; }

    var oldUnits = app.preferences.rulerUnits, oldType = app.preferences.typeUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    app.preferences.typeUnits = TypeUnits.POINTS;
    try {
        var st = defaultStyle(arts);
        var saved = loadDocStyle(doc);
        if (!styleFromString(saved, st)) styleFromString(loadLastStyle(), st);
        var fromActive = styleFromActive(st, arts);
        if (fromActive) {
            st.font = fromActive.font; st.size = fromActive.size; st.color = fromActive.color;
            if (fromActive.pos != null) { st.pos = fromActive.pos; st.mx = fromActive.mx; st.my = fromActive.my; }
        }

        var r = showDialog(st, arts, fromActive);
        if (!r) return;
        if (r.removed != null) { alert('Đã gỡ ' + r.removed + ' số trang. Bấm Ctrl+Z nếu muốn lấy lại.'); return; }
        var warns = r.__warns || [];
        delete r.__warns; delete r.__out;
        var str = styleToString(r);
        if (!saveDocStyle(doc, str)) warns.push('Không lưu được kiểu vào file (XMP), lần sau tool dùng kiểu nhớ trong máy.');
        saveLastStyle(str);
        if (warns.length) alert(warns.join('\n'));
    } finally {
        app.preferences.rulerUnits = oldUnits;
        app.preferences.typeUnits = oldType;
    }
}

main();
