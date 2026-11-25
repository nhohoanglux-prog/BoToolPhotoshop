#target photoshop
/*
  @name: Chế độ nhẹ (bớt lag khi dàn trang)
  @group: Tối ưu file
  @desc: Tạm thay ảnh nhúng bằng bản nhẹ (chọn %), giữ nét artboard đang làm, xem RAM; bấm lại là trả ảnh gốc đầy đủ.
  @version: 1.1.0
  @date: 2026-11-25

  CheDoNhe.jsx
  - "Làm nhẹ": với mỗi Smart Object nhúng (Embedded), cất NGUYÊN file ảnh gốc ra thư mục
    "<tên file>_AnhGoc_CheDoNhe" cạnh file PSD/PSB, rồi Replace Contents bằng bản thu nhỏ
    theo % bạn chọn. Kích thước và vị trí trên trang giữ nguyên (đo khung trước/sau rồi chỉnh lại).
  - Bản nhẹ có tên bắt đầu bằng "NHE__", nhờ vậy tool (và tool xuất file) biết ảnh nào đang nhẹ.
  - "Trả về đầy đủ": Replace Contents lại bằng đúng file gốc đã cất, kích thước giữ nguyên.
  - "Giữ nét artboard đang chọn": chỉ làm nhẹ các artboard khác; nút "Làm nét artboard đang chọn"
    trả ảnh gốc cho artboard bạn chọn và làm nhẹ các artboard còn lại.
  - Không bao giờ tự xóa ảnh gốc. Lỗi giữa chừng thì quay về snapshot lúc bắt đầu.
  - Đọc RAM máy và RAM Photoshop qua PowerShell (cửa sổ đen có thể chớp 1 giây).
  Dùng cho Photoshop 2021/2022 trên Windows.
*/

var c = function (x) { return charIDToTypeID(x); };
var s = function (x) { return stringIDToTypeID(x); };
var NO = DialogModes.NO;
var TAG = 'NHE__';
var TAG_RE = /^NHE__(\d+)__(\d+)__/;
var RASTER_RE = /\.(jpe?g|png|psd|psb|tiff?|bmp|gif|webp|heic|tga)$/i;

// ---------------------------------------------------------------------------
// Tiện ích chung
// ---------------------------------------------------------------------------
function numOf(desc, key) {
    var t = desc.getType(key);
    if (t === DescValueType.UNITDOUBLE) return desc.getUnitDoubleValue(key);
    if (t === DescValueType.INTEGERTYPE) return desc.getInteger(key);
    return desc.getDouble(key);
}
function pad4(n) { var x = String(n); while (x.length < 4) x = '0' + x; return x; }
function mb(bytes) { return Math.round(bytes / 1048576); }
function gb(bytes) { return (bytes / 1073741824).toFixed(1).replace('.', ','); }
function fmtMB(bytes) { var m = bytes / 1048576; return m >= 1024 ? gb(bytes) + ' GB' : Math.round(m) + ' MB'; }

function layerDesc(id) {
    var r = new ActionReference();
    if (id) r.putIdentifier(c('Lyr '), id); else r.putEnumerated(c('Lyr '), c('Ordn'), c('Trgt'));
    return executeActionGet(r);
}
function selectLayerByID(id) {
    var r = new ActionReference(); r.putIdentifier(c('Lyr '), id);
    var d = new ActionDescriptor(); d.putReference(c('null'), r);
    d.putBoolean(c('MkVs'), false);
    executeAction(c('slct'), d, NO);
}
function selectedLayerIDs() {
    var ids = [];
    try {
        var r = new ActionReference();
        r.putProperty(s('property'), s('targetLayersIDs'));
        r.putEnumerated(c('Dcmn'), c('Ordn'), c('Trgt'));
        var d = executeActionGet(r);
        if (d.hasKey(s('targetLayersIDs'))) {
            var l = d.getList(s('targetLayersIDs'));
            for (var i = 0; i < l.count; i++) ids.push(l.getReference(i).getIdentifier());
        }
    } catch (e) { }
    if (!ids.length) { try { ids.push(layerDesc().getInteger(s('layerID'))); } catch (e2) { } }
    return ids;
}

