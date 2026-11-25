#target photoshop
/*
  @name: Xoay ảnh Isometric
  @group: Hình chiếu trục đo
  @desc: Biến ảnh phẳng thành mặt trên / mặt trái / mặt phải theo góc isometric, dimetric, 45°, 30/60, cavalier… (giữ Smart Object) và dựng khối hộp từ 3 ảnh.
  @version: 1.2.0
  @date: 2026-11-25

  XoayIsometric.jsx
  - Thẻ "Xoay 1 ảnh": chọn ảnh, chọn kiểu hình chiếu và mặt (trên / trái / phải). Có xem trước trực tiếp
    trên ảnh; "Xong" để giữ, "Hủy" để trả lại như cũ.
  - Layer được đổi thành Smart Object rồi mới biến dạng, nên nhấp đúp vẫn sửa/thay ảnh được.
    Bấm lại nút khác trên cùng layer: tool đặt lại biến dạng cũ rồi áp góc mới (không bị chồng méo).
  - "Dựng khối hộp": chọn 3 ảnh cho 3 mặt, nhập kích thước, tool tự cắt (mask) cho khít cạnh và gom vào 1 group.
  - Toàn bộ thao tác gom thành 1 bước History: Ctrl+Z một lần là hoàn tác.
  Dùng cho Photoshop 2021/2022 trở lên. CHƯA thử trên Photoshop thật.
*/

var TOOL_VERSION = '1.2.0';
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
        var w = 0, h = 0;
        try {
            var bo = d.getObjectValue(s('bounds'));
            w = bo.getUnitDoubleValue(s('right')) - bo.getUnitDoubleValue(s('left'));
            h = bo.getUnitDoubleValue(s('bottom')) - bo.getUnitDoubleValue(s('top'));
        } catch (e3) { }
        list.push({ id: d.getInteger(s('layerID')), name: d.getString(c('Nm  ')), w: w, h: h });
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
// Vị trí: luôn dùng khung bao (bounds) tính bằng px của Photoshop, vì 4 góc đọc từ Smart Object
// có thể khác đơn vị. 4 góc chỉ được dùng khi khớp với khung bao.
// ---------------------------------------------------------------------------
function boundsBox(id) { return bboxOf(boundsOf(id)); }
// Hệ số đổi đơn vị 4 góc -> px, tự dò khi layer đang ở trạng thái chưa biến dạng
var QCAL = null;
function calibrateQuad(id) {
    QCAL = null;
    var q = readQuad(id); if (!q) return;
    var qb = bboxOf(q), bb = boundsBox(id);
    if (qb.w < 1 || qb.h < 1) return;
    if (qb.l <= bb.l + 2 && qb.t <= bb.t + 2 && qb.r >= bb.r - 2 && qb.b >= bb.b - 2) { QCAL = { k: 1, ox: 0, oy: 0 }; return; }
    var kx = bb.w / qb.w, ky = bb.h / qb.h;
    if (Math.abs(kx - ky) / kx < 0.02) QCAL = { k: kx, ox: bb.l - qb.l * kx, oy: bb.t - qb.t * kx };
}
function validQuad(id, raw) {
    var q = raw || readQuad(id); if (!q || !QCAL) return null;
    var out = [];
    for (var i = 0; i < 4; i++) out.push([q[i][0] * QCAL.k + QCAL.ox, q[i][1] * QCAL.k + QCAL.oy]);
    return out;
}
function moveCenterTo(id, cx, cy) {
    var b = boundsBox(id);
    moveActiveLayer(cx - b.cx, cy - b.cy);
}

