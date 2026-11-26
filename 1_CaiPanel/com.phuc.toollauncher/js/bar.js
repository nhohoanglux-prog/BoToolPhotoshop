/* Thanh Tool – bảng chỉ có icon của các tool đã ghim.
   Ghim/bỏ ghim trong bảng Tool Launcher (chuột phải vào tool).
   Bảng hẹp + cao thì icon xếp dọc, rộng + thấp thì xếp ngang. */
(function () {
    'use strict';
    var cep = window.__adobe_cep__;
    var barEl = document.getElementById('bar');
    var LAUNCHER_ID = 'com.phuc.toollauncher.panel';
    var busy = false;

    function evalHost(code, cb) {
        if (!cep) { if (window.TL_MOCK) return window.TL_MOCK(code, cb); return cb && cb(''); }
        cep.evalScript(code, function (r) { if (cb) cb(r); });
    }
    function call(fn, arg, cb) { evalHost(arg === undefined ? fn + '()' : fn + '("' + encodeURIComponent(arg) + '")', cb); }
    function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function applyTheme() {
        try {
            var c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
            var r = Math.round(c.red), g = Math.round(c.green), b = Math.round(c.blue);
            document.documentElement.style.setProperty('--bg', 'rgb(' + r + ',' + g + ',' + b + ')');
            document.body.classList.toggle('light', (r + g + b) / 3 > 128);
        } catch (e) {}
    }
    function layout() { document.body.classList.toggle('h', window.innerWidth > window.innerHeight); }
    window.addEventListener('resize', layout);

    function openLauncher() { if (cep) { try { cep.requestOpenExtension(LAUNCHER_ID, ''); } catch (e) {} } }

    function load() {
        call('TL_prefsFile', undefined, function (p) {
            call('TL_readText', p, function (txt) {
                var d = {};
                try { d = JSON.parse(txt) || {}; } catch (e) {}
                var pins = d.pins || [];
                if (!d.folder || !pins.length) return render([]);
                call('TL_listTools', d.folder, function (res) {
                    var tools = [];
                    try { tools = JSON.parse(res).tools || []; } catch (e) {}
                    var list = pins.map(function (k) { return tools.filter(function (t) { return t.file.toLowerCase() === k; })[0]; }).filter(Boolean);
                    render(list);
                });
            });
        });
    }

    function render(list) {
        barEl.innerHTML = '';
        if (!list.length) {
            var e = document.createElement('div');
            e.className = 'b empty';
            e.title = 'Chưa ghim tool nào.\nMở Tool Launcher, bấm chuột phải vào tool → "Ghim lên Thanh Tool".';
            e.innerHTML = window.TL_iconSvg({ icon: 'pin' }, 18);
            e.onclick = openLauncher;
            barEl.appendChild(e);
            return;
        }
        list.forEach(function (t) {
            var b = document.createElement('div');
            b.className = 'b';
            b.title = t.name + (t.desc ? '\n' + t.desc : '') + (t.version ? '\nv' + t.version : '') + '\n(Chuột phải: mở Tool Launcher)';
            b.innerHTML = window.TL_iconSvg(t, 20);
            b.onclick = function () { run(t, b); };
            b.oncontextmenu = function (e) { e.preventDefault(); openLauncher(); };
            barEl.appendChild(b);
        });
    }

    function run(t, b) {
        if (busy) return;
        busy = true; b.classList.add('busy');
        call('TL_runTool', t.path, function (res) {
            busy = false; b.classList.remove('busy');
            if (res && res.indexOf('ERR:') === 0) {
                evalHost('alert(decodeURIComponent("' + encodeURIComponent('Lỗi khi chạy "' + t.name + '":\n' + res.slice(4)) + '"))');
            }
        });
    }

    if (cep) {
        applyTheme();
        cep.addEventListener('com.phuc.toollauncher.pins', load);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
    }
    layout();
    load();
})();
