@echo off
chcp 65001 >nul
title Cài đặt Tool Launcher cho Photoshop
echo.
echo  === CÀI ĐẶT PANEL TOOL LAUNCHER CHO PHOTOSHOP ===
echo.
echo  Hãy TẮT Photoshop trước khi tiếp tục.
pause

set "SRC=%~dp0com.phuc.toollauncher"
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.phuc.toollauncher"

if not exist "%SRC%\CSXS\manifest.xml" (
  echo  [LỖI] Không thấy thư mục com.phuc.toollauncher nằm cạnh file này.
  pause
  exit /b 1
)

echo  1/2 Chép panel vào %DEST%
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%SRC%" "%DEST%\" /e /i /y /q >nul

echo  2/2 Cho phép Photoshop chạy panel tự làm (PlayerDebugMode)
for %%v in (9 10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

echo.
echo  XONG! Mở Photoshop, vào Window ^> Extensions (legacy) ^> Tool Launcher.
echo.
pause