// ---------------------------------------------------------------------------
// Áp ma trận lên 1 layer. scaleMode: 'keep' (giữ tỉ lệ hiện tại) hoặc {w,h} (lấp đầy mặt kích thước w x h)
// target: [x,y] tâm đích (null = giữ tâm cũ). Trả về { id, warn }.
// ---------------------------------------------------------------------------
function applyFace(id, P, scaleMode, target) {
    selectLayerByID(id);
    var doc = app.activeDocument, warn = '';
    if (doc.activeLayer.isBackgroundLayer) { doc.activeLayer.isBackgroundLayer = false; id = activeLayerID(); }

    var wasSO = isSmartObject(id);
    var bBefore = boundsBox(id), qRawBefore = wasSO ? readQuad(id) : null;
    var center = target || [bBefore.cx, bBefore.cy];
    var reset = false;
    if (!wasSO) { convertToSmartObject(); id = activeLayerID(); }
    else {
        reset = resetTransform();
        if (!reset && qRawBefore && Math.abs(qRawBefore[0][1] - qRawBefore[1][1]) > 0.01) {
            convertToSmartObject(); id = activeLayerID();
            warn = 'Không đặt lại được biến dạng cũ, tool đã bọc thêm 1 lớp Smart Object.';
        }
    }
    calibrateQuad(id);
    var qBefore = qRawBefore ? validQuad(id, qRawBefore) : null;
    var q0 = validQuad(id), rect = q0 || boundsOf(id), rb = bboxOf(rect);
    var W = rb.w, H = rb.h;
    if (W < 1 || H < 1) throw new Error('Layer trống, không có điểm ảnh nào.');

    var sc = 1;
    if (scaleMode == 'keep') {
        if (wasSO && reset) {
            if (qBefore && q0) {
                sc = Math.max(len([qBefore[1][0] - qBefore[0][0], qBefore[1][1] - qBefore[0][1]]) / W,
                              len([qBefore[3][0] - qBefore[0][0], qBefore[3][1] - qBefore[0][1]]) / H);
            } else {
                var bn = boundsBox(id); sc = Math.max(bBefore.w / bn.w, bBefore.h / bn.h);
            }
            if (!(sc > 0.001) || sc > 100) sc = 1;
        }
    } else {
        // lấp đầy theo phần có điểm ảnh
        var bc = boundsBox(id);
        sc = Math.max(scaleMode.w / bc.w, scaleMode.h / bc.h);
    }
    var M = [P[0] * sc, P[1] * sc, P[2] * sc, P[3] * sc];

    // Tứ giác đích (đặt tạm quanh tâm khung chữ nhật hiện tại; vị trí sẽ chỉnh lại sau bằng bounds)
    var hw = W / 2, hh = H / 2, loc = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], quad = [];
    for (var i = 0; i < 4; i++) { var v = app2(M, loc[i][0], loc[i][1]); quad.push([rb.cx + v[0], rb.cy + v[1]]); }
    // Khung bao mong đợi của phần có điểm ảnh
    var bc0 = boundsBox(id), pts = [[bc0.l, bc0.t], [bc0.r, bc0.t], [bc0.r, bc0.b], [bc0.l, bc0.b]], expPts = [];
    for (var e = 0; e < 4; e++) { var w2 = app2(M, pts[e][0] - rb.cx, pts[e][1] - rb.cy); expPts.push(w2); }
    var expB = bboxOf(expPts);

    var methods = [
        function () { transformToQuad(rect, quad); },
        function () { transformByDecomposition(M, 1, 1); },
        function () { transformByDecomposition(M, -1, 1); },
        function () { transformByDecomposition(M, 1, -1); },
        function () { transformByDecomposition(M, -1, -1); }
    ];
    var start = 0;
    try { start = app.getCustomOptions('XoayIsometric_method2').getInteger(s('m')); } catch (e1) { start = 0; }
    if (start < 0 || start >= methods.length) start = 0;
    var order = [start]; for (var m = 0; m < methods.length; m++) if (m != start) order.push(m);

    function check() {
        var q = validQuad(id);
        if (q) {
            // so hình dạng (bỏ qua vị trí)
            var cq = centerOf(q), cE = centerOf(quad), a = [], b = [];
            for (var k = 0; k < 4; k++) { a.push([q[k][0] - cq[0], q[k][1] - cq[1]]); b.push([quad[k][0] - cE[0], quad[k][1] - cE[1]]); }
            return quadsMatch(b, a);
        }
        var nb = boundsBox(id);
        return Math.abs(nb.w - expB.w) <= Math.max(3, expB.w * 0.03) && Math.abs(nb.h - expB.h) <= Math.max(3, expB.h * 0.03);
    }

    var done = false, lastErr = '', applied = -1, firstOk = -1;
    for (var t = 0; t < order.length && !done; t++) {
        if (applied >= 0) { if (!resetTransform()) break; applied = -1; }
        try { methods[order[t]](); applied = order[t]; if (firstOk < 0) firstOk = order[t]; } catch (e2) { lastErr = e2.message; continue; }
        if (check()) {
            done = true;
            if (order[t] != start) { try { var od = new ActionDescriptor(); od.putInteger(s('m'), order[t]); app.putCustomOptions('XoayIsometric_method2', od, true); } catch (e3) { } }
        }
    }
    if (!done && applied != firstOk && firstOk >= 0 && resetTransform()) { try { methods[firstOk](); } catch (e4) { } }
    moveCenterTo(id, center[0], center[1]);
    if (!done) warn += (warn ? '\n' : '') + 'Có thể chưa đúng góc' + (lastErr ? ' (' + lastErr + ')' : '') + '. Bạn chụp màn hình gửi lại giúp mình nhé.';
    return { id: id, warn: warn };
}