// ---------------------------------------------------------------------------
// Quét layer: tìm Smart Object và artboard chứa nó
// ---------------------------------------------------------------------------
function scanDoc() {
    var ref = new ActionReference();
    ref.putProperty(c('Prpr'), c('NmbL'));
    ref.putEnumerated(c('Dcmn'), c('Ordn'), c('Trgt'));
    var count = executeActionGet(ref).getInteger(c('NmbL'));
    var start = 1;
    try { app.activeDocument.backgroundLayer; start = 0; } catch (e) { start = 1; }

    var stack = [], sos = [], abs = [], owner = {}; // owner[layerID] = artboard ID
    for (var i = count; i >= start; i--) {
        var r = new ActionReference(); r.putIndex(c('Lyr '), i);
        var d; try { d = executeActionGet(r); } catch (e1) { continue; }
        var id = d.getInteger(s('layerID'));
        var sec = d.hasKey(s('layerSection')) ? typeIDToStringID(d.getEnumerationValue(s('layerSection'))) : 'layerSectionContent';
        var ab = 0;
        for (var k = 0; k < stack.length; k++) if (stack[k].ab) { ab = stack[k].id; break; }
        if (sec === 'layerSectionEnd') { stack.pop(); continue; }
        if (sec === 'layerSectionStart') {
            var isAB = d.hasKey(s('artboardEnabled')) && d.getBoolean(s('artboardEnabled'));
            if (isAB) abs.push({ id: id, name: d.getString(c('Nm  ')) });
            owner[id] = isAB ? id : ab;
            stack.push({ id: id, ab: isAB });
            continue;
        }
        owner[id] = ab;
        if (!d.hasKey(s('smartObject'))) continue;
        var so = d.getObjectValue(s('smartObject'));
        var o = {
            id: id, name: d.getString(c('Nm  ')), ab: ab,
            file: so.hasKey(s('fileReference')) ? so.getString(s('fileReference')) : '',
            docId: so.hasKey(s('documentID')) ? so.getString(s('documentID')) : '',
            linked: so.hasKey(s('linked')) ? so.getBoolean(s('linked')) : false,
            w: 0, h: 0, proxy: 0, pct: 0
        };
        try {
            var sz = d.getObjectValue(s('smartObjectMore')).getObjectValue(s('size'));
            o.w = numOf(sz, s('width')); o.h = numOf(sz, s('height'));
        } catch (e2) { }
        var m = TAG_RE.exec(o.file);
        if (m) { o.proxy = parseInt(m[1], 10); o.pct = parseInt(m[2], 10); }
        if (!o.docId) o.docId = 'L' + id;
        sos.push(o);
    }
    return { sos: sos, abs: abs, owner: owner };
}

