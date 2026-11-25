#target photoshop
/*
  @name: Xoay ảnh Isometric
  @group: Hình chiếu trục đo
  @desc: Biến ảnh phẳng thành mặt trên / mặt trái / mặt phải theo góc isometric, dimetric, 45°, 30/60, cavalier… (giữ Smart Object) và dựng khối hộp từ 3 ảnh.
  @version: 1.0.0
  @date: 2026-11-25

  XoayIsometric.jsx
  - Chọn 1 hoặc nhiều layer ảnh, chọn kiểu hình chiếu, bấm 1 nút: Mặt trên (sàn/mái), Mặt trái, Mặt phải.
  - Layer được đổi thành Smart Object rồi mới biến dạng, nên nhấp đúp vẫn sửa/thay ảnh được.
    Bấm lại nút khác trên cùng layer: tool đặt lại biến dạng cũ rồi áp góc mới (không bị chồng méo).
  - "Dựng khối hộp": chọn 3 ảnh cho 3 mặt, nhập kích thước, tool tự cắt (mask) cho khít cạnh và gom vào 1 group.
  - Toàn bộ thao tác gom thành 1 bước History: Ctrl+Z một lần là hoàn tác.
  Dùng cho Photoshop 2021/2022 trở lên. CHƯA thử trên Photoshop thật.
*/

var TOOL_VERSION = '1.0.0';
var c = function (x) { return charIDToTypeID(x); };
var s = function (x) { return stringIDToTypeID(x); };

// ---------------------------------------------------------------------------
// Danh sách kiểu hình chiếu.
// aL/aR: góc của trục trái / trục phải so với phương ngang (độ, đi lên).
// sL/sR/sZ: hệ số thu ngắn của trục trái / phải / đứng (1 = giữ nguyên kích thước ảnh).
// ---------------------------------------------------------------------------
var PRESETS = [
    { name: 'Isometric 30° / 30° (đẳng trục)', aL: 30, aR: 30, sL: 1, sR: 1, sZ: 1,
      note: 'Kiểu phổ biến nhất. 3 trục dài bằng nhau, cạnh nghiêng 30°.' },
    { name: 'Isometric pixel 2:1 (26,57°)', aL: 26.565, aR: 26.565, sL: 1, sR: 1, sZ: 1,
      note: 'Giống isometric nhưng dốc 2:1 (kiểu pixel art), trông dẹt hơn một chút.' },
    { name: 'Dimetric 7° / 42°', aL: 7, aR: 42, sL: 1, sR: 0.5, sZ: 1,
      note: 'Trục trái gần nằm ngang (7°, giữ nguyên), trục phải 42° thu còn 1/2.' },
    { name: 'Dimetric 15° / 15° (dẹt)', aL: 15, aR: 15, sL: 1, sR: 1, sZ: 0.9,
      note: 'Nhìn thấp hơn isometric, mặt trên dẹt, chiều cao thu còn 0,9.' },
    { name: 'Trục đo mặt bằng 45° / 45° (military)', aL: 45, aR: 45, sL: 1, sR: 1, sZ: 1,
      note: 'Mặt bằng giữ đúng hình, chỉ xoay 45°. Tường bị xiên. Hay dùng cho axo kiến trúc.' },
    { name: 'Trục đo mặt bằng 30° / 60°', aL: 30, aR: 60, sL: 1, sR: 1, sZ: 1,
      note: 'Mặt bằng giữ đúng hình, xoay 30°. Thấy tường trái nhiều hơn.' },
    { name: 'Trục đo mặt bằng 60° / 30°', aL: 60, aR: 30, sL: 1, sR: 1, sZ: 1,
      note: 'Mặt bằng giữ đúng hình, xoay 60°. Thấy tường phải nhiều hơn.' },
    { name: 'Cavalier 45° (mặt đứng thật)', aL: 0, aR: 45, sL: 1, sR: 1, sZ: 1,
      note: 'Mặt trái = mặt đứng chính, giữ nguyên. Chiều sâu chạy chéo 45°, không thu ngắn.' },
    { name: 'Cabinet 45° (sâu 1/2)', aL: 0, aR: 45, sL: 1, sR: 0.5, sZ: 1,
      note: 'Như Cavalier nhưng chiều sâu thu còn 1/2, trông tự nhiên hơn.' },
    { name: 'Cavalier 30°', aL: 0, aR: 30, sL: 1, sR: 1, sZ: 1,
      note: 'Mặt trái = mặt đứng chính. Chiều sâu chạy chéo 30°.' }
];
var FACE_LABEL = { top: 'Mặt trên', left: 'Mặt trái', right: 'Mặt phải' };