// Tạo mask hình tứ giác cho layer đang chọn
function maskToQuad(q) {
    var doc = app.activeDocument, cxy = centerOf(q), pts = [];
    for (var i = 0; i < 4; i++) { // nới 0,5 px để các mặt khít nhau, không hở đường trắng
        var dx = q[i][0] - cxy[0], dy = q[i][1] - cxy[1], L = len([dx, dy]) || 1;
        pts.push([q[i][0] + dx / L * 0.5, q[i][1] + dy / L * 0.5]);
    }
    // Xoá mask cũ (nếu có) rồi tạo mask mới
    try {
        if (!layerDesc(activeLayerID()).hasKey(s('userMaskEnabled'))) throw 0;
        var dd = new ActionDescriptor(), rr = new ActionReference();
        rr.putEnumerated(c('Chnl'), c('Chnl'), c('Msk ')); dd.putReference(c('null'), rr);
        executeAction(c('Dlt '), dd, DialogModes.NO);
    } catch (e0) { }
    doc.selection.select(pts, SelectionType.REPLACE, 0, true);
    try {
        var d = new ActionDescriptor(); d.putClass(c('Nw  '), c('Chnl'));
        var r = new ActionReference(); r.putEnumerated(c('Chnl'), c('Chnl'), c('Msk ')); d.putReference(c('At  '), r);
        d.putEnumerated(c('Usng'), c('UsrM'), c('RvlS'));
        executeAction(c('Mk  '), d, DialogModes.NO);
    } catch (e) { }
    doc.selection.deselect();
}

// Gom các layer (theo ID) vào 1 group ngay tại chỗ (giữ trong artboard/group cũ), như Ctrl+G
function groupLayers(ids, name) {
    for (var i = 0; i < ids.length; i++) selectLayerByID(ids[i], i > 0);
    var d = new ActionDescriptor();
    var r = new ActionReference(); r.putClass(s('layerSection')); d.putReference(c('null'), r);
    var r2 = new ActionReference(); r2.putEnumerated(c('Lyr '), c('Ordn'), c('Trgt')); d.putReference(c('From'), r2);
    var d2 = new ActionDescriptor(); d2.putString(c('Nm  '), name); d.putObject(c('Usng'), s('layerSection'), d2);
    executeAction(c('Mk  '), d, DialogModes.NO);
}

// ---------------------------------------------------------------------------
// Hai chức năng chính
// ---------------------------------------------------------------------------
function runFace(opt) {
    var p = PRESETS[opt.preset], P = mul(faceMatrix(p, opt.face), rotLocal(opt.rot));
    var id = opt.layer;
    if (opt.keep) {
        selectLayerByID(id);
        var orig = app.activeDocument.activeLayer;
        var dup = orig.duplicate(orig, ElementPlacement.PLACEBEFORE);
        orig.visible = false;
        app.activeDocument.activeLayer = dup;
        id = activeLayerID();
    }
    var r = applyFace(id, P, 'keep', null);
    selectLayerByID(r.id);
    return r.warn ? [r.warn] : [];
}