// Nhóm các layer dùng chung 1 nội dung (Ctrl+J từ cùng 1 Smart Object)
function groupBy(list, keyFn) {
    var map = {}, out = [];
    for (var i = 0; i < list.length; i++) {
        var k = keyFn(list[i]);
        if (!map[k]) { map[k] = { key: k, layers: [] }; out.push(map[k]); }
        map[k].layers.push(list[i]);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Đo khung layer (tắt mask tạm thời để đo đúng khung ảnh) và chỉnh lại cho khớp
// ---------------------------------------------------------------------------
function setLayerBool(id, key, val) {
    var d = new ActionDescriptor(), r = new ActionReference();
    r.putIdentifier(c('Lyr '), id); d.putReference(c('null'), r);
    var l = new ActionDescriptor(); l.putBoolean(s(key), val);
    d.putObject(c('T   '), c('Lyr '), l);
    executeAction(c('setd'), d, NO);
}
function measure(id) {
    var d = layerDesc(id), off = [];
    var pairs = [['hasUserMask', 'userMaskEnabled'], ['hasVectorMask', 'vectorMaskEnabled']];
    for (var i = 0; i < pairs.length; i++) {
        try {
            if (d.hasKey(s(pairs[i][0])) && d.getBoolean(s(pairs[i][0])) &&
                (!d.hasKey(s(pairs[i][1])) || d.getBoolean(s(pairs[i][1])))) {
                setLayerBool(id, pairs[i][1], false); off.push(pairs[i][1]);
            }
        } catch (e) { }
    }
    var dd = off.length ? layerDesc(id) : d;
    var b = dd.getObjectValue(dd.hasKey(s('boundsNoEffects')) ? s('boundsNoEffects') : s('bounds'));
    var out = { l: b.getUnitDoubleValue(s('left')), t: b.getUnitDoubleValue(s('top')),
                r: b.getUnitDoubleValue(s('right')), b: b.getUnitDoubleValue(s('bottom')) };
    for (var j = 0; j < off.length; j++) try { setLayerBool(id, off[j], true); } catch (e2) { }
    return out;
}
// Co giãn đều + dời cho khung layer khớp khung cũ T. Trả về độ lệch lớn nhất (px).
function fitTo(id, T) {
    selectLayerByID(id);
    var lay = app.activeDocument.activeLayer;
    var locks = null;
    try { locks = { all: lay.allLocked, pos: lay.positionLocked }; if (locks.all) lay.allLocked = false; if (locks.pos) lay.positionLocked = false; } catch (e) { }
    var err = 999;
    try {
        for (var it = 0; it < 3; it++) {
            var B = measure(id);
            var w = B.r - B.l, h = B.b - B.t, tw = T.r - T.l, th = T.b - T.t;
            if (w < 1 || h < 1) break;
            var k = (w >= h) ? tw / w : th / h;
            if (Math.abs(k - 1) > 0.0004) { lay.resize(k * 100, k * 100, AnchorPosition.MIDDLECENTER); B = measure(id); }
            var dx = (T.l + T.r - B.l - B.r) / 2, dy = (T.t + T.b - B.t - B.b) / 2;
            if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) { lay.translate(new UnitValue(dx, 'px'), new UnitValue(dy, 'px')); B = measure(id); }
            err = Math.max(Math.abs(B.l - T.l), Math.abs(B.t - T.t), Math.abs(B.r - T.r), Math.abs(B.b - T.b));
            if (err <= 1) break;
        }
    } finally {
        try { if (locks) { if (locks.pos) lay.positionLocked = true; if (locks.all) lay.allLocked = true; } } catch (e2) { }
    }
    return err;
}

// ---------------------------------------------------------------------------
// Smart Object: xuất nội dung, thay nội dung
// ---------------------------------------------------------------------------
function exportContents(id, file) {
    selectLayerByID(id);
    var d = new ActionDescriptor(); d.putPath(c('null'), file);
    executeAction(s('placedLayerExportContents'), d, NO);
}
function replaceContents(id, file) {
    selectLayerByID(id);
    var oldName = layerDesc(id).getString(c('Nm  '));
    var d = new ActionDescriptor(); d.putPath(c('null'), file);
    executeAction(s('placedLayerReplaceContents'), d, NO);
    // Replace Contents có thể đổi tên layer theo tên file: đặt lại tên cũ
    try { if (layerDesc(id).getString(c('Nm  ')) !== oldName) app.activeDocument.activeLayer.name = oldName; } catch (e) { }
}
function currentFileRef(id) {
    try { return layerDesc(id).getObjectValue(s('smartObject')).getString(s('fileReference')); } catch (e) { return ''; }
}

// ---------------------------------------------------------------------------
// Kho ảnh gốc: <thư mục file>/<tên>_AnhGoc_CheDoNhe/0001/...
// ---------------------------------------------------------------------------
function storeFolder(doc) {
    var base = doc.name.replace(/\.[^.]+$/, '');
    return new Folder(doc.path.fsName + '/' + base + '_AnhGoc_CheDoNhe');
}
function readInfo(folder) {
    var f = new File(folder.fsName + '/thongtin.txt'), o = {};
    if (!f.exists) return null;
    f.encoding = 'UTF-8'; f.open('r');
    while (!f.eof) { var ln = f.readln(), p = ln.indexOf('='); if (p > 0) o[ln.substring(0, p)] = ln.substring(p + 1); }
    f.close();
    return o;
}
function writeInfo(folder, o) {
    var f = new File(folder.fsName + '/thongtin.txt');
    f.encoding = 'UTF-8'; f.lineFeed = 'Windows'; f.open('w');
    for (var k in o) if (o.hasOwnProperty(k)) f.writeln(k + '=' + o[k]);
    f.close();
}
function itemFolders(store) {
    var out = [];
    if (!store.exists) return out;
    var l = store.getFiles();
    for (var i = 0; i < l.length; i++) if (l[i] instanceof Folder && /^\d{4}$/.test(l[i].name)) out.push(l[i]);
    return out;
}
function nextItemNo(store) {
    var l = itemFolders(store), mx = 0;
    for (var i = 0; i < l.length; i++) mx = Math.max(mx, parseInt(l[i].name, 10));
    return mx + 1;
}
function originalIn(folder, info) {
    if (info && info.goc) { var f = new File(folder.fsName + '/' + info.goc); if (f.exists) return f; }
    var l = folder.getFiles();
    for (var i = 0; i < l.length; i++)
        if (l[i] instanceof File && l[i].name.indexOf(TAG) !== 0 && l[i].name !== 'thongtin.txt') return l[i];
    return null;
}
function chunk(f, pos, n) {
    f.encoding = 'BINARY'; f.open('r'); f.seek(pos); var x = f.read(n); f.close(); return x;
}
// Hai file giống nhau? (so dung lượng + 3 đoạn 64 KB đầu, giữa, cuối)
function sameFile(a, b) {
    if (a.length !== b.length) return false;
    var n = 65536, L = a.length, pos = [0, Math.max(0, Math.floor(L / 2) - n / 2), Math.max(0, L - n)];
    for (var i = 0; i < pos.length; i++) if (chunk(a, pos[i], n) !== chunk(b, pos[i], n)) return false;
    return true;
}
function writeReadme(store) {
    var f = new File(store.fsName + '/DOC_KY.txt');
    if (f.exists) return;
    f.encoding = 'UTF-8'; f.lineFeed = 'Windows'; f.open('w');
    f.write('\uFEFF');
    f.writeln('Thư mục này chứa ẢNH GỐC đầy đủ chất lượng của các Smart Object, do tool "Chế độ nhẹ" cất ra.');
    f.writeln('ĐỪNG XÓA hay đổi tên khi file Photoshop còn ảnh ở chế độ nhẹ (ảnh tên bắt đầu bằng NHE__).');
    f.writeln('Luôn để thư mục này nằm cạnh file PSD/PSB. Chép file đi chỗ khác thì chép kèm thư mục này.');
    f.writeln('Chỉ xóa được khi: đã "Trả về đầy đủ" tất cả, đã lưu file (Ctrl+S), và không còn bản lưu nào ở chế độ nhẹ.');
    f.close();
}

// ---------------------------------------------------------------------------
// Tạo bản nhẹ từ file gốc
// ---------------------------------------------------------------------------
function makeProxy(orig, outFile, pct, minEdge) {
    var d = app.open(orig);
    try {
        var W = d.width.as('px'), H = d.height.as('px');
        if (Math.max(W, H) < minEdge) return null;
        var f = pct / 100;
        try { if (d.mode === DocumentMode.BITMAP) d.changeMode(ChangeMode.GRAYSCALE); } catch (e0) { }
        try { if (d.mode === DocumentMode.INDEXEDCOLOR || d.mode === DocumentMode.MULTICHANNEL || d.mode === DocumentMode.DUOTONE) d.changeMode(ChangeMode.RGB); } catch (e1) { }
        if (d.bitsPerChannel !== BitsPerChannelType.EIGHT) d.bitsPerChannel = BitsPerChannelType.EIGHT;
        var jpg = /\.jpe?g$/i.test(outFile.name);
        if (jpg) d.flatten();
        else if (d.layers.length > 1 || !d.layers[0].isBackgroundLayer) { try { d.mergeVisibleLayers(); } catch (e2) { } }
        var nw = Math.max(1, Math.round(W * f)), nh = Math.max(1, Math.round(H * f));
        // Giữ kích thước in (inch) bằng cách hạ độ phân giải cùng tỉ lệ.
        d.resizeImage(new UnitValue(nw, 'px'), new UnitValue(nh, 'px'), Math.max(1, d.resolution * f), ResampleMethod.BICUBIC);
        if (jpg) {
            var jo = new JPEGSaveOptions(); jo.quality = 10; jo.embedColorProfile = true;
            d.saveAs(outFile, jo, true, Extension.LOWERCASE);
        } else {
            var po = new PhotoshopSaveOptions(); po.maximizeCompatibility = true; po.embedColorProfile = true;
            d.saveAs(outFile, po, true, Extension.LOWERCASE);
        }
        return { w: W, h: H, pw: nw, ph: nh };
    } finally {
        d.close(SaveOptions.DONOTSAVECHANGES);
    }
}

// ---------------------------------------------------------------------------
// RAM: đọc qua PowerShell (Photoshop không có lệnh đọc RAM trong script)
// ---------------------------------------------------------------------------
function readRAM() {
    if ($.os.indexOf('Windows') < 0) return null;
    try {
        var dir = Folder.temp.fsName;
        if (/[^\x00-\x7f]/.test(dir)) dir = 'C:\\Users\\Public';
        var tmp = new Folder(dir + '\\BoToolPhotoshop'); if (!tmp.exists) tmp.create();
        var out = new File(tmp.fsName + '\\ram.txt'); if (out.exists) out.remove();
        var ps = new File(tmp.fsName + '\\ram.ps1');
        ps.encoding = 'UTF-8'; ps.open('w');
        ps.writeln('$o = Get-CimInstance Win32_OperatingSystem');
        ps.writeln('$p = (Get-Process Photoshop -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum');
        ps.writeln('$q = (Get-Process Photoshop -ErrorAction SilentlyContinue | Measure-Object PrivateMemorySize64 -Sum).Sum');
        ps.writeln('"TOTAL=" + ($o.TotalVisibleMemorySize * 1024) + "`r`nFREE=" + ($o.FreePhysicalMemory * 1024) + "`r`nPS=" + $p + "`r`nPSPRIV=" + $q | Out-File -Encoding ascii "' + out.fsName + '"');
        ps.close();
        app.system('powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + ps.fsName + '"');
        if (!out.exists) return null;
        out.open('r'); var o = {};
        while (!out.eof) { var ln = out.readln(), p = ln.indexOf('='); if (p > 0) o[ln.substring(0, p)] = parseFloat(ln.substring(p + 1)) || 0; }
        out.close();
        if (!o.TOTAL) return null;
        return { total: o.TOTAL, free: o.FREE, ps: o.PS, priv: o.PSPRIV };
    } catch (e) { return null; }
}
function ramText(R) {
    if (!R) return 'Không đọc được RAM máy (cần PowerShell của Windows).';
    return 'Photoshop đang dùng: ' + gb(R.ps) + ' GB   |   RAM máy: ' + gb(R.total) + ' GB, còn trống ' + gb(R.free) + ' GB';
}

// ---------------------------------------------------------------------------
// Ước tính RAM phần ảnh nhúng (đếm điểm ảnh, 8-bit ~4 byte/điểm ảnh)
// ---------------------------------------------------------------------------
var BPP = 4;
function plan(S, mode, keepABs, pct, minEdge) {
    // mode: 'light' = các ảnh sẽ được làm nhẹ; trả về thống kê
    var groups = groupBy(S.sos, function (o) { return o.docId; });
    var now = 0, after = 0, todo = [], skipLinked = 0, skipSmall = 0, already = 0, kept = 0;
    var f2 = (pct / 100) * (pct / 100);
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i], o = g.layers[0], px = o.w * o.h;
        now += px * BPP;
        if (o.proxy) { already++; after += px * BPP; continue; }
        if (o.linked) { skipLinked++; after += px * BPP; continue; }
        if (o.file && !RASTER_RE.test(o.file)) { skipSmall++; after += px * BPP; continue; }
        if (o.w && Math.max(o.w, o.h) < minEdge) { skipSmall++; after += px * BPP; continue; }
        var inKeep = false;
        for (var j = 0; j < g.layers.length; j++) if (keepABs[g.layers[j].ab]) inKeep = true;
        if (inKeep) { kept++; after += px * BPP; continue; }
        todo.push(g); after += px * BPP * f2;
    }
    return { groups: groups.length, now: now, after: after, todo: todo, linked: skipLinked, small: skipSmall, already: already, kept: kept };
}