// Vector màn hình (trục y hướng xuống) của 3 trục.
function axes(p) {
    var r = Math.PI / 180;
    return {
        L: [-Math.cos(p.aL * r) * p.sL, -Math.sin(p.aL * r) * p.sL],
        R: [Math.cos(p.aR * r) * p.sR, -Math.sin(p.aR * r) * p.sR],
        Z: [0, -p.sZ]
    };
}
// Ma trận 2x2 [a, b, c, d]: x' = a*x + b*y, y' = c*x + d*y. Cột 1 = hướng sang phải của ảnh, cột 2 = hướng xuống của ảnh.
function faceMatrix(p, face) {
    var A = axes(p), u, v;
    if (face == 'top') { u = neg(A.L); v = neg(A.R); }
    else if (face == 'left') { u = neg(A.L); v = neg(A.Z); }
    else { u = A.R; v = neg(A.Z); }
    return [u[0], v[0], u[1], v[1]];
}
function neg(v) { return [-v[0], -v[1]]; }
function mul(m, n) { return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3]]; }
function app2(m, x, y) { return [m[0] * x + m[1] * y, m[2] * x + m[3] * y]; }
function rotLocal(deg) { // xoay ảnh trong mặt, theo chiều kim đồng hồ
    var k = Math.round(deg / 90) % 4;
    return [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][k];
}
function len(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1]); }

// ---------------------------------------------------------------------------
// Action Manager
// ---------------------------------------------------------------------------
function refTarget() { var r = new ActionReference(); r.putEnumerated(c('Lyr '), c('Ordn'), c('Trgt')); return r; }
function layerDesc(id) {
    var r = new ActionReference();
    if (id) r.putIdentifier(c('Lyr '), id); else r.putEnumerated(c('Lyr '), c('Ordn'), c('Trgt'));
    return executeActionGet(r);
}
function activeLayerID() { return layerDesc().getInteger(s('layerID')); }
function selectLayerByID(id, add) {
    var r = new ActionReference(); r.putIdentifier(c('Lyr '), id);
    var d = new ActionDescriptor(); d.putReference(c('null'), r);
    if (add) d.putEnumerated(s('selectionModifier'), s('selectionModifierType'), s('addToSelection'));
    d.putBoolean(c('MkVs'), false);
    executeAction(c('slct'), d, DialogModes.NO);
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
    if (!ids.length) { try { ids.push(activeLayerID()); } catch (e2) { } }
    // Sắp theo thứ tự trong bảng Layers: trên cùng trước
    var withIdx = [];
    for (var j = 0; j < ids.length; j++) {
        try { withIdx.push({ id: ids[j], idx: layerDesc(ids[j]).getInteger(s('itemIndex')) }); } catch (e3) { withIdx.push({ id: ids[j], idx: 0 }); }
    }
    withIdx.sort(function (a, b) { return b.idx - a.idx; });
    var out = []; for (var k = 0; k < withIdx.length; k++) out.push(withIdx[k].id);
    return out;
}
// Mọi layer thường (không phải group) trong tài liệu, từ trên xuống
function allLayers() {
    var r = new ActionReference();
    r.putProperty(c('Prpr'), c('NmbL'));
    r.putEnumerated(c('Dcmn'), c('Ordn'), c('Trgt'));
    var n = executeActionGet(r).getInteger(c('NmbL'));
    var list = [];
    for (var i = n; i >= 0; i--) {
        var d;
        try { var rr = new ActionReference(); rr.putIndex(c('Lyr '), i); d = executeActionGet(rr); } catch (e) { continue; }
        try {
            var sec = typeIDToStringID(d.getEnumerationValue(s('layerSection')));
            if (sec != 'layerSectionContent') continue;
        } catch (e2) { }
        list.push({ id: d.getInteger(s('layerID')), name: d.getString(c('Nm  ')) });
    }
    return list;
}
function isSmartObject(id) { try { return layerDesc(id).hasKey(s('smartObject')); } catch (e) { return false; } }

