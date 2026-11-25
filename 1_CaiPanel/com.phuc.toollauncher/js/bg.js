/* Tool Launcher – phần chạy ngầm.
   Bảng gửi sự kiện "chạy tool" rồi tự đóng; phần này chạy tool trong Photoshop,
   chạy xong thì mở lại bảng. */
(function () {
    'use strict';
    var cep = window.__adobe_cep__;
    if (!cep) return;
    var PANEL_ID = 'com.phuc.toollauncher.panel';

    function send(type, data) {
        cep.dispatchEvent({ type: type, scope: 'APPLICATION', appId: '', extensionId: 'com.phuc.toollauncher.bg', data: data || '' });
    }
    function dataOf(ev) {
        var d = ev && ev.data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) {} }
        return d || {};
    }

    // Bảng hỏi "có ai chạy ngầm không?" -> trả lời
    cep.addEventListener('com.phuc.toollauncher.ping', function () { send('com.phuc.toollauncher.pong'); });

    // Bắt tay 2 bước để tool không bao giờ chạy 2 lần:
    // bảng gửi "run" -> ở đây trả "ack" -> bảng gửi "go" rồi tự đóng -> mới chạy tool.
    var pending = {};
    cep.addEventListener('com.phuc.toollauncher.run', function (ev) {
        var d = dataOf(ev);
        if (!d.path || !d.id) return;
        pending[d.id] = d;
        send('com.phuc.toollauncher.ack', d.id);
    });
    cep.addEventListener('com.phuc.toollauncher.go', function (ev) {
        var id = ev && ev.data;
        if (typeof id !== 'string') { try { id = String(id); } catch (e) { return; } }
        var d = pending[id];
        if (!d) return;
        delete pending[id];
        var code = 'try{$.evalFile(new File(decodeURIComponent("' + encodeURIComponent(d.path) + '")));"OK"}catch(e){"ERR:"+(e.message||e)+(e.line?" (dòng "+e.line+")":"")}';
        // Chờ một chút cho bảng đóng hẳn rồi mới chạy tool
        setTimeout(function () {
            cep.evalScript(code, function (res) {
                if (res && res.indexOf('ERR:') === 0) {
                    cep.evalScript('alert(decodeURIComponent("' + encodeURIComponent('Lỗi khi chạy "' + (d.name || '') + '":\n' + res.slice(4)) + '"))');
                }
                if (d.reopen !== false) setTimeout(function () { cep.requestOpenExtension(PANEL_ID, ''); }, 150);
            });
        }, 250);
    });
    send('com.phuc.toollauncher.pong');
})();
