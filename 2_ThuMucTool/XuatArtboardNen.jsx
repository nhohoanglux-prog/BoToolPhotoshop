#target photoshop
/*
  @name: Xuất artboard nén theo dung lượng
  @group: Xuất file
  @desc: Xuất tất cả artboard theo thứ tự trang ra PDF, JPG hoặc PNG, tự nén cho tổng dung lượng vừa giới hạn MB.
  @version: 1.1.0
  @date: 2026-11-25

  XuatArtboardNen.jsx
  - Lấy tất cả artboard trong file đang mở, sắp theo thứ tự trang
    (theo vị trí trên canvas: trên xuống dưới, trái sang phải, giống DanhSoArtboard.jsx;
     hoặc theo tên "Trang 01, 02...").
  - Định dạng: PDF (gộp 1 file), JPG hoặc PNG (mỗi trang 1 file).
  - Giới hạn MB tính cho TỔNG dung lượng tất cả file xuất ra.
      PDF/JPG: hạ chất lượng JPEG trước, rồi hạ độ phân giải.
      PNG: PNG không mất dữ liệu nên chỉ hạ độ phân giải.
  - Trang đơn hoặc trang đôi (2 artboard ghép cạnh nhau thành 1 trang / 1 ảnh).
  - Không đụng vào file gốc: mọi thao tác làm trên bản sao, xong thì đóng bản sao.
  Dùng cho Photoshop 2021/2022 trở lên.
*/

var c = function (x) { return charIDToTypeID(x); };
var s = function (x) { return stringIDToTypeID(x); };

// ---------- Lấy danh sách artboard ----------
function getArtboards(skipHidden) {
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
        if (skipHidden && d.hasKey(c('Vsbl')) && !d.getBoolean(c('Vsbl'))) continue;
        var rect = d.getObjectValue(s('artboard')).getObjectValue(s('artboardRect'));
        var top = rect.getDouble(s('top')), left = rect.getDouble(s('left'));
        var bottom = rect.getDouble(s('bottom')), right = rect.getDouble(s('right'));
        list.push({ name: d.getString(c('Nm  ')), top: top, left: left, h: bottom - top, w: right - left });
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
        for (var m = 0; m < rows[k].length; m++) out.push(rows[k][m]);
    }
    return out;
}

// So sánh tên tự nhiên: "Trang 2" đứng trước "Trang 10"
function sortByName(list) {
    function key(str) {
        var parts = String(str).toLowerCase().match(/(\d+|\D+)/g) || [];
        return parts;
    }
    return list.slice().sort(function (a, b) {
        var x = key(a.name), y = key(b.name);
        for (var i = 0; i < Math.min(x.length, y.length); i++) {
            var nx = /^\d/.test(x[i]), ny = /^\d/.test(y[i]);
            if (nx && ny) { var d = parseInt(x[i], 10) - parseInt(y[i], 10); if (d) return d; }
            else if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
        }
        return x.length - y.length;
    });
}

// ---------- Hộp thoại ----------
var FMT_NAMES = ['PDF', 'JPG', 'PNG'];

