/* Tool Launcher – giao diện panel (chạy trong CEP của Photoshop) */
(function () {
    'use strict';

    // ===== Phiên bản panel – tăng số này mỗi lần sửa panel =====
    var PANEL_VERSION = '1.6.0';
    var PANEL_DATE = '2026-11-25';
    // Nơi lấy bản mới (kho GitHub công khai, cùng cấu trúc với file zip)
    var REPO = 'nhohoanglux-prog/BoToolPhotoshop';
    var UPDATE_BASE = 'https://raw.githubusercontent.com/' + REPO + '/main/';
    // Link "main/" bị GitHub giữ bản cũ tới ~5 phút. Hỏi GitHub API mã commit mới nhất
    // rồi tải theo đúng mã đó thì luôn có bản mới ngay. API lỗi/hết lượt thì quay về main/.
    var activeBase = UPDATE_BASE;

    var cep = window.__adobe_cep__;
    var KEY_FOLDER = 'tl.folder', KEY_RECENT = 'tl.recent', KEY_CLOSED = 'tl.closed';
    var KEY_SEEN = 'tl.seen', NEW_DAYS = 7, el_noHide = false;
    var tools = [], visible = [], selIndex = 0, busy = false, lastInfo = null, toolsLoaded = false, autoChecked = false, updateQueued = false, pendingHost = 0, busyTimer = null;

    var $ = function (id) { return document.getElementById(id); };
    var searchEl = $('search'), listEl = $('list'), statusEl = $('status');

    function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
    function loadJSON(k, def) { try { return JSON.parse(store(k)) || def; } catch (e) { return def; } }

    function evalHost(code, cb) {
        if (!cep) { if (window.TL_MOCK) return window.TL_MOCK(code, cb); return cb && cb(''); }
        // Khi Photoshop đang Transform / mở hộp thoại, lệnh sẽ phải xếp hàng chờ.
        // Sau 3 giây chưa có trả lời thì báo cho người dùng; lệnh vẫn tự chạy tiếp khi Photoshop rảnh.
        pendingHost++;
        if (!busyTimer) busyTimer = setTimeout(function () {
            busyTimer = null;
            if (pendingHost > 0) setStatus('⏳ Photoshop đang bận (đang Transform, đang vẽ hoặc đang mở hộp thoại). Bấm Enter hoặc Esc trong Photoshop để xong thao tác, panel sẽ tự chạy tiếp.', true);
        }, 3000);
        cep.evalScript(code, function (r) {
            pendingHost = Math.max(0, pendingHost - 1);
            if (!pendingHost && busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
            if (cb) cb(r);
        });
    }
    function call(fn, arg, cb) {
        var code = arg === undefined ? fn + '()' : fn + '("' + encodeURIComponent(arg) + '")';
        evalHost(code, cb);
    }

    function setStatus(msg, isErr) { statusEl.textContent = msg || ''; statusEl.className = isErr ? 'err' : ''; }

    // Bỏ dấu tiếng Việt để tìm "danh so" cũng ra "Đánh số"
    function fold(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    }
    function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // ---- Theme theo màu giao diện Photoshop ----
    function applyTheme() {
        try {
            var env = JSON.parse(cep.getHostEnvironment());
            var c = env.appSkinInfo.panelBackgroundColor.color;
            var r = Math.round(c.red), g = Math.round(c.green), b = Math.round(c.blue);
            document.documentElement.style.setProperty('--bg', 'rgb(' + r + ',' + g + ',' + b + ')');
            document.body.classList.toggle('light', (r + g + b) / 3 > 128);
        } catch (e) { /* giữ màu tối mặc định */ }
    }

    // ---- Nạp danh sách tool ----
    function reload() {
        var folder = store(KEY_FOLDER);
        if (!folder) { tools = []; render(); return; }
        setStatus('Đang quét thư mục…');
        call('TL_listTools', folder, function (res) {
            var data;
            try { data = JSON.parse(res); } catch (e) { data = { error: 'Không đọc được kết quả: ' + res }; }
            if (data.error) { tools = []; toolsLoaded = true; render(); setStatus(data.error + ' – ' + folder, true); afterScan(); return; }
            tools = data.tools || [];
            toolsLoaded = true;
            tools.sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); });
            tools.forEach(function (t) { t.key = fold(t.name + ' ' + t.desc + ' ' + t.group + ' ' + t.file); });
            markNewTools();
            render();
            setStatus(tools.length + ' tool · ' + folder);
            afterScan();
        });
    }

    // Sau khi quét xong: kiểm tra bản mới (lần đầu) hoặc chạy cập nhật đang chờ
    function afterScan() {
        if (updateQueued) { updateQueued = false; runUpdate(); return; }
        if (cep && !autoChecked) {
            autoChecked = true;
            checkUpdates(function (err, jobs) { if (!err && jobs.length) { markUpdate(true, jobs.length); if (newsEl.hidden) showPending(jobs); } });
        }
    }

    // ---- Ghim tool lên Thanh Tool (bảng icon thứ hai) ----
    // Danh sách ghim lưu ở file chung (Folder.userData/BoToolPhotoshop/ThanhTool.json) để Thanh Tool đọc được.
    var BAR_ID = 'com.phuc.toollauncher.bar', pins = [], prefsPath = '';
    function isPinned(t) { return pins.indexOf(t.file.toLowerCase()) >= 0; }
    function loadPins(cb) {
        if (!cep) { pins = loadJSON('tl.pins', []); return cb && cb(); }
        call('TL_prefsFile', undefined, function (p) {
            prefsPath = p;
            call('TL_readText', p, function (txt) {
                try { var d = JSON.parse(txt); pins = d.pins || []; } catch (e) { pins = []; }
                if (cb) cb();
            });
        });
    }
    function savePins() {
        var data = JSON.stringify({ folder: store(KEY_FOLDER) || '', pins: pins }, null, 1);
        if (!cep) { store('tl.pins', JSON.stringify(pins)); return; }
        if (!prefsPath) return;
        hostCall('TL_writeFile', [prefsPath, data], function () {
            cep.dispatchEvent({ type: 'com.phuc.toollauncher.pins', scope: 'APPLICATION', appId: '', extensionId: 'com.phuc.toollauncher.panel', data: '' });
        });
    }
    function togglePin(t) {
        var k = t.file.toLowerCase(), i = pins.indexOf(k);
        if (i >= 0) { pins.splice(i, 1); setStatus('Đã bỏ ghim: ' + t.name); }
        else { pins.push(k); setStatus('Đã ghim lên Thanh Tool: ' + t.name); openBar(); }
        savePins(); render();
    }
    function openBar() { if (cep) { try { cep.requestOpenExtension(BAR_ID, ''); } catch (e) {} } }

    var menuEl = null;
    function hideMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
    function showMenu(t, x, y) {
        hideMenu();
        menuEl = document.createElement('div');
        menuEl.className = 'ctx';
        var items = [
            { text: (isPinned(t) ? 'Bỏ ghim khỏi Thanh Tool' : 'Ghim lên Thanh Tool'), icon: isPinned(t) ? 'pin-off' : 'pin', fn: function () { togglePin(t); } },
            { text: 'Mở Thanh Tool', icon: 'panels-top-left', fn: openBar },
            { text: 'Chạy tool', icon: 'zap', fn: function () { runTool(t); } }
        ];
        items.forEach(function (it) {
            var b = document.createElement('div');
            b.className = 'ctxi';
            b.innerHTML = window.TL_iconSvg({ icon: it.icon }, 14) + '<span>' + esc(it.text) + '</span>';
            b.onclick = function () { hideMenu(); it.fn(); };
            menuEl.appendChild(b);
        });
        document.body.appendChild(menuEl);
        var w = menuEl.offsetWidth, h = menuEl.offsetHeight;
        menuEl.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 4)) + 'px';
        menuEl.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 4)) + 'px';
    }
    document.addEventListener('mousedown', function (e) { if (menuEl && !menuEl.contains(e.target)) hideMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideMenu(); });

    function pickFolder() {
        call('TL_pickFolder', undefined, function (p) {
            if (p) { store(KEY_FOLDER, p); savePins(); reload(); }
        });
    }

    // ---- Vẽ danh sách ----
    function highlight(text, words) {
        var html = esc(text);
        if (!words.length) return html;
        // tô màu phần khớp (so khớp trên chuỗi đã bỏ dấu, độ dài ký tự giữ nguyên)
        var f = text.split('').map(function (ch) { return fold(ch).charAt(0) || ' '; }).join(''), marks = new Array(text.length + 1).join('0').split('');
        words.forEach(function (w) { var i = f.indexOf(w); while (i >= 0 && w) { for (var k = i; k < i + w.length; k++) marks[k] = '1'; i = f.indexOf(w, i + w.length); } });
        var out = '', on = false;
        for (var i = 0; i < text.length; i++) {
            if (marks[i] === '1' && !on) { out += '<mark>'; on = true; }
            if (marks[i] !== '1' && on) { out += '</mark>'; on = false; }
            out += esc(text.charAt(i));
        }
        return out + (on ? '</mark>' : '');
    }

    function render() {
        var q = fold(searchEl.value).trim();
        var words = q ? q.split(/\s+/) : [];
        listEl.innerHTML = '';
        visible = [];

        if (!store(KEY_FOLDER)) {
            listEl.innerHTML = '<div class="empty">Chưa chọn thư mục tool.<br>Bấm <b>📁 Thư mục</b> và chọn thư mục bạn đã tạo để chứa các file .jsx.</div>';
            return;
        }
        var match = tools.filter(function (t) { return words.every(function (w) { return t.key.indexOf(w) >= 0; }); });
        if (!match.length) {
            listEl.innerHTML = '<div class="empty">' + (tools.length ? 'Không có tool nào khớp “' + esc(searchEl.value) + '”.' : 'Thư mục chưa có file .jsx nào.') + '</div>';
            return;
        }

        var groups = {}, order = [];
        // Nhóm "Dùng gần đây" khi không gõ tìm kiếm
        if (!words.length) {
            var recent = loadJSON(KEY_RECENT, []);
            var rec = recent.map(function (p) { return tools.filter(function (t) { return t.path === p; })[0]; }).filter(Boolean);
            if (rec.length) { groups['★ Dùng gần đây'] = rec; order.push('★ Dùng gần đây'); }
        }
        var names = [];
        match.forEach(function (t) { if (!groups[t.group]) { groups[t.group] = []; names.push(t.group); } groups[t.group].push(t); });
        names.sort(function (a, b) { if (a === 'Khác') return 1; if (b === 'Khác') return -1; return a.localeCompare(b, 'vi'); });
        order = order.concat(names);

        var closed = words.length ? {} : loadJSON(KEY_CLOSED, {});
        order.forEach(function (g) {
            var box = document.createElement('div');
            box.className = 'group' + (closed[g] ? ' closed' : '');
            var head = document.createElement('div');
            head.className = 'ghead';
            head.innerHTML = '<span><span class="arrow">' + (closed[g] ? '▸' : '▾') + '</span>' + esc(g) + '</span><span>' + groups[g].length + '</span>';
            head.onclick = function () {
                var c = loadJSON(KEY_CLOSED, {}); c[g] = !c[g]; store(KEY_CLOSED, JSON.stringify(c)); render();
            };
            box.appendChild(head);
            groups[g].forEach(function (t) {
                var el = document.createElement('div');
                el.className = 'tool';
                el.title = t.path;
                el.innerHTML = '<div class="ico">' + window.TL_iconSvg(t, 18) + '</div><div class="txt"><div class="name">' + highlight(t.name, words) + (t.isNew ? '<span class="badge" title="Tool mới hoặc vừa được cập nhật">MỚI</span>' : '') + '</div>' + (t.desc ? '<div class="desc">' + highlight(t.desc, words) + '</div>' : '') +
                    (t.version || t.date ? '<div class="ver">' + (t.version ? 'v' + esc(t.version) : '') + (t.version && t.date ? ' · ' : '') + (t.date ? 'cập nhật ' + esc(fmtDate(t.date)) : '') + '</div>' : '') + '</div>' +
                    (isPinned(t) ? '<div class="pinmark" title="Đã ghim lên Thanh Tool">' + window.TL_iconSvg({ icon: 'pin' }, 13) + '</div>' : '');
                el.onclick = function () { runTool(t, el); };
                el.oncontextmenu = function (e) { e.preventDefault(); showMenu(t, e.clientX, e.clientY); };
                if (!closed[g]) { el.dataset.idx = visible.length; visible.push({ t: t, el: el }); }
                box.appendChild(el);
            });
            listEl.appendChild(box);
        });
        selIndex = Math.min(selIndex, visible.length - 1);
        markSel();
    }

    function markSel() {
        visible.forEach(function (v, i) { v.el.classList.toggle('sel', i === selIndex && searchEl.value !== ''); });
        if (visible[selIndex] && searchEl.value) visible[selIndex].el.scrollIntoView({ block: 'nearest' });
    }

    // ---- Chạy tool ----
    // ---- Tự ẩn bảng khi chạy tool ----
    var BG_ID = 'com.phuc.toollauncher.bg', KEY_AUTOHIDE = 'tl.autoHide';
    function autoHideOn() { return store(KEY_AUTOHIDE) !== '0'; }
    function rememberRun(t) {
        clearNew(t);
        var recent = loadJSON(KEY_RECENT, []).filter(function (p) { return p !== t.path; });
        recent.unshift(t.path);
        store(KEY_RECENT, JSON.stringify(recent.slice(0, 5)));
    }
    // Gửi tool cho phần chạy ngầm rồi đóng bảng. Không thấy phần chạy ngầm trả lời
    // trong 1,2 giây (ví dụ chưa khởi động lại Photoshop) thì chạy ngay trong bảng như cũ.
    function runHidden(t, el, fallback) {
        var id = String(Date.now()), done = false;
        var onAck = function (ev) {
            var d = ev && ev.data;
            if (done || (d && String(d) !== id)) return;
            done = true;
            cep.dispatchEvent({ type: 'com.phuc.toollauncher.go', scope: 'APPLICATION', appId: '', extensionId: 'com.phuc.toollauncher.panel', data: id });
            rememberRun(t);
            setStatus('Đang chạy: ' + t.name + ' (bảng tự mở lại khi xong)');
            setTimeout(function () { cep.closeExtension(); }, 50);
        };
        cep.addEventListener('com.phuc.toollauncher.ack', onAck);
        cep.dispatchEvent({ type: 'com.phuc.toollauncher.run', scope: 'APPLICATION', appId: '', extensionId: 'com.phuc.toollauncher.panel',
            data: JSON.stringify({ id: id, path: t.path, name: t.name }) });
        setTimeout(function () {
            if (done) return;
            done = true;
            try { cep.removeEventListener('com.phuc.toollauncher.ack', onAck); } catch (e) {}
            fallback();
        }, 1200);
    }

    function runTool(t, el) {
        if (busy) return;
        if (cep && autoHideOn() && !el_noHide) {
            busy = true;
            setStatus('Đang mở: ' + t.name + '…');
            return runHidden(t, el, function () { busy = false; el_noHide = true; runTool(t, el); el_noHide = false; });
        }
        busy = true;
        if (el) el.classList.add('running');
        setStatus('Đang chạy: ' + t.name + '…');
        call('TL_runTool', t.path, function (res) {
            busy = false;
            if (el) el.classList.remove('running');
            if (res && res.indexOf('ERR:') === 0) { setStatus('Lỗi khi chạy “' + t.name + '”: ' + res.slice(4), true); return; }
            setStatus('Đã chạy xong: ' + t.name);
            rememberRun(t);
            render();
        });
    }

    // ---- Nhãn MỚI: tool mới thêm hoặc vừa đổi phiên bản, hiện 7 ngày hoặc tới khi chạy ----
    function markNewTools() {
        var seen = loadJSON(KEY_SEEN, null), first = !seen, now = Date.now();
        seen = seen || {};
        tools.forEach(function (t) {
            var k = t.file.toLowerCase(), s = seen[k];
            if (!s || s.v !== t.version) seen[k] = { v: t.version, until: first ? 0 : now + NEW_DAYS * 864e5 };
            t.isNew = seen[k].until > now;
        });
        store(KEY_SEEN, JSON.stringify(seen));
    }
    function clearNew(t) {
        var seen = loadJSON(KEY_SEEN, {}), k = t.file.toLowerCase();
        if (seen[k]) { seen[k].until = 0; store(KEY_SEEN, JSON.stringify(seen)); }
        t.isNew = false;
    }

    // ---- Khung "Có gì mới" ----
    var newsEl = $('news');
    function hideNews() { newsEl.hidden = true; newsEl.innerHTML = ''; }
    function showNews(title, items, buttons) {
        var html = '<div class="nt">' + esc(title) + '</div><ul>';
        items.forEach(function (it) {
            html += '<li>' + esc(it.label) + (it.notes ? '<br><span class="nn">' + esc(it.notes) + '</span>' : '') + '</li>';
        });
        html += '</ul><div class="nb"></div>';
        newsEl.innerHTML = html;
        var nb = newsEl.querySelector('.nb');
        buttons.forEach(function (b) {
            var el = document.createElement('button');
            el.textContent = b.text; if (b.primary) el.className = 'primary';
            el.onclick = b.onClick; nb.appendChild(el);
        });
        newsEl.hidden = false;
    }
    function showPending(jobs) {
        showNews('🔔 Có ' + jobs.length + ' bản mới', jobs, [
            { text: '⬇ Cập nhật ngay', primary: true, onClick: runUpdate },
            { text: 'Để sau', onClick: hideNews }
        ]);
    }
    function showChangelog() {
        var go = function (info) {
            var items = (info && info.news || []).map(function (n) { return { label: fmtDate(n.date) + ' · ' + n.text }; });
            if (!items.length) items = [{ label: 'Chưa có ghi chú cập nhật.' }];
            showNews('📋 Có gì mới gần đây', items, [{ text: 'Đóng', onClick: hideNews }]);
        };
        if (lastInfo) return go(lastInfo);
        setStatus('Đang tải ghi chú cập nhật…');
        resolveBase(function () { httpGet(activeBase + 'capnhat.json', function (err, txt) {
            setStatus(err ? 'Không tải được ghi chú: ' + err : '', !!err);
            try { lastInfo = JSON.parse(txt.replace(/^\uFEFF/, '')); } catch (e) {}
            go(lastInfo);
        }); });
    }

    // ---- Phiên bản & cập nhật ----
    function fmtDate(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (d || ''); }
    // so sánh "1.2.10" với "1.2.9": trả về >0 nếu a mới hơn b
    function cmpVer(a, b) {
        var x = String(a || '0').split('.'), y = String(b || '0').split('.');
        for (var i = 0; i < Math.max(x.length, y.length); i++) {
            var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
            if (d) return d;
        }
        return 0;
    }
    function baseName(p) { return String(p).split(/[\\/]/).pop().toLowerCase(); }

    function httpGet(url, cb) {
        var x = new XMLHttpRequest();
        x.open('GET', url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), true);
        x.overrideMimeType('text/plain; charset=utf-8');
        x.timeout = 20000;
        x.onload = function () { cb(x.status === 200 ? null : 'Lỗi ' + x.status + ' khi tải ' + url, x.responseText); };
        x.onerror = function () { cb('Không kết nối được mạng hoặc GitHub'); };
        x.ontimeout = function () { cb('Hết thời gian chờ khi tải ' + url); };
        x.send();
    }
    function resolveBase(cb) {
        httpGet('https://api.github.com/repos/' + REPO + '/commits/main', function (err, txt) {
            var sha = null;
            if (!err) { try { sha = JSON.parse(txt).sha; } catch (e) {} }
            activeBase = sha ? 'https://raw.githubusercontent.com/' + REPO + '/' + sha + '/' : UPDATE_BASE;
            cb();
        });
    }
    function hostCall(fn, args, cb) {
        evalHost(fn + '(' + args.map(function (a) { return '"' + encodeURIComponent(a) + '"'; }).join(',') + ')', cb);
    }
    function extensionPath() {
        var p = decodeURI(cep.getSystemPath('extension'));
        return p.replace(/^file:\/\/\/(?=[A-Za-z]:)/, '').replace(/^file:\/\//, '');
    }

    // Đọc capnhat.json, trả về danh sách việc cần làm
    function checkUpdates(cb) {
        resolveBase(function () { httpGet(activeBase + 'capnhat.json', function (err, txt) {
            if (err) return cb(/Lỗi 404/.test(err) ? 'Kho GitHub chưa có bản cập nhật nào.' : err);
            var info;
            try { info = JSON.parse(txt.replace(/^\uFEFF/, '')); } catch (e) { return cb('File capnhat.json bị lỗi'); }
            lastInfo = info;
            var jobs = [];
            if (info.panel && cmpVer(info.panel.version, PANEL_VERSION) > 0) {
                jobs.push({ kind: 'panel', label: 'Panel Tool Launcher v' + PANEL_VERSION + ' → v' + info.panel.version, files: info.panel.files || [], version: info.panel.version, notes: info.panel.notes || '' });
            }
            var folder = store(KEY_FOLDER);
            // Chưa quét xong thư mục thì chưa biết tool nào đã có, nên chưa so tool
            (toolsLoaded ? info.tools || [] : []).forEach(function (r) {
                var local = tools.filter(function (t) { return baseName(t.path) === baseName(r.path); })[0];
                if (local && cmpVer(r.version, local.version) <= 0) return;
                if (!local && !folder) return;
                jobs.push({
                    kind: 'tool', src: r.path,
                    dest: local ? local.path : folder + '\\' + r.path.replace(/\//g, '\\'),
                    label: (r.name || r.path) + (local ? ' v' + (local.version || '?') + ' → v' : ' (tool mới) v') + r.version,
                    notes: r.notes || ''
                });
            });
            cb(null, jobs, info);
        }); });
    }

    function runUpdate() {
        if (busy) return;
        if (!cep) { setStatus('Chỉ cập nhật được khi mở trong Photoshop.', true); return; }
        if (!toolsLoaded && store(KEY_FOLDER)) {
            updateQueued = true;
            setStatus('Đang chờ quét xong thư mục tool rồi mới cập nhật…');
            if (!pendingHost) reload();
            return;
        }
        busy = true;
        setStatus('Đang kiểm tra bản mới…');
        checkUpdates(function (err, jobs) {
            if (err) { busy = false; setStatus(err, true); return; }
            if (!jobs.length) { busy = false; markUpdate(false); hideNews(); setStatus('Bạn đang dùng bản mới nhất (panel v' + PANEL_VERSION + ').'); return; }
            hideNews();
            // 1) tải hết về trước, 2) rồi mới ghi đè (tránh hỏng giữa chừng)
            var downloads = [];
            jobs.forEach(function (j) {
                if (j.kind === 'tool') downloads.push({ url: activeBase + '2_ThuMucTool/' + j.src, dest: j.dest });
                else j.files.forEach(function (f) { downloads.push({ url: activeBase + '1_CaiPanel/com.phuc.toollauncher/' + f, dest: extensionPath() + '/' + f, panel: true }); });
            });
            var i = 0;
            (function next() {
                if (i >= downloads.length) return writeAll();
                setStatus('Đang tải ' + (i + 1) + '/' + downloads.length + '…');
                httpGet(downloads[i].url, function (e, txt) {
                    if (e) { busy = false; setStatus(e + '. Chưa thay đổi gì.', true); return; }
                    downloads[i].text = txt.replace(/^\uFEFF/, '');
                    i++; next();
                });
            })();
            function writeAll() {
                var k = 0, panelChanged = false;
                (function w() {
                    if (k >= downloads.length) return done();
                    var d = downloads[k];
                    hostCall('TL_writeFile', [d.dest, d.text], function (r) {
                        if (r && r.indexOf('ERR:') === 0) { busy = false; setStatus('Lỗi khi ghi file: ' + r.slice(4), true); return; }
                        if (d.panel) panelChanged = true;
                        k++; w();
                    });
                })();
                function done() {
                    busy = false;
                    markUpdate(false);
                    var msg = 'Đã cập nhật ' + jobs.length + ' mục.';
                    store('tl.lastUpdate', JSON.stringify(jobs.map(function (j) { return { label: j.label, notes: j.notes }; })));
                    store('tl.lastUpdateMsg', msg);
                    if (panelChanged) {
                        hostCall('TL_reloadHost', [extensionPath() + '/jsx/host.jsx'], function () { location.reload(); });
                    } else { reload(); setTimeout(function () { setStatus(msg); showJustUpdated(); }, 600); }
                }
            }
        });
    }

    function showJustUpdated() {
        var items = loadJSON('tl.lastUpdate', null);
        try { localStorage.removeItem('tl.lastUpdate'); } catch (e) {}
        if (items && items.length) showNews('✓ Vừa cập nhật xong', items, [{ text: 'Đóng', onClick: hideNews }]);
    }

    function markUpdate(on, n) {
        var b = $('btnUpdate');
        b.classList.toggle('has-update', !!on);
        b.textContent = on ? '⬇ ' + n + ' bản mới' : '⬇ Cập nhật';
        b.title = on ? 'Có ' + n + ' bản mới. Bấm để cập nhật ngay.' : 'Tải bản mới của panel và các tool';
    }

    // ---- Sự kiện ----
    searchEl.addEventListener('input', function () { selIndex = 0; render(); });
    searchEl.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { selIndex = Math.min(selIndex + 1, visible.length - 1); markSel(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { selIndex = Math.max(selIndex - 1, 0); markSel(); e.preventDefault(); }
        else if (e.key === 'Enter') { var v = visible[selIndex]; if (v) runTool(v.t, v.el); }
        else if (e.key === 'Escape') { searchEl.value = ''; render(); }
    });
    $('btnFolder').onclick = pickFolder;
    $('btnReload').onclick = reload;
    $('btnUpdate').onclick = runUpdate;
    $('btnOpen').onclick = function () { var f = store(KEY_FOLDER); if (f) call('TL_openFolder', f); else pickFolder(); };

    if (cep) applyTheme();
    $('ver').innerHTML = 'Tool Launcher v' + PANEL_VERSION + ' · ' + fmtDate(PANEL_DATE) + ' · <a id="lnkNews">Có gì mới ›</a>';
    $('lnkNews').onclick = showChangelog;
    var chk = $('chkHide');
    chk.checked = autoHideOn();
    chk.onchange = function () { store(KEY_AUTOHIDE, chk.checked ? '1' : '0'); setStatus(chk.checked ? 'Bấm tool thì bảng tự ẩn, chạy xong tự hiện lại.' : 'Bảng sẽ không tự ẩn khi chạy tool.'); };
    // Đánh thức phần chạy ngầm (nếu Photoshop chưa tự bật)
    if (cep) { try { cep.requestOpenExtension(BG_ID, ''); } catch (e) {} }
    loadPins(function () { render(); });
    reload();
    // Thông báo sau khi panel vừa tự cập nhật và tải lại
    // Lần đầu mở một phiên bản panel mới: tự hiện "Có gì mới"
    if (cep && store('tl.panelSeen') !== PANEL_VERSION) {
        var firstRun = !store(KEY_FOLDER); // cài mới tinh thì không cần hiện
        store('tl.panelSeen', PANEL_VERSION);
        if (!firstRun) setTimeout(function () { if (newsEl.hidden) showChangelog(); }, 1200);
    }
    var last = store('tl.lastUpdateMsg');
    if (last) { try { localStorage.removeItem('tl.lastUpdateMsg'); } catch (e) {} setTimeout(function () { setStatus(last); showJustUpdated(); }, 900); }
    // Kiểm tra bản mới chạy trong afterScan() sau khi quét xong thư mục
    if (cep && !store(KEY_FOLDER)) afterScan();
    // Tự quét lại khi mở lại panel (để thấy tool mới thêm)
    document.addEventListener('visibilitychange', function () { if (!document.hidden) reload(); });
    setTimeout(function () { searchEl.focus(); }, 300);
})();
