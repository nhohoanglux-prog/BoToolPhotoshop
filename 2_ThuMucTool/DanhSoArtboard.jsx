#target photoshop
/*
  @name: Đánh số Artboard
  @group: Artboard
  @desc: Đánh số lại artboard theo vị trí (trên xuống, trái sang), sắp lại bảng Layers, Ctrl+Z một lần là hoàn tác.
  @version: 1.1.0
  @date: 2026-11-25

  DanhSoArtboard.jsx  –  Đánh số lại artboard theo vị trí trên canvas
  - Thứ tự: hàng từ trên xuống dưới, trong mỗi hàng từ trái sang phải
    (hợp với kiểu dàn trang 2 trang một cặp ngang).
  - Đặt tên: "Trang 01", "Trang 02", ...
  - Sắp lại thứ tự artboard trong bảng Layers cho khớp (Trang 01 ở trên cùng).
  - Toàn bộ thao tác gom thành 1 bước History: bấm Ctrl+Z một lần là hoàn tác.
  Dùng cho Photoshop 2021/2022 trở lên.
*/

var c = function (s) { return charIDToTypeID(s); };
var s = function (s) { return stringIDToTypeID(s); };

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
        list.push({
            id: d.getInteger(s('layerID')),
            name: d.getString(c('Nm  ')),
            top: top, left: left, h: bottom - top, w: right - left
        });
    }
    return list;
}

function sortByPosition(list) {
    if (!list.length) return [];
    // Sai số để coi là "cùng một hàng": 30% chiều cao artboard thấp nhất
    var minH = list[0].h;
    for (var i = 1; i < list.length; i++) if (list[i].h < minH) minH = list[i].h;
    var tol = Math.max(1, minH * 0.3);

    var byTop = list.slice().sort(function (a, b) { return a.top - b.top; });
    var rows = [], cur = [byTop[0]], rowTop = byTop[0].top;
    for (var j = 1; j < byTop.length; j++) {
        if (Math.abs(byTop[j].top - rowTop) <= tol) {
            cur.push(byTop[j]);
        } else {
            rows.push(cur); cur = [byTop[j]]; rowTop = byTop[j].top;
        }
    }
    rows.push(cur);

    var out = [];
    for (var k = 0; k < rows.length; k++) {
        rows[k].sort(function (a, b) { return a.left - b.left; });
        for (var m = 0; m < rows[k].length; m++) out.push(rows[k][m]);
    }
    return out;
}

function selectById(id) {
    var d = new ActionDescriptor(), r = new ActionReference();
    r.putIdentifier(c('Lyr '), id);
    d.putReference(c('null'), r);
    d.putBoolean(c('MkVs'), false);
    executeAction(c('slct'), d, DialogModes.NO);
}

function renameSelected(name) {
    var d = new ActionDescriptor(), r = new ActionReference();
    r.putEnumerated(c('Lyr '), c('Ordn'), c('Trgt'));
    d.putReference(c('null'), r);
    var nd = new ActionDescriptor();
    nd.putString(c('Nm  '), name);
    d.putObject(c('T   '), c('Lyr '), nd);
    executeAction(c('setd'), d, DialogModes.NO);
}

function bringSelectedToFront() {
    var d = new ActionDescriptor(), r = new ActionReference();
    r.putEnumerated(c('Lyr '), c('Ordn'), c('Trgt'));
    d.putReference(c('null'), r);
    var r2 = new ActionReference();
    r2.putEnumerated(c('Lyr '), c('Ordn'), c('Frnt'));
    d.putReference(c('T   '), r2);
    executeAction(c('move'), d, DialogModes.NO);
}

function pad(n, digits) {
    var str = String(n);
    while (str.length < digits) str = '0' + str;
    return str;
}

function showDialog(total) {
    var w = new Window('dialog', 'Đánh số artboard');
    w.alignChildren = 'fill';
    w.add('statictext', undefined, 'Tìm thấy ' + total + ' artboard. Thứ tự: trên xuống dưới, trái sang phải.');

    var g1 = w.add('group'); g1.add('statictext', undefined, 'Tiền tố tên:');
    var prefix = g1.add('edittext', undefined, 'Trang '); prefix.characters = 16;

    var g2 = w.add('group'); g2.add('statictext', undefined, 'Bắt đầu từ số:');
    var startN = g2.add('edittext', undefined, '1'); startN.characters = 5;

    var g3 = w.add('group'); g3.add('statictext', undefined, 'Số chữ số (01 = 2, 001 = 3):');
    var digits = g3.add('edittext', undefined, total + 0 >= 100 ? '3' : '2'); digits.characters = 3;

    var reorder = w.add('checkbox', undefined, 'Sắp lại thứ tự trong bảng Layers cho khớp');
    reorder.value = true;

    var b = w.add('group'); b.alignment = 'right';
    b.add('button', undefined, 'Hủy', { name: 'cancel' });
    b.add('button', undefined, 'Đánh số', { name: 'ok' });

    if (w.show() !== 1) return null;
    return {
        prefix: prefix.text,
        start: parseInt(startN.text, 10) || 1,
        digits: parseInt(digits.text, 10) || 2,
        reorder: reorder.value
    };
}

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

var OPTS, ORDER, RUN_ERR;

function run() {
    try { runInner(); } catch (e) { RUN_ERR = e; }
}
function runInner() {
    var n = ORDER.length * (OPTS.reorder ? 2 : 1), k = 0;
    for (var i = 0; i < ORDER.length; i++) {
        prog('Đang đổi tên: ' + (i + 1) + '/' + ORDER.length, Math.round(++k / n * 100));
        selectById(ORDER[i].id);
        renameSelected(OPTS.prefix + pad(OPTS.start + i, OPTS.digits));
    }
    if (OPTS.reorder) {
        // Đưa từ trang cuối lên trên cùng trước, trang đầu lên sau cùng
        // => Trang 01 nằm trên cùng, các trang sau lần lượt xuống dưới.
        for (var j = ORDER.length - 1; j >= 0; j--) {
            prog('Đang sắp lại bảng Layers...', Math.round(++k / n * 100));
            selectById(ORDER[j].id);
            bringSelectedToFront();
        }
    }
    selectById(ORDER[0].id);
}

(function main() {
    if (!app.documents.length) { alert('Chưa mở file nào.'); return; }
    var arts = getArtboards();
    if (!arts.length) { alert('File này không có artboard nào.'); return; }
    ORDER = sortByPosition(arts);
    OPTS = showDialog(ORDER.length);
    if (!OPTS) return;
    var doc = app.activeDocument, before = doc.activeHistoryState;
    RUN_ERR = null;
    progOpen('Đánh số artboard');
    try { doc.suspendHistory('Đánh số artboard', 'run()'); } catch (e) { RUN_ERR = RUN_ERR || e; }
    finally { progClose(); }
    if (RUN_ERR) {
        try { doc.activeHistoryState = before; } catch (e2) { }
        alert(isStopErr(RUN_ERR) ? 'Đã dừng. File đã trả về như lúc trước khi chạy.' : 'Có lỗi: ' + RUN_ERR + '\nFile đã trả về như cũ.');
        return;
    }
    alert('Xong! Đã đánh số ' + ORDER.length + ' artboard.\nBấm Ctrl+Z nếu muốn hoàn tác.');
})();