// ---------------------------------------------------------------------------
// Làm nhẹ / trả về đầy đủ
// ---------------------------------------------------------------------------
// ---------- Thanh tiến trình + nút Dừng (Esc) – khối dùng chung, giống hệt ở các tool ----------
// prog() ném lỗi PROG_STOP khi bấm Dừng / Esc; tool bắt lỗi đó rồi trả file về như lúc trước khi chạy.
var PROG = null, PROG_STOP = 'DUNG_THEO_YEU_CAU', PROG_T = 0;
function progOpen(title) {
    var w = new Window('palette', title || 'Đang chạy...');
    w.alignChildren = 'fill'; w.stop = false;
    w.msg = w.add('statictext', undefined, 'Chuẩn bị...'); w.msg.characters = 55;
    w.bar = w.add('progressbar', undefined, 0, 100); w.bar.preferredSize.width = 400;
    var g = w.add('group'); g.alignment = 'right';
    g.add('statictext', undefined, 'Bấm Dừng hoặc Esc: hủy hết, file trả về như cũ');
    var b = g.add('button', undefined, 'Dừng');
    b.onClick = function () { w.stop = true; b.text = 'Đang dừng...'; };
    w.addEventListener('keydown', function (e) { if (e.keyName == 'Escape') w.stop = true; });
    w.onClose = function () { w.stop = true; };
    PROG = w; PROG_T = 0;
    w.show();
}
function prog(msg, pct) {
    if (!PROG) return;
    if (msg != null) PROG.msg.text = msg;
    if (pct != null) PROG.bar.value = pct;
    PROG.update();
    var now = new Date().getTime();
    if (now - PROG_T > 600) { PROG_T = now; try { app.refresh(); } catch (e) { } }
    if (PROG && PROG.stop) throw new Error(PROG_STOP);
}
function progClose() {
    if (!PROG) return;
    var w = PROG; PROG = null; w.onClose = null;
    try { w.close(); } catch (e) { }
}
// Bấm Dừng, hoặc Esc của chính Photoshop ("User cancelled the operation", mã 8007)
function isStopErr(e) {
    if (!e) return false;
    var m = String(e.message || e);
    return m.indexOf(PROG_STOP) >= 0 || e.number == 8007 || /cancel/i.test(m);
}
// ---------- hết khối dùng chung ----------

