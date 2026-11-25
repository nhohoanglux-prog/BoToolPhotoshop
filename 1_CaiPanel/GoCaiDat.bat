@echo off
chcp 65001 >nul
echo  Gỡ panel Tool Launcher (tắt Photoshop trước).
pause
rmdir /s /q "%APPDATA%\Adobe\CEP\extensions\com.phuc.toollauncher"
echo  Đã gỡ xong.
pause