function showDialog(total, docName, docFolder) {
    var w = new Window('dialog', 'Xuất artboard nén theo dung lượng');
    w.alignChildren = 'fill';
    w.add('statictext', undefined, 'Tìm thấy ' + total + ' artboard.');

    var p0 = w.add('panel', undefined, 'Định dạng xuất');
    p0.alignChildren = 'left';
    var fmt = p0.add('dropdownlist', undefined, [
        'PDF (gộp tất cả thành 1 file)',
        'JPG (mỗi trang 1 file)',
        'PNG (mỗi trang 1 file, không nén mất dữ liệu)'
    ]);
    fmt.selection = 0;

    var p1 = w.add('panel', undefined, 'Thứ tự và cách ghép trang');
    p1.alignChildren = 'left';
    var g0 = p1.add('group'); g0.add('statictext', undefined, 'Sắp thứ tự:');
    var order = g0.add('dropdownlist', undefined, ['Theo vị trí (trên xuống, trái sang)', 'Theo tên (Trang 01, 02...)']);
    order.selection = 0;
    var g1 = p1.add('group'); g1.add('statictext', undefined, 'Kiểu trang:');
    var layout = g1.add('dropdownlist', undefined, [
        'Trang đơn (mỗi artboard 1 trang)',
        'Trang đôi (1-2, 3-4, ...)',
        'Trang đôi, trang 1 là bìa đứng riêng (1, 2-3, 4-5, ...)'
    ]);
    layout.selection = 0;
    var skipHidden = p1.add('checkbox', undefined, 'Bỏ qua artboard đang ẩn');
    skipHidden.value = true;

    var p2 = w.add('panel', undefined, 'Dung lượng và chất lượng');
    p2.alignChildren = 'left';
    var g2 = p2.add('group'); g2.add('statictext', undefined, 'Tổng dung lượng tối đa (MB, 0 = không giới hạn):');
    var maxMB = g2.add('edittext', undefined, '20'); maxMB.characters = 6;
    var g3 = p2.add('group'); g3.add('statictext', undefined, 'Độ phân giải cao nhất (DPI):');
    var dpi = g3.add('edittext', undefined, '300'); dpi.characters = 6;
    var g4 = p2.add('group'); var qLbl = g4.add('statictext', undefined, 'Chất lượng JPEG bắt đầu (1-12):');
    var q = g4.add('edittext', undefined, '10'); q.characters = 4;
    var g5 = p2.add('group'); g5.add('statictext', undefined, 'Không hạ dưới (DPI):');
    var minDpi = g5.add('edittext', undefined, '72'); minDpi.characters = 6;
    var note = p2.add('statictext', undefined, '', { multiline: true });
    note.preferredSize = [420, 34];

    var p3 = w.add('panel', undefined, 'Lưu vào');
    p3.alignChildren = 'fill';
    var pdfFile = new File(docFolder + '/' + docName + '.pdf');
    var imgFolder = new Folder(docFolder + '/' + docName + '_xuat');
    var g6 = p3.add('group');
    var outTxt = g6.add('statictext', undefined, ''); outTxt.characters = 45;
    var browse = g6.add('button', undefined, 'Chọn...');

    function refresh() {
        var f = fmt.selection.index;
        q.enabled = qLbl.enabled = (f !== 2);
        note.text = f === 2
            ? 'PNG không mất dữ liệu nên script chỉ hạ độ phân giải cho tới khi tổng dung lượng vừa giới hạn.'
            : 'Script hạ chất lượng JPEG trước, rồi hạ DPI cho tới khi tổng dung lượng vừa giới hạn.';
        outTxt.text = f === 0 ? pdfFile.fsName : imgFolder.fsName + '  (thư mục)';
    }
    fmt.onChange = refresh;
    browse.onClick = function () {
        if (fmt.selection.index === 0) {
            var f = pdfFile.saveDlg('Lưu PDF thành', 'PDF:*.pdf');
            if (f) { if (!/\.pdf$/i.test(f.name)) f = new File(f.fsName + '.pdf'); pdfFile = f; }
        } else {
            var d = Folder.selectDialog('Chọn thư mục lưu ảnh');
            if (d) imgFolder = d;
        }
        refresh();
    };
    refresh();

    var b = w.add('group'); b.alignment = 'fill';
    var bestQ = false;
    var best = b.add('button', undefined, 'Chất lượng cao nhất');
    best.helpTip = 'Xuất ngay ở 300 DPI, chất lượng JPEG 12. Bỏ qua ô DPI và chất lượng.\n' +
                   'Nếu có nhập giới hạn MB thì vẫn tự nén khi vượt giới hạn.';
    best.onClick = function () { bestQ = true; w.close(1); };
    var sp = b.add('group'); sp.alignment = ['fill', 'center'];
    b.add('button', undefined, 'Hủy', { name: 'cancel' });
    b.add('button', undefined, 'Xuất', { name: 'ok' });

    if (w.show() !== 1) return null;
    if (bestQ) { dpi.text = '300'; q.text = '12'; }
    return {
        best: bestQ,
        fmt: fmt.selection.index,           // 0 PDF, 1 JPG, 2 PNG
        byName: order.selection.index === 1,
        layout: layout.selection.index,
        skipHidden: skipHidden.value,
        maxBytes: Math.max(0, parseFloat(String(maxMB.text).replace(',', '.')) || 0) * 1000000,
        dpi: Math.max(30, parseInt(dpi.text, 10) || 150),
        q: Math.min(12, Math.max(1, parseInt(q.text, 10) || 10)),
        minDpi: Math.max(30, parseInt(minDpi.text, 10) || 72),
        pdfFile: pdfFile,
        imgFolder: imgFolder,
        baseName: docName
    };
}