function lighten(doc, store, groups, pct, minEdge, log, stat) {
    if (!store.exists) store.create();
    writeReadme(store);
    // Bảng các ảnh gốc đã cất (để dùng lại bản nhẹ, khỏi tạo lại khi đổi artboard)
    var cache = [], items = itemFolders(store);
    for (var q = 0; q < items.length; q++) {
        var inf = readInfo(items[q]), of = originalIn(items[q], inf);
        if (of) cache.push({ folder: items[q], info: inf || {}, orig: of });
    }
    var next = nextItemNo(store);
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i], o = g.layers[0];
        prog('Làm nhẹ ' + (i + 1) + '/' + groups.length + ': ' + o.name, 100 * i / groups.length);
        // 1) Đo khung tất cả layer dùng chung nội dung này TRƯỚC khi thay
        var T = [];
        for (var a = 0; a < g.layers.length; a++) T.push(measure(g.layers[a].id));

        // 2) Cất file gốc
        var origName = (o.file || (o.name + '.psb')).replace(/[\\\/:*?"<>|]/g, '_');
        if (!/\.[a-z0-9]{2,4}$/i.test(origName)) origName += '.psb';
        var folder = new Folder(store.fsName + '/' + pad4(next)); folder.create();
        var orig = new File(folder.fsName + '/' + origName);
        try { exportContents(o.id, orig); } catch (e1) { }
        if (!orig.exists || orig.length <= 0) {
            try { folder.remove(); } catch (e2) { }
            log.push('Bỏ qua "' + o.name + '": không cất được ảnh gốc.'); continue;
        }
        // Đã có bản cất y hệt? Dùng lại, xóa bản vừa xuất (bản cũ vẫn còn nguyên).
        var useFolder = folder, useOrig = orig, info = null, isNew = true;
        for (var k = 0; k < cache.length; k++) {
            var cf = cache[k];
            if (cf.orig.name === orig.name && sameFile(cf.orig, orig)) {
                orig.remove(); try { folder.remove(); } catch (e3) { }
                useFolder = cf.folder; useOrig = cf.orig; info = cf.info; isNew = false; break;
            }
        }
        if (isNew) next++;
        var no = parseInt(useFolder.name, 10);

        // 3) Bản nhẹ (dùng lại nếu đã có đúng % này)
        var pext = /\.jpe?g$/i.test(origName) ? '.jpg' : '.psd';
        var pfile = new File(useFolder.fsName + '/' + TAG + pad4(no) + '__' + pct + '__' + origName.replace(/\.[^.]+$/, '') + pext);
        var dims = null;
        if (!pfile.exists) {
            try { dims = makeProxy(useOrig, pfile, pct, minEdge); }
            catch (e4) { log.push('Bỏ qua "' + o.name + '": không tạo được bản nhẹ (' + e4.message + ').'); }
            app.activeDocument = doc;
            if (!dims) {
                if (isNew) { try { useOrig.remove(); useFolder.remove(); } catch (e5) { } next--; }
                if (!pfile.exists) { stat.small++; continue; }
            }
        }
        if (!pfile.exists) continue;
        if (!info || !info.goc) {
            info = { goc: useOrig.name, rong: dims ? dims.w : o.w, cao: dims ? dims.h : o.h, dungluong: useOrig.length, layer: o.name };
            writeInfo(useFolder, info);
        }

        // 4) Thay bằng bản nhẹ rồi trả khung về như cũ
        try {
            replaceContents(o.id, pfile);
            if (currentFileRef(o.id).indexOf(TAG) !== 0) throw new Error('Photoshop không nhận bản nhẹ');
            for (var b = 0; b < g.layers.length; b++) {
                var err = fitTo(g.layers[b].id, T[b]);
                if (err > 2) log.push('Lưu ý "' + g.layers[b].name + '": lệch khung ~' + Math.round(err) + ' px.');
            }
        } catch (e6) {
            // Thất bại sau khi đã thay: trả ảnh gốc lại ngay cho layer này
            try {
                replaceContents(o.id, useOrig);
                for (var b2 = 0; b2 < g.layers.length; b2++) fitTo(g.layers[b2].id, T[b2]);
            } catch (e7) { throw new Error('Lỗi ở layer "' + o.name + '": ' + e6.message); }
            log.push('Bỏ qua "' + o.name + '": ' + e6.message + ' (đã trả ảnh gốc).');
            continue;
        }
        var W = parseFloat(info.rong) || o.w, H = parseFloat(info.cao) || o.h;
        stat.done++; stat.layers += g.layers.length;
        stat.before += W * H * BPP; stat.after += W * H * BPP * (pct / 100) * (pct / 100);
    }
}

