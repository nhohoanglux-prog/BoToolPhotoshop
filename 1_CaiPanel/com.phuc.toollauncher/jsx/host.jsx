// host.jsx – phần chạy bên trong Photoshop (ExtendScript) cho panel Tool Launcher.
// Panel gọi các hàm TL_* dưới đây qua evalScript. Mọi đường dẫn được truyền vào
// dạng encodeURIComponent để không lỗi với dấu tiếng Việt hay dấu "\".

function TL_esc(s) {
    s = String(s);
    var out = '';
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i), code = s.charCodeAt(i);
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (code < 32) out += ' ';
        else out += ch;
    }
    return '"' + out + '"';
}

function TL_trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }

// Đọc phần đầu file để lấy @name / @group / @desc
function TL_readHeader(file) {
    var info = { name: '', group: '', desc: '', version: '', date: '', icon: '' };
    if (/\.jsxbin$/i.test(file.name)) return info; // file đã mã hóa, không đọc được chữ
    try {
        file.encoding = 'UTF-8';
        if (!file.open('r')) return info;
        var txt = file.read(4000);
        file.close();
        var m;
        m = txt.match(/@name\s*:\s*([^\r\n*]+)/i);  if (m) info.name = TL_trim(m[1]);
        m = txt.match(/@group\s*:\s*([^\r\n*]+)/i); if (m) info.group = TL_trim(m[1]);
        m = txt.match(/@desc\s*:\s*([^\r\n*]+)/i);  if (m) info.desc = TL_trim(m[1]);
        m = txt.match(/@version\s*:\s*([^\r\n*]+)/i); if (m) info.version = TL_trim(m[1]);
        m = txt.match(/@date\s*:\s*([^\r\n*]+)/i);    if (m) info.date = TL_trim(m[1]);
        m = txt.match(/@icon\s*:\s*([^\r\n*]+)/i);    if (m) info.icon = TL_trim(m[1]);
    } catch (e) { try { file.close(); } catch (e2) {} }
    return info;
}

function TL_scan(folder, depth, subGroup, list) {
    var items = folder.getFiles();
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var nm = decodeURI(it.name);
        if (nm.charAt(0) === '.' || nm.charAt(0) === '_') continue; // bỏ qua thư mục/tệp ẩn
        if (it instanceof Folder) {
            if (depth < 3) TL_scan(it, depth + 1, subGroup || nm, list);
        } else if (/\.(jsx|jsxbin)$/i.test(nm)) {
            var h = TL_readHeader(it);
            list.push({
                path: it.fsName,
                file: nm,
                name: h.name || nm.replace(/\.(jsx|jsxbin)$/i, ''),
                group: h.group || subGroup || 'Khác',
                desc: h.desc,
                version: h.version,
                date: h.date,
                icon: h.icon
            });
        }
    }
}

function TL_listTools(encPath) {
    try {
        var f = new Folder(decodeURIComponent(encPath));
        if (!f.exists) return '{"error":"Không tìm thấy thư mục"}';
        var list = [];
        TL_scan(f, 0, '', list);
        var parts = [];
        for (var i = 0; i < list.length; i++) {
            var t = list[i];
            parts.push('{"path":' + TL_esc(t.path) + ',"file":' + TL_esc(t.file) +
                ',"name":' + TL_esc(t.name) + ',"group":' + TL_esc(t.group) +
                ',"desc":' + TL_esc(t.desc) + ',"version":' + TL_esc(t.version) +
                ',"date":' + TL_esc(t.date) + ',"icon":' + TL_esc(t.icon) + '}');
        }
        return '{"tools":[' + parts.join(',') + ']}';
    } catch (e) {
        return '{"error":' + TL_esc(e.message || e) + '}';
    }
}

function TL_pickFolder() {
    var f = Folder.selectDialog('Chọn thư mục chứa các tool (.jsx)');
    return f ? f.fsName : '';
}

function TL_openFolder(encPath) {
    var f = new Folder(decodeURIComponent(encPath));
    if (f.exists) f.execute();
    return '';
}

function TL_runTool(encPath) {
    var f = new File(decodeURIComponent(encPath));
    if (!f.exists) return 'ERR:Không tìm thấy file ' + f.fsName;
    try {
        $.evalFile(f); // chạy ở phạm vi toàn cục, giống như File > Scripts > Browse
        return 'OK';
    } catch (e) {
        return 'ERR:' + (e.message || e) + (e.line ? ' (dòng ' + e.line + ')' : '');
    }
}

// ---- Dùng cho nút Cập nhật ----
// Ghi một file văn bản UTF-8, tự tạo thư mục còn thiếu.
function TL_writeFile(encPath, encContent) {
    try {
        var f = new File(decodeURIComponent(encPath));
        var parent = f.parent;
        if (!parent.exists) parent.create();
        f.encoding = 'UTF-8';
        f.lineFeed = 'Windows';
        if (!f.open('w')) return 'ERR:Không ghi được ' + f.fsName;
        var text = decodeURIComponent(encContent).replace(/\r\n/g, '\n');
        // .jsx cần BOM để Photoshop đọc đúng chữ có dấu
        if (/\.jsx$/i.test(f.name) && text.charCodeAt(0) !== 0xFEFF) text = '\uFEFF' + text;
        f.write(text);
        f.close();
        return 'OK';
    } catch (e) {
        return 'ERR:' + (e.message || e);
    }
}

// Nạp lại host.jsx sau khi panel được cập nhật
function TL_reloadHost(encPath) {
    try { $.evalFile(new File(decodeURIComponent(encPath))); return 'OK'; }
    catch (e) { return 'ERR:' + (e.message || e); }
}

// ---- Thanh Tool: lưu danh sách tool được ghim vào file chung cho 2 bảng ----
function TL_prefsFile() {
    var f = new Folder(Folder.userData.fsName + '/BoToolPhotoshop');
    if (!f.exists) f.create();
    return f.fsName + '/ThanhTool.json';
}
function TL_readText(encPath) {
    try {
        var f = new File(decodeURIComponent(encPath));
        if (!f.exists) return '';
        f.encoding = 'UTF-8';
        if (!f.open('r')) return '';
        var s = f.read(); f.close();
        return s;
    } catch (e) { return ''; }
}