function runCube(opt) {
    var p = PRESETS[opt.preset], A = axes(p), a = opt.a, b = opt.b, h = opt.h;
    function add() { var x = 0, y = 0; for (var i = 0; i < arguments.length; i++) { x += arguments[i][0]; y += arguments[i][1]; } return [x, y]; }
    function sc(v, k) { return [v[0] * k, v[1] * k]; }
    var F = [0, 0], La = sc(A.L, b), Ra = sc(A.R, a), Za = sc(A.Z, h);
    var faces = {
        top: { q: [add(Za, La, Ra), add(Za, Ra), Za, add(Za, La)], w: b, hh: a },
        left: { q: [add(La, Za), Za, F, La], w: b, hh: h },
        right: { q: [Za, add(Ra, Za), Ra, F], w: a, hh: h }
    };
    // Đặt khối ngay giữa vùng 3 ảnh gốc đang nằm
    var src = [];
    var keys = ['top', 'left', 'right'];
    for (var s0 = 0; s0 < 3; s0++) { var bb0 = boundsBox(opt.layers[keys[s0]]); src.push([bb0.l, bb0.t], [bb0.r, bb0.b]); }
    var sb = bboxOf(src);
    var all = [];
    for (var k = 0; k < 3; k++) for (var i = 0; i < 4; i++) all.push(faces[keys[k]].q[i]);
    var bb = bboxOf(all), off = [sb.cx - bb.cx, sb.cy - bb.cy];
    for (var k2 = 0; k2 < 3; k2++) for (var j = 0; j < 4; j++) faces[keys[k2]].q[j] = add(faces[keys[k2]].q[j], off);

    var warns = [], ids = [];
    var orderF = ['top', 'left', 'right'];
    for (var n = 0; n < orderF.length; n++) {
        var f = orderF[n], fc = faces[f];
        var r = applyFace(opt.layers[f], faceMatrix(p, f), { w: fc.w, h: fc.hh }, centerOf(fc.q));
        if (r.warn) warns.push(FACE_LABEL[f] + ': ' + r.warn);
        maskToQuad(fc.q);
        ids.push(r.id);
    }
    try { groupLayers(ids, 'Khối hộp - ' + p.name); } catch (e) { warns.push('Không gom được group: ' + e.message); }
    return warns;
}

// ---------------------------------------------------------------------------
// Hộp thoại (có xem trước trực tiếp trên ảnh)
// ---------------------------------------------------------------------------
function loadPrefs() {
    var o = { preset: 0, rot: 0, keep: false, a: 0, b: 0, h: 0, live: true, face: 'left', pct: 100 };
    try {
        var d = app.getCustomOptions('XoayIsometric_prefs');
        o.preset = d.getInteger(s('preset')); o.rot = d.getInteger(s('rot')); o.keep = d.getBoolean(s('keep'));
        o.a = d.getInteger(s('a')); o.b = d.getInteger(s('b')); o.h = d.getInteger(s('h'));
        if (d.hasKey(s('live'))) o.live = d.getBoolean(s('live'));
        if (d.hasKey(s('face'))) o.face = d.getString(s('face'));
        if (d.hasKey(s('pct'))) o.pct = d.getInteger(s('pct'));
        if (!(o.pct >= 10 && o.pct <= 200)) o.pct = 100;
    } catch (e) { }
    if (o.preset < 0 || o.preset >= PRESETS.length) o.preset = 0;
    return o;
}
function savePrefs(o) {
    try {
        var d = new ActionDescriptor();
        d.putInteger(s('preset'), o.preset); d.putInteger(s('rot'), o.rot); d.putBoolean(s('keep'), o.keep);
        d.putInteger(s('a'), o.a); d.putInteger(s('b'), o.b); d.putInteger(s('h'), o.h);
        d.putBoolean(s('live'), o.live); d.putString(s('face'), o.face || 'left'); d.putInteger(s('pct'), o.pct || 100);
        app.putCustomOptions('XoayIsometric_prefs', d, true);
    } catch (e) { }
}

// Chạy 1 thao tác thành 1 bước History. Trả về { warns, err }
function runOp(opt) {
    var out = { warns: [], err: '' };
    $.global.__XI_OPT = opt; $.global.__XI_OUT = out;
    var title = opt.mode == 'cube' ? 'Dựng khối hộp' : 'Xoay ' + FACE_LABEL[opt.face];
    try { app.activeDocument.suspendHistory(title, '__XI_run()'); }
    catch (e) { if (!out.err) out.err = e.message; }
    return out;
}
function __XI_run() {
    var o = $.global.__XI_OPT, out = $.global.__XI_OUT;
    try { out.warns = (o.mode == 'cube') ? runCube(o) : runFace(o); }
    catch (e) { out.err = e.message + (e.line ? ' (dòng ' + e.line + ')' : ''); }
}