function restore(doc, store, list, log, stat) {
    var groups = groupBy(list, function (o) { return String(o.proxy); });
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i], o = g.layers[0];
        prog('Trả ảnh gốc ' + (i + 1) + '/' + groups.length + ': ' + o.name, 100 * i / groups.length);
        var folder = new Folder(store.fsName + '/' + pad4(o.proxy));
        var info = folder.exists ? readInfo(folder) : null;
        var orig = folder.exists ? originalIn(folder, info) : null;
        if (!orig) { stat.missing++; log.push('KHÔNG TÌM THẤY ảnh gốc của "' + o.name + '" (thư mục ' + folder.fsName + ').'); continue; }
        var T = [];
        for (var a = 0; a < g.layers.length; a++) T.push(measure(g.layers[a].id));
        replaceContents(o.id, orig);
        if (TAG_RE.test(currentFileRef(o.id))) throw new Error('Photoshop không nhận ảnh gốc của "' + o.name + '"');
        for (var b = 0; b < g.layers.length; b++) {
            var err = fitTo(g.layers[b].id, T[b]);
            if (err > 2) log.push('Lưu ý "' + g.layers[b].name + '": lệch khung ~' + Math.round(err) + ' px.');
        }
        stat.done++; stat.layers += g.layers.length;
    }
}

function makeSnapshot(name) {
    var d = new ActionDescriptor(), r = new ActionReference(); r.putClass(c('SnpS'));
    d.putReference(c('null'), r);
    var r2 = new ActionReference(); r2.putProperty(c('HstS'), c('CrnH'));
    d.putReference(c('From'), r2);
    d.putString(c('Nm  '), name);
    d.putEnumerated(c('Usng'), c('HstS'), c('FllD'));
    executeAction(c('Mk  '), d, NO);
}

// ---------------------------------------------------------------------------
// Lưu lựa chọn
// ---------------------------------------------------------------------------
var PREF_FILE = new File(Folder.userData.fsName + '/BoToolPhotoshop/CheDoNhe.txt');
function loadPrefs() {
    var p = { pct: 50, minEdge: 1500, purge: true, keep: true };
    try {
        if (PREF_FILE.exists) {
            PREF_FILE.open('r');
            while (!PREF_FILE.eof) {
                var ln = PREF_FILE.readln(), i = ln.indexOf('=');
                if (i < 0) continue;
                var k = ln.substring(0, i), v = ln.substring(i + 1);
                if (k === 'pct' || k === 'minEdge') p[k] = parseInt(v, 10) || p[k]; else p[k] = (v === 'true');
            }
            PREF_FILE.close();
        }
    } catch (e) { }
    p.pct = Math.max(10, Math.min(90, p.pct));
    return p;
}
function savePrefs(p) {
    try {
        if (!PREF_FILE.parent.exists) PREF_FILE.parent.create();
        PREF_FILE.open('w');
        PREF_FILE.writeln('pct=' + p.pct); PREF_FILE.writeln('minEdge=' + p.minEdge);
        PREF_FILE.writeln('purge=' + p.purge); PREF_FILE.writeln('keep=' + p.keep);
        PREF_FILE.close();
    } catch (e) { }
}