// ---------- Thanh tiến trình ----------
var PROG;
function progOpen() {
    PROG = new Window('palette', 'Đang xuất...');
    PROG.alignChildren = 'fill';
    PROG.msg = PROG.add('statictext', undefined, 'Chuẩn bị...'); PROG.msg.characters = 55;
    PROG.bar = PROG.add('progressbar', undefined, 0, 100); PROG.bar.preferredSize.width = 380;
    PROG.show();
}
function prog(msg, pct) {
    if (!PROG) return;
    PROG.msg.text = msg; PROG.bar.value = pct;
    PROG.update(); try { app.refresh(); } catch (e) {}
}

// ---------- Ghi PDF (nhúng JPEG trực tiếp, không nén lại lần nữa) ----------
function readBinary(f) {
    f.encoding = 'BINARY'; f.open('r'); var d = f.read(); f.close(); return d;
}
function pad10(n) { var x = String(n); while (x.length < 10) x = '0' + x; return x; }
function num(n) { return (Math.round(n * 100) / 100).toString(); }

// pdfPages: [{ wPt, hPt, items: [{ img, x, y, w, h }] }], imgs: [{ file, pxW, pxH }]
function writePDF(outFile, pdfPages, imgs) {
    var out = new File(outFile.fsName);
    out.encoding = 'BINARY';
    if (!out.open('w')) throw new Error('Không ghi được file: ' + out.fsName);
    var pos = 0, offsets = [];
    function w(str) { out.write(str); pos += str.length; }

    var nImg = imgs.length, nPg = pdfPages.length;
    // Đánh số object: 1 Catalog, 2 Pages, 3..(2+nImg) ảnh, sau đó mỗi trang 2 object (Page, Content)
    var imgObj = function (i) { return 3 + i; };
    var pageObj = function (p) { return 3 + nImg + p * 2; };
    var contObj = function (p) { return 4 + nImg + p * 2; };
    var total = 2 + nImg + nPg * 2;

    w('%PDF-1.4\n%' + String.fromCharCode(226, 227, 207, 211) + '\n');

    offsets[1] = pos; w('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    var kids = [];
    for (var p = 0; p < nPg; p++) kids.push(pageObj(p) + ' 0 R');
    offsets[2] = pos; w('2 0 obj\n<< /Type /Pages /Count ' + nPg + ' /Kids [' + kids.join(' ') + '] >>\nendobj\n');

    for (var i = 0; i < nImg; i++) {
        var data = readBinary(imgs[i].file);
        offsets[imgObj(i)] = pos;
        w(imgObj(i) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgs[i].pxW +
          ' /Height ' + imgs[i].pxH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
          ' /Filter /DCTDecode /Length ' + data.length + ' >>\nstream\n');
        w(data); data = null;
        w('\nendstream\nendobj\n');
    }

    for (var q = 0; q < nPg; q++) {
        var pg = pdfPages[q], res = [], cs = '';
        for (var k = 0; k < pg.items.length; k++) {
            var it = pg.items[k];
            res.push('/Im' + it.img + ' ' + imgObj(it.img) + ' 0 R');
            cs += 'q ' + num(it.w) + ' 0 0 ' + num(it.h) + ' ' + num(it.x) + ' ' + num(it.y) + ' cm /Im' + it.img + ' Do Q\n';
        }
        offsets[pageObj(q)] = pos;
        w(pageObj(q) + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(pg.wPt) + ' ' + num(pg.hPt) +
          '] /Resources << /XObject << ' + res.join(' ') + ' >> >> /Contents ' + contObj(q) + ' 0 R >>\nendobj\n');
        offsets[contObj(q)] = pos;
        w(contObj(q) + ' 0 obj\n<< /Length ' + cs.length + ' >>\nstream\n' + cs + 'endstream\nendobj\n');
    }

    var xref = pos;
    w('xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n');
    for (var n = 1; n <= total; n++) w(pad10(offsets[n]) + ' 00000 n \n');
    w('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    out.close();
    return new File(out.fsName).length;
}

// Ghép artboard thành trang PDF (đơn vị: point, 1 inch = 72 pt)
function buildPages(order, layout, docRes) {
    var pages = [], i = 0;
    function pt(px) { return px / docRes * 72; }
    function single(idx) {
        var a = order[idx];
        return { wPt: pt(a.w), hPt: pt(a.h), items: [{ img: idx, x: 0, y: 0, w: pt(a.w), h: pt(a.h) }] };
    }
    function spread(l, r) {
        var A = order[l], B = order[r];
        var H = Math.max(pt(A.h), pt(B.h));
        return { wPt: pt(A.w) + pt(B.w), hPt: H, items: [
            { img: l, x: 0, y: H - pt(A.h), w: pt(A.w), h: pt(A.h) },
            { img: r, x: pt(A.w), y: H - pt(B.h), w: pt(B.w), h: pt(B.h) }
        ] };
    }
    if (layout === 2 && order.length) { pages.push(single(0)); i = 1; }
    if (layout === 0) { for (; i < order.length; i++) pages.push(single(i)); return pages; }
    for (; i < order.length; i += 2) {
        if (i + 1 < order.length) pages.push(spread(i, i + 1));
        else pages.push(single(i));
    }
    return pages;
}

// ---------- Kết xuất từng trang ----------
function pad2(n) { var x = String(n); while (x.length < 2) x = '0' + x; return x; }

// Khung cắt của 1 artboard, kẹp trong canvas
function artRect(a, W, H) {
    return {
        L: Math.max(0, Math.round(a.left)), T: Math.max(0, Math.round(a.top)),
        R: Math.min(W, Math.round(a.left + a.w)), B: Math.min(H, Math.round(a.top + a.h))
    };
}

function saveImage(d, file, fmt, q) {
    if (fmt === 2) {
        var po = new PNGSaveOptions();
        try { po.compression = 9; } catch (e) {}
        po.interlaced = false;
        d.saveAs(file, po, true, Extension.LOWERCASE);
    } else {
        var jo = new JPEGSaveOptions();
        jo.quality = q; jo.embedColorProfile = false;
        jo.formatOptions = FormatOptions.STANDARDBASELINE; jo.matte = MatteType.NONE;
        d.saveAs(file, jo, true, Extension.LOWERCASE);
    }
}

function scaleTo(d, curDpi, docRes) {
    var w = d.width.as('px'), h = d.height.as('px');
    var pw = Math.max(1, Math.round(w * curDpi / docRes));
    var ph = Math.max(1, Math.round(h * curDpi / docRes));
    if (pw < w) d.resizeImage(UnitValue(pw, 'px'), UnitValue(ph, 'px'), curDpi, ResampleMethod.BICUBIC);
}

// 1 artboard -> 1 ảnh: cắt thẳng trên bản sao đã gộp, lưu, quay lại lịch sử
function renderSingle(M, a, file, fmt, q, curDpi) {
    var r = artRect(a, M.W, M.H);
    M.doc.crop([UnitValue(r.L, 'px'), UnitValue(r.T, 'px'), UnitValue(r.R, 'px'), UnitValue(r.B, 'px')]);
    scaleTo(M.doc, curDpi, M.res);
    saveImage(M.doc, file, fmt, q);
    var out = { file: file, pxW: M.doc.width.as('px'), pxH: M.doc.height.as('px') };
    M.doc.activeHistoryState = M.base;
    return out;
}

// 2 artboard -> 1 ảnh trang đôi: dán cạnh nhau, canh trên, nền trắng
function renderSpread(M, a, b, file, fmt, q, curDpi) {
    var ra = artRect(a, M.W, M.H), rb = artRect(b, M.W, M.H);
    var wa = ra.R - ra.L, ha = ra.B - ra.T, wb = rb.R - rb.L, hb = rb.B - rb.T;
    var nd = app.documents.add(UnitValue(wa + wb, 'px'), UnitValue(Math.max(ha, hb), 'px'), M.res,
        'trang_doi_tam', NewDocumentMode.RGB, DocumentFill.WHITE);
    try { nd.colorProfileName = 'sRGB IEC61966-2.1'; } catch (e) {}
    var parts = [[ra, 0], [rb, wa]];
    for (var i = 0; i < 2; i++) {
        var r = parts[i][0];
        app.activeDocument = M.doc;
        M.doc.selection.select([[r.L, r.T], [r.R, r.T], [r.R, r.B], [r.L, r.B]]);
        M.doc.selection.copy();
        M.doc.selection.deselect();
        app.activeDocument = nd;
        var lay = nd.paste();
        var bd = lay.bounds;
        lay.translate(UnitValue(parts[i][1] - bd[0].as('px'), 'px'), UnitValue(0 - bd[1].as('px'), 'px'));
    }
    nd.flatten();
    scaleTo(nd, curDpi, M.res);
    saveImage(nd, file, fmt, q);
    var out = { file: file, pxW: nd.width.as('px'), pxH: nd.height.as('px') };
    nd.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = M.doc;
    return out;
}

// Một lần thử: kết xuất tất cả vào thư mục tạm, trả về tổng dung lượng
function renderAll(M, O, order, pages, tmp, curDpi, curQ, tries) {
    var files = [], total = 0, i, f;
    var old = tmp.getFiles(); for (i = 0; i < old.length; i++) try { old[i].remove(); } catch (e) {}
    var label = 'Lần thử ' + tries + ' (' + Math.round(curDpi) + ' DPI' + (O.fmt === 2 ? '' : ', chất lượng ' + curQ) + '): ';

    if (O.fmt === 0) {
        // PDF: mỗi artboard 1 ảnh JPEG, trang đôi được ghép ngay trong PDF
        var imgs = [];
        for (i = 0; i < order.length; i++) {
            prog(label + 'trang ' + (i + 1) + '/' + order.length, Math.round(i / order.length * 95));
            imgs.push(renderSingle(M, order[i], new File(tmp.fsName + '/p' + i + '.jpg'), 1, curQ, curDpi));
        }
        prog('Đang ghép PDF...', 97);
        f = new File(tmp.fsName + '/ketqua.pdf');
        total = writePDF(f, pages, imgs);
        return { total: total, files: [f] };
    }

    var ext = O.fmt === 2 ? '.png' : '.jpg';
    for (i = 0; i < pages.length; i++) {
        prog(label + 'ảnh ' + (i + 1) + '/' + pages.length, Math.round(i / pages.length * 95));
        var it = pages[i].items;
        f = new File(tmp.fsName + '/' + O.baseName + '_' + pad2(i + 1) + ext);
        if (it.length === 1) renderSingle(M, order[it[0].img], f, O.fmt, curQ, curDpi);
        else renderSpread(M, order[it[0].img], order[it[1].img], f, O.fmt, curQ, curDpi);
        f = new File(f.fsName);
        total += f.length;
        files.push(f);
    }
    return { total: total, files: files };
}

// ---------- Chạy ----------
(function main() {
    if (!app.documents.length) { alert('Chưa mở file nào.'); return; }
    var doc = app.activeDocument;
    var docName = doc.name.replace(/\.[^.]+$/, '');
    var folder = Folder.desktop.fsName;
    try { folder = doc.path.fsName; } catch (e) {}

    var all = getArtboards(false);
    if (!all.length) { alert('File này không có artboard nào.'); return; }
    var O = showDialog(all.length, docName, folder);
    if (!O) return;

    var arts = getArtboards(O.skipHidden);
    if (!arts.length) { alert('Không còn artboard nào để xuất (có thể tất cả đang ẩn).'); return; }
    var order = O.byName ? sortByName(arts) : sortByPosition(arts);
    var pages = buildPages(order, O.layout, doc.resolution);
    var ext = O.fmt === 2 ? '.png' : '.jpg';

    // Hỏi trước nếu sắp ghi đè file đã có
    var clash = [];
    if (O.fmt === 0) { if (O.pdfFile.exists) clash.push(O.pdfFile.name); }
    else for (var k = 0; k < pages.length; k++) {
        var ff = new File(O.imgFolder.fsName + '/' + O.baseName + '_' + pad2(k + 1) + ext);
        if (ff.exists) clash.push(ff.name);
    }
    if (clash.length && !confirm('Đã có ' + clash.length + ' file trùng tên (ví dụ ' + clash[0] + ').\nGhi đè lên?')) return;

    var oldUnits = app.preferences.rulerUnits, oldDlg = app.displayDialogs;
    app.preferences.rulerUnits = Units.PIXELS;
    app.displayDialogs = DialogModes.NO;

    var tmp = new Folder(Folder.temp.fsName + '/XuatArtboardNen_' + new Date().getTime());
    tmp.create();
    var M = null, result = null, err = null, saved = [];

    try {
        progOpen();
        prog('Đang tạo bản sao và gộp layer (có thể hơi lâu với file nặng)...', 2);
        var master = doc.duplicate(docName + '_tam_xuat');
        M = { doc: master, res: doc.resolution };
        master.flatten();
        if (master.mode !== DocumentMode.RGB) master.changeMode(ChangeMode.RGB);
        try { master.convertProfile('sRGB IEC61966-2.1', Intent.RELATIVECOLORIMETRIC, true, false); } catch (e) {}
        if (master.bitsPerChannel !== BitsPerChannelType.EIGHT) master.bitsPerChannel = BitsPerChannelType.EIGHT;
        M.base = master.activeHistoryState;
        M.W = master.width.as('px'); M.H = master.height.as('px');

        var curDpi = Math.min(O.dpi, M.res), curQ = O.q, tries = 0, ok = false, R = null, log = [];
        while (tries < 10) {
            tries++;
            R = renderAll(M, O, order, pages, tmp, curDpi, curQ, tries);
            log.push('Lần ' + tries + ': ' + Math.round(curDpi) + ' DPI' + (O.fmt === 2 ? '' : ', chất lượng ' + curQ) +
                     ' → ' + (R.total / 1000000).toFixed(2) + ' MB');
            if (!O.maxBytes || R.total <= O.maxBytes) { ok = true; break; }
            var ratio = O.maxBytes / R.total;
            if (O.fmt !== 2 && curQ > 8 && ratio > 0.6) {
                curQ = Math.max(8, curQ - 2);
            } else if (curDpi > O.minDpi) {
                curDpi = Math.max(O.minDpi, Math.floor(curDpi * Math.sqrt(ratio) * 0.95));
            } else if (O.fmt !== 2 && curQ > 4) {
                curQ = Math.max(4, curQ - 2);
            } else break;
        }

        // Chép kết quả từ thư mục tạm ra chỗ lưu
        prog('Đang lưu file...', 99);
        if (O.fmt === 0) {
            if (O.pdfFile.exists) O.pdfFile.remove();
            if (!R.files[0].copy(O.pdfFile.fsName)) throw new Error('Không chép được PDF tới ' + O.pdfFile.fsName);
            saved.push(O.pdfFile.fsName);
        } else {
            if (!O.imgFolder.exists) O.imgFolder.create();
            for (var j = 0; j < R.files.length; j++) {
                var dst = new File(O.imgFolder.fsName + '/' + R.files[j].name);
                if (dst.exists) dst.remove();
                if (!R.files[j].copy(dst.fsName)) throw new Error('Không chép được ' + R.files[j].name);
                saved.push(dst.fsName);
            }
        }
        result = { ok: ok, size: R.total, dpi: curDpi, q: curQ, log: log, count: pages.length };
    } catch (e) {
        err = e;
    } finally {
        if (M && M.doc) try { M.doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
        var fl = tmp.getFiles(); for (var f = 0; f < fl.length; f++) try { fl[f].remove(); } catch (e3) {}
        try { tmp.remove(); } catch (e4) {}
        if (PROG) try { PROG.close(); } catch (e5) {}
        app.preferences.rulerUnits = oldUnits;
        app.displayDialogs = oldDlg;
        try { app.activeDocument = doc; } catch (e6) {}
    }

    if (err) { alert('Có lỗi khi xuất:\n' + err + (err.line ? '\n(dòng ' + err.line + ')' : '')); return; }
    var where = O.fmt === 0 ? O.pdfFile.fsName : O.imgFolder.fsName;
    var msg = (result.ok ? 'Xong!' : 'Đã hạ tới mức thấp nhất cho phép mà vẫn chưa vừa giới hạn.') +
        (O.best ? '\nChế độ: Chất lượng cao nhất (300 DPI, chất lượng 12)' : '') +
        '\nĐịnh dạng: ' + FMT_NAMES[O.fmt] +
        '\nLưu tại: ' + where +
        '\n' + (O.fmt === 0 ? 'Số trang PDF: ' : 'Số ảnh: ') + result.count +
        '\nTổng dung lượng: ' + (result.size / 1000000).toFixed(2) + ' MB' +
        (O.maxBytes ? ' (giới hạn ' + (O.maxBytes / 1000000) + ' MB)' : '') +
        '\nThiết lập cuối: ' + Math.round(result.dpi) + ' DPI' + (O.fmt === 2 ? '' : ', chất lượng JPEG ' + result.q) +
        '\n\n' + result.log.join('\n');
    if (!result.ok) msg += '\n\nThử giảm "Không hạ dưới (DPI)", tăng giới hạn MB' + (O.fmt === 2 ? ', hoặc đổi sang JPG.' : '.');
    alert(msg);
})();