function showDialog(prefs, layers, selIds) {
    var doc = app.activeDocument;
    var startState = doc.activeHistoryState;
    var previewed = false, lastKey = '';

    var w = new Window('dialog', 'Xoay ảnh Isometric  v' + TOOL_VERSION);
    w.orientation = 'column'; w.alignChildren = 'fill';

    // --- Kiểu góc + hình minh hoạ
    var p1 = w.add('panel', undefined, 'Kiểu hình chiếu');
    var g1 = p1.add('group'); g1.orientation = 'row'; g1.alignChildren = 'top';
    var gl = g1.add('group'); gl.orientation = 'column'; gl.alignChildren = 'fill';
    var names = []; for (var i = 0; i < PRESETS.length; i++) names.push((i + 1) + '. ' + PRESETS[i].name);
    var dd = gl.add('dropdownlist', undefined, names); dd.selection = prefs.preset; dd.preferredSize.width = 300;
    var note = gl.add('statictext', undefined, '', { multiline: true }); note.preferredSize = [300, 50];
    var pv = g1.add('panel'); pv.preferredSize = [160, 140];

    // --- 2 thẻ
    var tabs = w.add('tabbedpanel');
    var t1 = tabs.add('tab', undefined, 'Xoay 1 ảnh');
    var t2 = tabs.add('tab', undefined, 'Dựng khối hộp từ 3 ảnh');
    t1.alignChildren = 'left'; t2.alignChildren = 'left';

    var lnames = []; for (var j = 0; j < layers.length; j++) lnames.push(layers[j].name);
    function layerPicker(parent, label, def) {
        var g = parent.add('group'); var t = g.add('statictext', undefined, label); t.preferredSize.width = 75;
        var d = g.add('dropdownlist', undefined, lnames); d.preferredSize.width = 340;
        for (var k = 0; k < layers.length; k++) if (layers[k].id == def) { d.selection = k; break; }
        if (!d.selection && layers.length) d.selection = 0;
        return d;
    }

    // Thẻ 1: xoay 1 ảnh
    var ddOne = layerPicker(t1, 'Ảnh cần xoay:', selIds[0]);
    var gf = t1.add('group'); gf.add('statictext', undefined, 'Đặt thành:');
    var rTop = gf.add('radiobutton', undefined, 'Mặt trên (sàn / mái)');
    var rLeft = gf.add('radiobutton', undefined, 'Mặt trái');
    var rRight = gf.add('radiobutton', undefined, 'Mặt phải');
    (prefs.face == 'top' ? rTop : prefs.face == 'right' ? rRight : rLeft).value = true;
    var g2 = t1.add('group');
    g2.add('statictext', undefined, 'Xoay ảnh trong mặt:');
    var ddRot = g2.add('dropdownlist', undefined, ['0°', '90°', '180°', '270°']); ddRot.selection = Math.round(prefs.rot / 90) % 4;
    var cbKeep = g2.add('checkbox', undefined, 'Giữ bản gốc (nhân bản rồi ẩn bản gốc)'); cbKeep.value = prefs.keep;
    t1.add('statictext', undefined, 'Chỉ ảnh đã chọn ở trên bị xoay, các layer khác giữ nguyên.');

    // Thẻ 2: khối hộp
    var ddT = layerPicker(t2, 'Mặt trên:', selIds[0]);
    var ddL = layerPicker(t2, 'Mặt trái:', selIds[1] || selIds[0]);
    var ddR = layerPicker(t2, 'Mặt phải:', selIds[2] || selIds[0]);
    var gs = t2.add('group');
    function num(label, v) { gs.add('statictext', undefined, label); var e = gs.add('edittext', undefined, String(v)); e.characters = 6; return e; }
    var eA = num('Dài (trục phải):', 0), eB = num('Rộng (trục trái):', 0), eH = num('Cao:', 0);
    gs.add('statictext', undefined, 'px');
    var gz = t2.add('group');
    gz.add('statictext', undefined, 'Độ lớn khối:');
    var sl = gz.add('slider', undefined, prefs.pct, 10, 200); sl.preferredSize.width = 230;
    var tPct = gz.add('statictext', undefined, prefs.pct + '%'); tPct.preferredSize.width = 45;
    var bAuto = gz.add('button', undefined, 'Về 100%');
    t2.add('statictext', undefined, '100% = khối rộng bằng trung bình 3 ảnh gốc. Kéo thanh trượt để thu / phóng, hoặc gõ số px.');
    t2.add('statictext', undefined, 'Khối được dựng ngay chỗ 3 ảnh đang nằm, rồi gom vào 1 group tại chỗ.');
    t2.add('statictext', undefined, 'Mẹo: chọn sẵn 3 layer (trên cùng = mặt trên, giữa = trái, dưới = phải) rồi mở tool.');

    tabs.selection = (prefs.tab == 1) ? t2 : t1;

    // Kích thước khối tự tính theo 3 ảnh gốc (đo lúc mở hộp thoại, trước khi xem trước)
    function autoEdge() {
        var ws = 0, n = 0, picks = [ddT, ddL, ddR];
        for (var i = 0; i < 3; i++) if (picks[i].selection) { var L = layers[picks[i].selection.index]; if (L.w > 0) { ws += L.w; n++; } }
        if (!n) return 500;
        var A = axes(PRESETS[presetIdx()]), pts = [[0, 0], A.L, A.R, A.Z,
            [A.L[0] + A.Z[0], A.L[1] + A.Z[1]], [A.R[0] + A.Z[0], A.R[1] + A.Z[1]],
            [A.L[0] + A.R[0] + A.Z[0], A.L[1] + A.R[1] + A.Z[1]]];
        var unitW = bboxOf(pts).w || 1;
        return (ws / n) / unitW;
    }
    function sizeFromSlider() {
        var pct = Math.round(sl.value); tPct.text = pct + '%';
        var e = Math.max(1, Math.round(autoEdge() * pct / 100));
        eA.text = eB.text = eH.text = String(e);
    }
    sizeFromSlider();

    // --- Xem trước + nút
    var gp = w.add('group'); gp.alignment = 'fill';
    var cbLive = gp.add('checkbox', undefined, 'Xem trước trực tiếp trên ảnh'); cbLive.value = prefs.live;
    var bPrev = gp.add('button', undefined, 'Xem trước');
    var status = w.add('statictext', undefined, ' ', { multiline: true }); status.preferredSize = [460, 34];
    var gEnd = w.add('group'); gEnd.alignment = 'right';
    var bOK = gEnd.add('button', undefined, 'Xong', { name: 'ok' });
    var bCancel = gEnd.add('button', undefined, 'Hủy', { name: 'cancel' });

    function presetIdx() { return dd.selection ? dd.selection.index : 0; }
    function curFace() { return rTop.value ? 'top' : rRight.value ? 'right' : 'left'; }
    function isCube() { return tabs.selection == t2; }
    function collect() {
        var o = { preset: presetIdx(), rot: (ddRot.selection ? ddRot.selection.index : 0) * 90, keep: cbKeep.value,
                  a: parseInt(eA.text, 10) || 0, b: parseInt(eB.text, 10) || 0, h: parseInt(eH.text, 10) || 0,
                  live: cbLive.value, face: curFace(), tab: isCube() ? 1 : 0, pct: Math.round(sl.value) };
        if (isCube()) {
            o.mode = 'cube';
            if (o.a < 1 || o.b < 1 || o.h < 1) return { bad: 'Nhập kích thước khối (số px lớn hơn 0).' };
            if (!ddT.selection || !ddL.selection || !ddR.selection) return { bad: 'Chọn đủ 3 layer cho 3 mặt.' };
            o.layers = { top: layers[ddT.selection.index].id, left: layers[ddL.selection.index].id, right: layers[ddR.selection.index].id };
            if (o.layers.top == o.layers.left || o.layers.top == o.layers.right || o.layers.left == o.layers.right)
                return { bad: '3 mặt phải là 3 layer khác nhau.' };
        } else {
            o.mode = 'face';
            if (!ddOne.selection) return { bad: 'Chọn ảnh cần xoay.' };
            o.layer = layers[ddOne.selection.index].id;
        }
        return o;
    }
    function keyOf(o) { return [o.mode, o.preset, o.rot, o.keep, o.a, o.b, o.h, o.face, o.layer, o.layers ? o.layers.top + '-' + o.layers.left + '-' + o.layers.right : ''].join('|'); }
    function revert() {
        if (!previewed) return;
        try { doc.activeHistoryState = startState; } catch (e) { }
        previewed = false; lastKey = '';
    }
    function preview(force) {
        var o = collect();
        if (o.bad) { status.text = o.bad; return null; }
        var k = keyOf(o);
        if (!force && previewed && k == lastKey) return o;
        revert();
        status.text = 'Đang xoay…';
        var out = runOp(o);
        previewed = true; lastKey = k;
        try { app.refresh(); } catch (e) { }
        status.text = out.err ? 'Lỗi: ' + out.err : (out.warns.length ? out.warns.join(' ') : 'Đang xem trước. Bấm "Xong" để giữ, "Hủy" để trả lại như cũ.');
        o.out = out;
        return o;
    }
    function changed() { refreshDrawing(); if (cbLive.value) preview(false); }

    function refreshDrawing() { note.text = PRESETS[presetIdx()].note; try { pv.hide(); pv.show(); } catch (e) { } }
    pv.onDraw = function () {
        try {
            var g = this.graphics, A = axes(PRESETS[presetIdx()]), sz = 45;
            var F = [0, 0], La = [A.L[0] * sz, A.L[1] * sz], Ra = [A.R[0] * sz, A.R[1] * sz], Za = [A.Z[0] * sz, A.Z[1] * sz];
            var P = function (a, b) { return [a[0] + b[0], a[1] + b[1]]; };
            var hl = isCube() ? '' : curFace();
            var polys = [
                ['top', [P(Za, P(La, Ra)), P(Za, Ra), Za, P(Za, La)], [0.85, 0.85, 0.85]],
                ['left', [P(La, Za), Za, F, La], [0.55, 0.55, 0.55]],
                ['right', [Za, P(Ra, Za), Ra, F], [0.35, 0.35, 0.35]]
            ];
            var all = []; for (var i = 0; i < polys.length; i++) all = all.concat(polys[i][1]);
            var bb = bboxOf(all), ox = this.size[0] / 2 - bb.cx, oy = this.size[1] / 2 - bb.cy;
            for (var k = 0; k < polys.length; k++) {
                var q = polys[k][1]; g.newPath(); g.moveTo(q[0][0] + ox, q[0][1] + oy);
                for (var m = 1; m < 4; m++) g.lineTo(q[m][0] + ox, q[m][1] + oy);
                g.closePath();
                var col = polys[k][0] == hl ? [0.95, 0.55, 0.15] : polys[k][2];
                g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [col[0], col[1], col[2], 1]));
                g.strokePath(g.newPen(g.PenType.SOLID_COLOR, [0.1, 0.1, 0.1, 1], 1));
            }
        } catch (e) { }
    };

    dd.onChange = function () { sizeFromSlider(); changed(); }; ddRot.onChange = changed; cbKeep.onClick = changed;
    rTop.onClick = changed; rLeft.onClick = changed; rRight.onClick = changed;
    ddOne.onChange = changed;
    var sizeChanged = function () { sizeFromSlider(); changed(); };
    ddT.onChange = sizeChanged; ddL.onChange = sizeChanged; ddR.onChange = sizeChanged;
    sl.onChanging = function () { sizeFromSlider(); };
    sl.onChange = sizeChanged;
    bAuto.onClick = function () { sl.value = 100; sizeChanged(); };
    eA.onChange = changed; eB.onChange = changed; eH.onChange = changed;
    tabs.onChange = function () { revert(); status.text = ' '; changed(); };
    cbLive.onClick = function () { if (cbLive.value) preview(false); else { revert(); try { app.refresh(); } catch (e) { } status.text = ' '; } };
    bPrev.onClick = function () { preview(false); };

    var result = null;
    bOK.onClick = function () {
        var o = preview(false);   // nếu đã xem trước đúng thiết lập này thì giữ luôn, không làm lại
        if (!o) return;
        result = o; w.close(1);
    };
    bCancel.onClick = function () { revert(); w.close(2); };
    w.onClose = function () { if (!result) revert(); };

    w.onShow = function () { refreshDrawing(); if (cbLive.value) preview(false); };
    w.show();
    return result;
}

// ---------------------------------------------------------------------------
function main() {
    if (!app.documents.length) { alert('Hãy mở một file ảnh trước.'); return; }
    var doc = app.activeDocument;
    var oldUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    try {
        var prefs = loadPrefs();
        var layers = allLayers(), sel = selectedLayerIDs();
        if (!layers.length) { alert('Tài liệu chưa có layer ảnh nào.'); return; }
        // Kích thước khối mặc định: theo ảnh đang chọn (cạnh ngắn), nếu chưa có thì 30% khổ giấy
        prefs.tab = sel.length >= 3 ? 1 : 0;

        var opt = showDialog(prefs, layers, sel);
        if (!opt) return;
        savePrefs(opt);
        var out = opt.out;
        if (out && out.err) alert('Có lỗi: ' + out.err + '\n\nBạn chụp màn hình gửi lại giúp mình nhé.');
        else if (out && out.warns.length) alert(out.warns.join('\n'));
    } finally {
        app.preferences.rulerUnits = oldUnits;
    }
}

main();