// ---------------------------------------------------------------------------
// Hộp thoại
// ---------------------------------------------------------------------------
function showDialog(S, R, keepABs, keepNames, P) {
    var w = new Window('dialog', 'Chế độ nhẹ: bớt lag khi dàn trang');
    w.alignChildren = 'fill';

    var nProxy = 0, nFull = 0;
    for (var i = 0; i < S.sos.length; i++) { if (S.sos[i].proxy) nProxy++; else if (!S.sos[i].linked) nFull++; }

    var p0 = w.add('panel', undefined, 'Hiện tại');
    p0.alignChildren = 'left';
    p0.add('statictext', undefined, ramText(R));
    var stTxt = p0.add('statictext', undefined, '', { multiline: true }); stTxt.preferredSize = [520, 34];
    stTxt.text = S.sos.length + ' Smart Object (' + S.abs.length + ' artboard): ' + nFull + ' ảnh đầy đủ, ' + nProxy + ' ảnh đang nhẹ' +
        '.\nĐang chọn: ' + (keepNames.length ? keepNames.join(', ') : '(không có artboard nào)');

    var p1 = w.add('panel', undefined, 'Làm nhẹ');
    p1.alignChildren = 'left';
    var g1 = p1.add('group');
    g1.add('statictext', undefined, 'Độ nét bản nhẹ:');
    var sl = g1.add('slider', undefined, P.pct, 10, 90); sl.preferredSize.width = 260;
    var slTxt = g1.add('statictext', undefined, ''); slTxt.characters = 6;
    var est = p1.add('statictext', undefined, '', { multiline: true }); est.preferredSize = [520, 52];
    var g2 = p1.add('group');
    g2.add('statictext', undefined, 'Bỏ qua ảnh nhỏ hơn (px, cạnh dài):');
    var minE = g2.add('edittext', undefined, String(P.minEdge)); minE.characters = 6;
    var keep = p1.add('checkbox', undefined, 'Giữ nét artboard đang chọn (chỉ làm nhẹ các artboard khác)');
    keep.value = P.keep && keepNames.length > 0; keep.enabled = keepNames.length > 0;
    var purge = p1.add('checkbox', undefined, 'Dọn bộ nhớ tạm sau khi xong (Purge All, mất các bước Undo cũ)');
    purge.value = P.purge;

    function pctVal() { return Math.round(sl.value / 5) * 5; }
    function refresh() {
        var pct = pctVal(); slTxt.text = pct + '%';
        var me = parseInt(minE.text, 10) || 0;
        var pl = plan(S, 'light', keep.value ? keepABs : {}, pct, me);
        var saved = pl.now - pl.after;
        var line1 = 'Ảnh nhúng chiếm ước tính ' + fmtMB(pl.now) + ' RAM → còn ~' + fmtMB(pl.after) +
            (pl.now > 0 ? ' (bớt ~' + Math.round(100 * saved / pl.now) + '%)' : '') + '. Sẽ làm nhẹ ' + pl.todo.length + ' ảnh.';
        var line2 = R ? 'Dự kiến RAM trống: ' + gb(R.free) + ' GB → ~' + gb(R.free + saved) + ' GB (ước tính, rõ nhất sau khi lưu, đóng và mở lại file).'
                      : 'Ước tính theo số điểm ảnh, không phải số đo thật.';
        var skip = [];
        if (pl.already) skip.push(pl.already + ' đã nhẹ');
        if (pl.kept) skip.push(pl.kept + ' trong artboard đang chọn');
        if (pl.small) skip.push(pl.small + ' ảnh nhỏ/vector');
        if (pl.linked) skip.push(pl.linked + ' ảnh Linked');
        est.text = line1 + '\n' + line2 + (skip.length ? '\nGiữ nguyên: ' + skip.join(', ') + '.' : '');
    }
    sl.onChanging = refresh; minE.onChanging = refresh; keep.onClick = refresh;
    refresh();

    var act = null;
    var b1 = w.add('group'); b1.alignment = 'fill';
    var bLight = b1.add('button', undefined, 'Làm nhẹ');
    var bFocus = b1.add('button', undefined, 'Làm nét artboard đang chọn');
    var bFull = b1.add('button', undefined, 'Trả về đầy đủ tất cả');
    bLight.enabled = nFull > 0;
    bFocus.enabled = keepNames.length > 0;
    bFull.enabled = nProxy > 0;
    bFocus.helpTip = 'Trả ảnh gốc cho artboard đang chọn, đồng thời làm nhẹ các artboard khác.\nĐổi sang artboard khác thì chọn nó rồi bấm lại nút này.';
    bFull.helpTip = 'Trả lại ảnh gốc đầy đủ cho mọi ảnh đang nhẹ. Làm trước khi xuất file hoặc gửi file cho người khác.';
    bLight.onClick = function () { act = 'light'; w.close(1); };
    bFocus.onClick = function () { act = 'focus'; w.close(1); };
    bFull.onClick = function () { act = 'full'; w.close(1); };
    var b2 = w.add('group'); b2.alignment = 'right';
    b2.add('button', undefined, 'Đóng', { name: 'cancel' });
    w.add('statictext', undefined, 'Ảnh gốc được cất cạnh file, không bao giờ tự xóa. Chưa thử trên Photoshop thật: thử trên bản sao trước.');

    if (w.show() !== 1 || !act) return null;
    P.pct = pctVal(); P.minEdge = parseInt(minE.text, 10) || 0; P.keep = keep.value; P.purge = purge.value;
    savePrefs(P);
    return { act: act, pct: P.pct, minEdge: P.minEdge, keep: keep.value, purge: purge.value };
}

