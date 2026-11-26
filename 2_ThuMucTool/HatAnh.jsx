#target photoshop
/*
  @name: Hạt ảnh (grain, giấy vẽ)
  @group: Hiệu ứng ảnh
  @desc: Phủ 1 lớp hạt nhẹ như ảnh phim (nền tối) hoặc vân giấy vẽ (nền sáng), chỉnh độ đậm được.
  @version: 1.0.0
  @date: 2026-11-26
  @icon: sparkles
*/
// Dùng cho ảnh mặt bằng xiên xuất từ SketchUp (plugin "Mặt bằng xiên") hoặc bất kỳ ảnh nào.
// Tạo layer "Hạt ảnh" trên cùng (trong artboard nếu layer đang chọn nằm trong artboard),
// đổ màu, Add Noise đơn sắc, làm mềm, đặt chế độ hoà trộn. 1 bước History, Ctrl+Z là bỏ.

var c = function (x) { return charIDToTypeID(x); };
var s = function (x) { return stringIDToTypeID(x); };

function loadPrefs() {
    var p = { kind: 0, amount: 12, soft: 0.6, opacity: 70 };
    try {
        var d = app.getCustomOptions('HatAnh_prefs');
        p.kind = d.getInteger(s('kind')); p.amount = d.getDouble(s('amount'));
        p.soft = d.getDouble(s('soft')); p.opacity = d.getDouble(s('opacity'));
    } catch (e) { }
    return p;
}
function savePrefs(p) {
    try {
        var d = new ActionDescriptor();
        d.putInteger(s('kind'), p.kind); d.putDouble(s('amount'), p.amount);
        d.putDouble(s('soft'), p.soft); d.putDouble(s('opacity'), p.opacity);
        app.putCustomOptions('HatAnh_prefs', d, true);
    } catch (e) { }
}

// artboard chứa layer (null nếu không có)
function artboardOf(layer) {
    var p = layer;
    while (p && p.typename != 'Document') {
        if (p.typename == 'LayerSet') {
            try {
                var ref = new ActionReference();
                ref.putIdentifier(c('Lyr '), p.id);
                var d = executeActionGet(ref);
                if (d.hasKey(s('artboardEnabled')) && d.getBoolean(s('artboardEnabled'))) {
                    var r = d.getObjectValue(s('artboard')).getObjectValue(s('artboardRect'));
                    return { set: p, l: r.getDouble(s('left')), t: r.getDouble(s('top')), r: r.getDouble(s('right')), b: r.getDouble(s('bottom')) };
                }
            } catch (e) { }
        }
        p = p.parent;
    }
    return null;
}

var P, RUN_ERR;

function run() {
    try { runInner(); } catch (e) { RUN_ERR = e; }
}

function runInner() {
    var doc = app.activeDocument;
    var ab = null;
    try { ab = artboardOf(doc.activeLayer); } catch (e) { }
    var L = doc.artLayers.add();
    L.name = 'Hạt ảnh';
    var parent = ab ? ab.set : doc;
    if (parent.layers[0] != L) L.move(parent.layers[0], ElementPlacement.PLACEBEFORE);

    if (ab) doc.selection.select([[ab.l, ab.t], [ab.r, ab.t], [ab.r, ab.b], [ab.l, ab.b]]);
    else doc.selection.selectAll();
    var col = new SolidColor();
    var v = 128;
    if (P.kind == 1) v = 255; // giấy vẽ: nền trắng, nhân (Multiply) chỉ làm tối chỗ có hạt
    col.rgb.red = v; col.rgb.green = v; col.rgb.blue = v;
    doc.selection.fill(col);
    doc.selection.deselect();

    L.applyAddNoise(P.amount, NoiseDistribution.GAUSSIAN, true);
    if (P.soft > 0) L.applyGaussianBlur(P.soft);
    if (P.kind == 1) L.blendMode = BlendMode.MULTIPLY;
    else L.blendMode = BlendMode.OVERLAY;
    L.opacity = P.opacity;
}

(function main() {
    if (!app.documents.length) { alert('Hãy mở ảnh trước (ví dụ ảnh PNG xuất từ SketchUp).'); return; }
    P = loadPrefs();

    var w = new Window('dialog', 'Hạt ảnh v1.0.0');
    w.alignChildren = 'fill';
    var g0 = w.add('group');
    g0.add('statictext', undefined, 'Kiểu:');
    var dd = g0.add('dropdownlist', undefined, ['Hạt phim (hợp ảnh nền tối, như ref nền đen)', 'Vân giấy vẽ (hợp ảnh nền sáng, vẽ tay chì)']);
    dd.selection = P.kind;

    function sliderRow(label, val, min, max, dec) {
        var g = w.add('group');
        var t = g.add('statictext', undefined, label); t.preferredSize.width = 110;
        var sl = g.add('slider', undefined, val, min, max); sl.preferredSize.width = 220;
        var e = g.add('edittext', undefined, String(val)); e.characters = 5;
        sl.onChanging = function () { e.text = String(Math.round(sl.value * Math.pow(10, dec)) / Math.pow(10, dec)); };
        e.onChange = function () {
            var n = parseFloat(String(e.text).replace(',', '.'));
            if (isNaN(n)) n = val;
            n = Math.max(min, Math.min(max, n));
            sl.value = n; e.text = String(n);
        };
        return e;
    }
    var eAmt = sliderRow('Lượng hạt (%)', P.amount, 1, 40, 0);
    var eSoft = sliderRow('Độ mềm hạt (px)', P.soft, 0, 3, 1);
    var eOp = sliderRow('Độ đậm lớp (%)', P.opacity, 5, 100, 0);
    w.add('statictext', undefined, 'Tạo layer "Hạt ảnh" trên cùng; chỉnh Opacity layer sau cũng được.');
    var gb = w.add('group'); gb.alignment = 'right';
    gb.add('button', undefined, 'Hủy', { name: 'cancel' });
    gb.add('button', undefined, 'Thêm hạt', { name: 'ok' });
    if (w.show() != 1) return;

    P.kind = dd.selection ? dd.selection.index : 0;
    P.amount = parseFloat(eAmt.text) || 12;
    P.soft = parseFloat(eSoft.text) || 0;
    P.opacity = parseFloat(eOp.text) || 70;
    savePrefs(P);

    var doc = app.activeDocument;
    var before = doc.activeHistoryState;
    try { doc.suspendHistory('Hạt ảnh', 'run()'); } catch (e) { RUN_ERR = RUN_ERR || e; }
    if (RUN_ERR) {
        try { doc.activeHistoryState = before; } catch (e2) { }
        alert('Có lỗi: ' + RUN_ERR + '\nFile đã trả về như cũ.');
    }
})();