// Đọc 4 góc của Smart Object: [[x,y] x4] theo thứ tự TL, TR, BR, BL (nếu đọc được)
function readQuad(id) {
    try {
        var d = layerDesc(id);
        if (!d.hasKey(s('smartObjectMore'))) return null;
        var m = d.getObjectValue(s('smartObjectMore'));
        var keys = ['transform', 'nonAffineTransform'];
        for (var k = 0; k < keys.length; k++) {
            if (!m.hasKey(s(keys[k]))) continue;
            var l = m.getList(s(keys[k]));
            if (l.count < 8) continue;
            var q = [];
            for (var i = 0; i < 4; i++) q.push([l.getDouble(i * 2), l.getDouble(i * 2 + 1)]);
            return q;
        }
    } catch (e) { }
    return null;
}
function boundsOf(id) {
    var d = layerDesc(id), b = d.getObjectValue(d.hasKey(s('boundsNoEffects')) ? s('boundsNoEffects') : s('bounds'));
    var L = b.getUnitDoubleValue(s('left')), T = b.getUnitDoubleValue(s('top'));
    var R = b.getUnitDoubleValue(s('right')), B = b.getUnitDoubleValue(s('bottom'));
    return [[L, T], [R, T], [R, B], [L, B]];
}
function quadOrBounds(id) { return readQuad(id) || boundsOf(id); }
function bboxOf(q) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < q.length; i++) {
        x0 = Math.min(x0, q[i][0]); y0 = Math.min(y0, q[i][1]);
        x1 = Math.max(x1, q[i][0]); y1 = Math.max(y1, q[i][1]);
    }
    return { l: x0, t: y0, r: x1, b: y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function centerOf(q) {
    var x = 0, y = 0; for (var i = 0; i < 4; i++) { x += q[i][0]; y += q[i][1]; }
    return [x / 4, y / 4];
}

function convertToSmartObject() { executeAction(s('newPlacedLayer'), undefined, DialogModes.NO); }
// Đặt lại biến dạng của Smart Object (Layer > Smart Objects > Reset Transform, có từ PS 2020).
// ĐOÁN: tên lệnh chưa kiểm chứng trên máy thật, nên thử vài tên.
function resetTransform() {
    var ids = ['placedLayerResetTransforms', 'placedLayerResetTransform'];
    for (var i = 0; i < ids.length; i++) {
        try { executeAction(s(ids[i]), undefined, DialogModes.NO); return true; } catch (e) { }
        try {
            var d = new ActionDescriptor(); d.putReference(c('null'), refTarget());
            executeAction(s(ids[i]), d, DialogModes.NO); return true;
        } catch (e2) { }
    }
    return false;
}

// Biến dạng layer đang chọn: hình chữ nhật rect (4 góc thẳng) -> tứ giác quad (TL, TR, BR, BL)
function transformToQuad(rect, quad) {
    var d = new ActionDescriptor();
    d.putReference(c('null'), refTarget());
    d.putEnumerated(c('FTcs'), c('QCSt'), c('Qcsa'));
    var b = bboxOf(rect), lr = new ActionList();
    lr.putUnitDouble(c('#Pxl'), b.l); lr.putUnitDouble(c('#Pxl'), b.t);
    lr.putUnitDouble(c('#Pxl'), b.r); lr.putUnitDouble(c('#Pxl'), b.b);
    d.putList(s('rectangle'), lr);
    var lq = new ActionList();
    for (var i = 0; i < 4; i++) { lq.putUnitDouble(c('#Pxl'), quad[i][0]); lq.putUnitDouble(c('#Pxl'), quad[i][1]); }
    d.putList(s('quadrilateral'), lq);
    d.putEnumerated(c('Intr'), c('Intp'), c('Bcbc'));
    executeAction(c('Trnf'), d, DialogModes.NO);
}
// Cách dự phòng: tách ma trận thành Co giãn -> Xiên ngang -> Xoay (mỗi bước 1 lệnh Free Transform)
function freeTransform(opt) {
    var d = new ActionDescriptor();
    d.putReference(c('null'), refTarget());
    d.putEnumerated(c('FTcs'), c('QCSt'), c('Qcsa'));
    var o = new ActionDescriptor(); o.putUnitDouble(c('Hrzn'), c('#Pxl'), 0); o.putUnitDouble(c('Vrtc'), c('#Pxl'), 0);
    d.putObject(c('Ofst'), c('Ofst'), o);
    if (opt.w != null) d.putUnitDouble(c('Wdth'), c('#Prc'), opt.w);
    if (opt.h != null) d.putUnitDouble(c('Hght'), c('#Prc'), opt.h);
    if (opt.skew != null) {
        var k = new ActionDescriptor(); k.putUnitDouble(c('Hrzn'), c('#Ang'), opt.skew); k.putUnitDouble(c('Vrtc'), c('#Ang'), 0);
        d.putObject(c('Skew'), c('Pnt '), k);
    }
    if (opt.angle != null) d.putUnitDouble(c('Angl'), c('#Ang'), opt.angle);
    d.putEnumerated(c('Intr'), c('Intp'), c('Bcbc'));
    executeAction(c('Trnf'), d, DialogModes.NO);
}
function transformByDecomposition(M, skewSign, rotSign) {
    // M = R(theta) * [[sx, k*sy],[0, sy]]
    var a = M[0], b = M[1], cc = M[2], dd = M[3];
    var sx = Math.sqrt(a * a + cc * cc), th = Math.atan2(cc, a);
    var u12 = Math.cos(th) * b + Math.sin(th) * dd, sy = -Math.sin(th) * b + Math.cos(th) * dd;
    var k = u12 / sy;
    freeTransform({ w: sx * 100, h: sy * 100 });
    if (Math.abs(k) > 1e-6) freeTransform({ skew: skewSign * Math.atan(k) * 180 / Math.PI });
    if (Math.abs(th) > 1e-6) freeTransform({ angle: rotSign * th * 180 / Math.PI });
}
function moveActiveLayer(dx, dy) {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    app.activeDocument.activeLayer.translate(dx, dy);
}
// So 2 tứ giác, không phụ thuộc thứ tự góc
function quadsMatch(a, b) {
    var tol = Math.max(2, bboxOf(a).w * 0.01, bboxOf(a).h * 0.01);
    for (var i = 0; i < 4; i++) {
        var ok = false;
        for (var j = 0; j < 4; j++) if (Math.abs(a[i][0] - b[j][0]) < tol && Math.abs(a[i][1] - b[j][1]) < tol) { ok = true; break; }
        if (!ok) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Áp ma trận lên 1 layer. scaleMode: 'keep' (giữ tỉ lệ hiện tại) hoặc {w,h} (lấp đầy mặt kích thước w x h)
// target: [x,y] tâm đích (null = giữ tâm cũ). Trả về chuỗi cảnh báo ('' nếu ổn).
// ---------------------------------------------------------------------------
function applyFace(id, P, scaleMode, target) {
    selectLayerByID(id);
    var doc = app.activeDocument, warn = '';
    var lay = doc.activeLayer;
    if (lay.isBackgroundLayer) { lay.isBackgroundLayer = false; id = activeLayerID(); }

    var wasSO = isSmartObject(id);
    var before = quadOrBounds(id);
    var center = target || centerOf(before);
    var reset = false;
    if (!wasSO) { convertToSmartObject(); id = activeLayerID(); }
    else {
        reset = resetTransform();
        if (!reset) {
            // Không đặt lại được: nếu layer đang bị xiên/xoay thì bọc thêm 1 lớp Smart Object
            var qb = readQuad(id);
            if (qb && Math.abs(qb[0][1] - qb[1][1]) > 0.5) {
                convertToSmartObject(); id = activeLayerID();
                warn = 'Không đặt lại được biến dạng cũ, tool đã bọc thêm 1 lớp Smart Object (góc mới chồng lên góc cũ).';
            }
        }
    }
    var rect = quadOrBounds(id), rb = bboxOf(rect);
    var W = rb.w, H = rb.h;
    if (W < 1 || H < 1) throw new Error('Layer trống, không có điểm ảnh nào.');

    var sc = 1;
    if (scaleMode == 'keep') {
        if (wasSO && reset) {
            if (before.length == 4 && readQuad(id)) {
                sc = Math.max(len([before[1][0] - before[0][0], before[1][1] - before[0][1]]) / W,
                              len([before[3][0] - before[0][0], before[3][1] - before[0][1]]) / H);
            } else {
                var bb = bboxOf(before); sc = Math.max(bb.w / W, bb.h / H);
            }
            if (!(sc > 0.001) || sc > 100) sc = 1;
        }
    } else {
        sc = Math.max(scaleMode.w / W, scaleMode.h / H);
    }
    var M = [P[0] * sc, P[1] * sc, P[2] * sc, P[3] * sc];

    // Tứ giác đích
    var hw = W / 2, hh = H / 2, loc = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], quad = [];
    for (var i = 0; i < 4; i++) { var v = app2(M, loc[i][0], loc[i][1]); quad.push([center[0] + v[0], center[1] + v[1]]); }

    var canCheck = !!readQuad(id);
    var methods = [
        function () { transformToQuad(rect, quad); },
        function () { transformByDecomposition(M, 1, 1); },
        function () { transformByDecomposition(M, -1, 1); },
        function () { transformByDecomposition(M, 1, -1); },
        function () { transformByDecomposition(M, -1, -1); }
    ];
    var start = 0;
    try { var saved = app.getCustomOptions('XoayIsometric_method'); start = saved.getInteger(s('m')); } catch (e) { start = 0; }
    var order = [start]; for (var m = 0; m < methods.length; m++) if (m != start) order.push(m);

    var done = false, lastErr = '', applied = false;
    for (var t = 0; t < order.length && !done; t++) {
        if (applied) { if (!resetTransform()) break; applied = false; }
        try { methods[order[t]](); applied = true; } catch (e) { lastErr = e.message; continue; }
        // Đưa về đúng tâm
        var now = quadOrBounds(id), cn = centerOf(now);
        moveActiveLayer(center[0] - cn[0], center[1] - cn[1]);
        if (!canCheck) { done = true; break; }
        if (quadsMatch(readQuad(id), quad)) {
            done = true;
            if (order[t] != start) {
                try { var od = new ActionDescriptor(); od.putInteger(s('m'), order[t]); app.putCustomOptions('XoayIsometric_method', od, true); } catch (e2) { }
            }
        }
    }
    if (!done) warn += (warn ? '\n' : '') + 'Kết quả có thể chưa đúng góc' + (lastErr ? ' (' + lastErr + ')' : '') + '. Bạn chụp màn hình gửi lại giúp mình nhé.';
    return { id: id, warn: warn };
}

// Tạo mask hình tứ giác cho layer đang chọn
function maskToQuad(q) {
    var doc = app.activeDocument, cxy = centerOf(q), pts = [];
    for (var i = 0; i < 4; i++) { // nới 0,5 px để các mặt khít nhau, không hở đường trắng
        var dx = q[i][0] - cxy[0], dy = q[i][1] - cxy[1], L = len([dx, dy]) || 1;
        pts.push([q[i][0] + dx / L * 0.5, q[i][1] + dy / L * 0.5]);
    }
    doc.selection.select(pts, SelectionType.REPLACE, 0, true);
    try {
        var d = new ActionDescriptor(); d.putClass(c('Nw  '), c('Chnl'));
        var r = new ActionReference(); r.putEnumerated(c('Chnl'), c('Chnl'), c('Msk ')); d.putReference(c('At  '), r);
        d.putEnumerated(c('Usng'), c('UsrM'), c('RvlS'));
        executeAction(c('Mk  '), d, DialogModes.NO);
    } catch (e) { }
    doc.selection.deselect();
}

// ---------------------------------------------------------------------------
// Hai chức năng chính
// ---------------------------------------------------------------------------
function runFaces(opt) {
    var p = PRESETS[opt.preset], P = mul(faceMatrix(p, opt.face), rotLocal(opt.rot));
    var ids = selectedLayerIDs(), warns = [], newIds = [];
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (opt.keep) {
            selectLayerByID(id);
            var orig = app.activeDocument.activeLayer;
            var dup = orig.duplicate(orig, ElementPlacement.PLACEBEFORE);
            orig.visible = false;
            app.activeDocument.activeLayer = dup;
            id = activeLayerID();
        }
        var r = applyFace(id, P, 'keep', null);
        newIds.push(r.id);
        if (r.warn) warns.push(r.warn);
    }
    for (var j = 0; j < newIds.length; j++) selectLayerByID(newIds[j], j > 0);
    return warns;
}

function runCube(opt) {
    var p = PRESETS[opt.preset], A = axes(p), a = opt.a, b = opt.b, h = opt.h;
    var doc = app.activeDocument;
    // Đỉnh trước-dưới F = (0,0); các điểm còn lại
    function add() { var x = 0, y = 0; for (var i = 0; i < arguments.length; i++) { x += arguments[i][0]; y += arguments[i][1]; } return [x, y]; }
    function sc(v, k) { return [v[0] * k, v[1] * k]; }
    var F = [0, 0], La = sc(A.L, b), Ra = sc(A.R, a), Za = sc(A.Z, h);
    var Zt = Za;
    var faces = {
        top: { q: [add(Zt, La, Ra), add(Zt, Ra), Zt, add(Zt, La)], w: b, hh: a },
        left: { q: [add(La, Za), Za, F, La], w: b, hh: h },
        right: { q: [Za, add(Ra, Za), Ra, F], w: a, hh: h }
    };
    // Canh giữa khối trong tài liệu
    var all = [];
    for (var k in faces) for (var i = 0; i < 4; i++) all.push(faces[k].q[i]);
    var bb = bboxOf(all), off = [doc.width.as('px') / 2 - bb.cx, doc.height.as('px') / 2 - bb.cy];
    for (var k2 in faces) for (var j = 0; j < 4; j++) faces[k2].q[j] = add(faces[k2].q[j], off);

    var warns = [], ids = {};
    var orderF = ['right', 'left', 'top'];
    for (var n = 0; n < orderF.length; n++) {
        var f = orderF[n], fc = faces[f], lid = opt.layers[f];
        var P = faceMatrix(p, f);
        // Ma trận đơn vị không có độ dài trục -> kích thước "lấp đầy" tính trong toạ độ ảnh
        var r = applyFace(lid, P, { w: fc.w, h: fc.hh }, centerOf(fc.q));
        if (r.warn) warns.push(FACE_LABEL[f] + ': ' + r.warn);
        maskToQuad(fc.q);
        ids[f] = r.id;
    }
    // Gom vào 1 group
    selectLayerByID(ids.top);
    var set = doc.layerSets.add();
    set.name = 'Khối hộp - ' + p.name;
    for (var m = 0; m < orderF.length; m++) {
        selectLayerByID(ids[orderF[m]]);
        doc.activeLayer.move(set, ElementPlacement.INSIDE);
    }
    doc.activeLayer = set;
    return warns;
}

// ---------------------------------------------------------------------------
// Hộp thoại
// ---------------------------------------------------------------------------
function loadPrefs() {
    var o = { preset: 0, rot: 0, keep: false, a: 0, b: 0, h: 0 };
    try {
        var d = app.getCustomOptions('XoayIsometric_prefs');
        o.preset = d.getInteger(s('preset')); o.rot = d.getInteger(s('rot')); o.keep = d.getBoolean(s('keep'));
        o.a = d.getInteger(s('a')); o.b = d.getInteger(s('b')); o.h = d.getInteger(s('h'));
    } catch (e) { }
    if (o.preset < 0 || o.preset >= PRESETS.length) o.preset = 0;
    return o;
}
function savePrefs(o) {
    try {
        var d = new ActionDescriptor();
        d.putInteger(s('preset'), o.preset); d.putInteger(s('rot'), o.rot); d.putBoolean(s('keep'), o.keep);
        d.putInteger(s('a'), o.a); d.putInteger(s('b'), o.b); d.putInteger(s('h'), o.h);
        app.putCustomOptions('XoayIsometric_prefs', d, true);
    } catch (e) { }
}

function showDialog(prefs, layers, selIds) {
    var res = null;
    var w = new Window('dialog', 'Xoay ảnh Isometric  v' + TOOL_VERSION);
    w.orientation = 'column'; w.alignChildren = 'fill';

    var p1 = w.add('panel', undefined, '1. Kiểu hình chiếu');
    p1.alignChildren = 'fill';
    var g1 = p1.add('group'); g1.orientation = 'row'; g1.alignChildren = 'top';
    var left = g1.add('group'); left.orientation = 'column'; left.alignChildren = 'fill';
    var names = []; for (var i = 0; i < PRESETS.length; i++) names.push(PRESETS[i].name);
    var dd = left.add('dropdownlist', undefined, names); dd.selection = prefs.preset; dd.preferredSize.width = 290;
    var note = left.add('statictext', undefined, '', { multiline: true }); note.preferredSize = [290, 48];
    var pv = g1.add('panel'); pv.preferredSize = [170, 140];

    var p2 = w.add('panel', undefined, '2. Xoay layer đang chọn (bấm 1 lần)');
    p2.alignChildren = 'fill';
    var gb = p2.add('group'); gb.alignment = 'center';
    var bTop = gb.add('button', undefined, 'Mặt trên (sàn / mái)');
    var bLeft = gb.add('button', undefined, 'Mặt trái');
    var bRight = gb.add('button', undefined, 'Mặt phải');
    var g2 = p2.add('group');
    g2.add('statictext', undefined, 'Xoay ảnh trong mặt:');
    var ddRot = g2.add('dropdownlist', undefined, ['0°', '90°', '180°', '270°']); ddRot.selection = Math.round(prefs.rot / 90) % 4;
    var cbKeep = g2.add('checkbox', undefined, 'Giữ bản gốc (nhân bản rồi ẩn bản gốc)'); cbKeep.value = prefs.keep;
    p2.add('statictext', undefined, 'Chọn được nhiều layer cùng lúc. Bấm lại nút khác để đổi góc, không bị méo chồng.');

    var p3 = w.add('panel', undefined, '3. Dựng khối hộp từ 3 ảnh');
    p3.alignChildren = 'left';
    var lnames = []; for (var j = 0; j < layers.length; j++) lnames.push(layers[j].name);
    function pick(label, def) {
        var g = p3.add('group'); var t = g.add('statictext', undefined, label); t.preferredSize.width = 70;
        var d = g.add('dropdownlist', undefined, lnames); d.preferredSize.width = 330;
        for (var k = 0; k < layers.length; k++) if (layers[k].id == def) { d.selection = k; break; }
        if (!d.selection && layers.length) d.selection = 0;
        return d;
    }
    var ddT = pick('Mặt trên:', selIds[0]), ddL = pick('Mặt trái:', selIds[1]), ddR = pick('Mặt phải:', selIds[2]);
    var gs = p3.add('group');
    function num(label, v) { gs.add('statictext', undefined, label); var e = gs.add('edittext', undefined, String(v)); e.characters = 6; return e; }
    var eA = num('Dài (trục phải):', prefs.a), eB = num('Rộng (trục trái):', prefs.b), eH = num('Cao:', prefs.h);
    gs.add('statictext', undefined, 'px');
    var bCube = p3.add('button', undefined, 'Dựng khối hộp'); bCube.alignment = 'center';
    p3.add('statictext', undefined, 'Mẹo: chọn sẵn 3 layer (trên cùng = mặt trên, giữa = trái, dưới = phải) rồi mở tool.');

    var gEnd = w.add('group'); gEnd.alignment = 'right';
    gEnd.add('button', undefined, 'Đóng', { name: 'cancel' });

    function face() { return dd.selection ? dd.selection.index : 0; }
    function refresh() { note.text = PRESETS[face()].note; try { pv.hide(); pv.show(); } catch (e) { } }
    pv.onDraw = function () {
        try {
            var g = this.graphics, A = axes(PRESETS[face()]), sz = 45;
            var F = [0, 0], La = [A.L[0] * sz, A.L[1] * sz], Ra = [A.R[0] * sz, A.R[1] * sz], Za = [A.Z[0] * sz, A.Z[1] * sz];
            var P = function (a, b) { return [a[0] + b[0], a[1] + b[1]]; };
            var polys = [
                [[P(Za, P(La, Ra)), P(Za, Ra), Za, P(Za, La)], [0.85, 0.85, 0.85]],
                [[P(La, Za), Za, F, La], [0.55, 0.55, 0.55]],
                [[Za, P(Ra, Za), Ra, F], [0.35, 0.35, 0.35]]
            ];
            var all = []; for (var i = 0; i < polys.length; i++) all = all.concat(polys[i][0]);
            var bb = bboxOf(all), ox = this.size[0] / 2 - bb.cx, oy = this.size[1] / 2 - bb.cy;
            for (var k = 0; k < polys.length; k++) {
                var q = polys[k][0]; g.newPath(); g.moveTo(q[0][0] + ox, q[0][1] + oy);
                for (var m = 1; m < 4; m++) g.lineTo(q[m][0] + ox, q[m][1] + oy);
                g.closePath();
                var col = polys[k][1];
                g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [col[0], col[1], col[2], 1]));
                g.strokePath(g.newPen(g.PenType.SOLID_COLOR, [0.1, 0.1, 0.1, 1], 1));
            }
        } catch (e) { }
    };
    dd.onChange = refresh;
    refresh();

    function common() {
        return { preset: face(), rot: (ddRot.selection ? ddRot.selection.index : 0) * 90, keep: cbKeep.value,
                 a: parseInt(eA.text, 10) || 0, b: parseInt(eB.text, 10) || 0, h: parseInt(eH.text, 10) || 0 };
    }
    function go(f) { res = common(); res.mode = 'face'; res.face = f; w.close(1); }
    bTop.onClick = function () { go('top'); };
    bLeft.onClick = function () { go('left'); };
    bRight.onClick = function () { go('right'); };
    bCube.onClick = function () {
        var o = common();
        if (o.a < 1 || o.b < 1 || o.h < 1) { alert('Nhập kích thước khối (số px lớn hơn 0).'); return; }
        if (!ddT.selection || !ddL.selection || !ddR.selection) { alert('Chọn đủ 3 layer cho 3 mặt.'); return; }
        var t = layers[ddT.selection.index].id, l = layers[ddL.selection.index].id, r = layers[ddR.selection.index].id;
        if (t == l || t == r || l == r) { alert('3 mặt phải là 3 layer khác nhau.'); return; }
        res = o; res.mode = 'cube'; res.layers = { top: t, left: l, right: r }; w.close(1);
    };
    w.show();
    return res;
}