// ---------------------------------------------------------------------------
// Chạy
// ---------------------------------------------------------------------------
(function main() {
    if (!app.documents.length) { alert('Chưa mở file nào.'); return; }
    var doc = app.activeDocument;
    var hasPath = false; try { doc.path; hasPath = true; } catch (e) { }
    if (!hasPath) { alert('Hãy lưu file (Ctrl+S) một lần trước, để tool cất ảnh gốc vào thư mục cạnh file.'); return; }

    var S = scanDoc();
    if (!S.sos.length) { alert('File này không có Smart Object nào.\nTool chỉ làm nhẹ ảnh dạng Smart Object (đặt bằng File > Place hoặc kéo thả ảnh vào).'); return; }

    // Artboard đang chọn = artboard chứa các layer đang chọn
    var keepABs = {}, keepNames = [], sel = selectedLayerIDs();
    for (var i = 0; i < sel.length; i++) {
        var ab = S.owner[sel[i]];
        if (ab && !keepABs[ab]) {
            keepABs[ab] = true;
            for (var j = 0; j < S.abs.length; j++) if (S.abs[j].id === ab) keepNames.push(S.abs[j].name);
        }
    }

    var R0 = readRAM();
    var P = loadPrefs();
    var O = showDialog(S, R0, keepABs, keepNames, P);
    if (!O) return;

    var store = storeFolder(doc);
    if (O.act !== 'light' && !store.exists) {
        var hasProxy = false;
        for (var q = 0; q < S.sos.length; q++) if (S.sos[q].proxy) hasProxy = true;
        if (hasProxy) {
            alert('Không thấy thư mục ảnh gốc:\n' + store.fsName + '\n\nHãy chọn thư mục "..._AnhGoc_CheDoNhe" của file này.');
            var pick = Folder.selectDialog('Chọn thư mục ảnh gốc (..._AnhGoc_CheDoNhe)');
            if (!pick) return;
            store = pick;
        }
    }

    var oldUnits = app.preferences.rulerUnits, oldDlg = app.displayDialogs;
    app.preferences.rulerUnits = Units.PIXELS;
    app.displayDialogs = DialogModes.NO;
    var snap = 'Trước Chế độ nhẹ ' + new Date().getTime();
    var log = [], stL = { done: 0, layers: 0, before: 0, after: 0, small: 0 }, stR = { done: 0, layers: 0, missing: 0 }, err = null;
    var t0 = new Date().getTime();
    try {
        makeSnapshot(snap);
        progOpen(O.act === 'full' ? 'Đang trả ảnh gốc...' : 'Đang làm nhẹ...');
        // Trả ảnh gốc
        if (O.act === 'full' || O.act === 'focus') {
            // Lấy cả các layer dùng chung ảnh này ở artboard khác (thay 1 là đổi tất cả)
            var want = {}, back = [];
            for (var a = 0; a < S.sos.length; a++)
                if (S.sos[a].proxy && (O.act === 'full' || keepABs[S.sos[a].ab])) want[S.sos[a].proxy] = true;
            for (var a2 = 0; a2 < S.sos.length; a2++) if (S.sos[a2].proxy && want[S.sos[a2].proxy]) back.push(S.sos[a2]);
            if (back.length) restore(doc, store, back, log, stR);
        }
        // Làm nhẹ
        if (O.act === 'light' || O.act === 'focus') {
            var S2 = scanDoc();
            var pl = plan(S2, 'light', (O.act === 'focus' || O.keep) ? keepABs : {}, O.pct, O.minEdge);
            if (pl.todo.length) lighten(doc, store, pl.todo, O.pct, O.minEdge, log, stL);
        }
        prog('Xong.', 100);
    } catch (e2) {
        err = e2;
        try { app.activeDocument = doc; doc.activeHistoryState = doc.historyStates.getByName(snap); } catch (e3) { }
    } finally {
        progClose();
        try { app.activeDocument = doc; } catch (e5) { }
        try { if (!err && sel.length) selectLayerByID(sel[0]); } catch (e7) { }
        app.preferences.rulerUnits = oldUnits;
        app.displayDialogs = oldDlg;
    }

    if (err && isStopErr(err)) {
        alert('Đã dừng. File đã trả về như lúc trước khi chạy tool (snapshot "' + snap + '").\nẢnh gốc vẫn nằm nguyên trong:\n' + store.fsName);
        return;
    }
    if (err) {
        alert('Có lỗi, file đã được trả về như lúc trước khi chạy tool:\n' + err + (err.line ? '\n(dòng ' + err.line + ')' : '') +
              '\n\nẢnh gốc vẫn nằm trong:\n' + store.fsName);
        return;
    }
    if (O.purge) { try { app.purge(PurgeTarget.ALLCACHES); } catch (e6) { } }
    var R1 = readRAM();
    var secs = Math.round((new Date().getTime() - t0) / 1000);
    var msg = 'Xong sau ' + secs + ' giây.\n';
    if (stR.done) msg += '\nĐã trả ảnh gốc đầy đủ: ' + stR.done + ' ảnh (' + stR.layers + ' layer).';
    if (stR.missing) msg += '\n⚠ ' + stR.missing + ' ảnh KHÔNG tìm thấy ảnh gốc, vẫn đang nhẹ (xem chi tiết bên dưới).';
    if (stL.done) msg += '\nĐã làm nhẹ ' + stL.done + ' ảnh (' + stL.layers + ' layer) ở ' + O.pct + '%: phần ảnh này ~' +
        fmtMB(stL.before) + ' → ~' + fmtMB(stL.after) + ' (ước tính theo điểm ảnh).';
    if (!stR.done && !stL.done) msg += '\nKhông có ảnh nào cần đổi.';
    if (R0 && R1) msg += '\n\nTrước: ' + ramText(R0) + '\nSau:   ' + ramText(R1) +
        '\n(Photoshop thường giữ RAM đã xin; lưu file, đóng và mở lại sẽ thấy rõ nhất.)';
    if (stL.done) msg += '\n\nẢnh gốc cất tại:\n' + store.fsName + '\nNhớ chạy "Trả về đầy đủ" trước khi xuất file hoặc gửi file đi.';
    msg += '\nMuốn hoàn tác: Window > History, bấm snapshot "' + snap + '"' + (O.purge ? ' (nếu Purge chưa xóa).' : '.');
    if (log.length) msg += '\n\nChi tiết:\n' + log.slice(0, 15).join('\n') + (log.length > 15 ? '\n... và ' + (log.length - 15) + ' dòng nữa' : '');
    alert(msg);
})();