// ---------------------------------------------------------------------------
function main() {
    if (!app.documents.length) { alert('Hãy mở một file ảnh trước.'); return; }
    var doc = app.activeDocument;
    var prefs = loadPrefs();
    var def = Math.round(Math.min(doc.width.as('px'), doc.height.as('px')) * 0.3);
    if (!prefs.a) prefs.a = def; if (!prefs.b) prefs.b = def; if (!prefs.h) prefs.h = def;

    var layers = allLayers(), sel = selectedLayerIDs();
    var opt = showDialog(prefs, layers, sel);
    if (!opt) return;
    savePrefs(opt);

    var oldUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    var out = { warns: [], err: '' };
    $.global.__XI_OPT = opt; $.global.__XI_OUT = out;
    try {
        doc.suspendHistory(opt.mode == 'cube' ? 'Dựng khối hộp' : 'Xoay ' + FACE_LABEL[opt.face], '__XI_run()');
    } catch (e) { if (!out.err) out.err = e.message; }
    app.preferences.rulerUnits = oldUnits;
    if (out.err) alert('Có lỗi: ' + out.err + '\n\nBạn chụp màn hình gửi lại giúp mình nhé.');
    else if (out.warns.length) alert(out.warns.join('\n'));
}
function __XI_run() {
    var o = $.global.__XI_OPT, out = $.global.__XI_OUT;
    try { out.warns = (o.mode == 'cube') ? runCube(o) : runFaces(o); }
    catch (e) { out.err = e.message + (e.line ? ' (dòng ' + e.line + ')' : ''); }
}

main();
