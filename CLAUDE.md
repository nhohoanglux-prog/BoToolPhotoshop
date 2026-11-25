# BoToolPhotoshop – ghi chú cho Claude

Đọc file này thay vì đọc lại lịch sử chat dài.

## Người dùng (phúc)
- Luôn trả lời bằng tiếng Việt có dấu đầy đủ.
- Hỏi vài câu ngắn để hiểu đúng trước khi làm.
- Không rành code: mỗi lần giao chỉ gửi MỘT file zip + hướng dẫn ngắn, từng bước.
- Dùng Photoshop 2021/2022 trên Windows 11.

## Kho này là gì
Nguồn cập nhật cho panel "Tool Launcher" trong Photoshop. Nút "⬇ Cập nhật" trong panel đọc
`https://raw.githubusercontent.com/nhohoanglux-prog/BoToolPhotoshop/main/capnhat.json`.
Cấu trúc kho = cấu trúc file zip giao cho người dùng:

```
capnhat.json                      danh sách phiên bản (panel + từng tool)
HuongDan.txt                      hướng dẫn cài 5 bước (UTF-8 có BOM, CRLF)
1_CaiPanel/CaiDat.bat, GoCaiDat.bat
1_CaiPanel/com.phuc.toollauncher/ panel CEP (index.html, js/main.js, jsx/host.jsx, css/, CSXS/manifest.xml)
2_ThuMucTool/*.jsx                các tool; file bắt đầu bằng "_" bị panel bỏ qua (_MauTool.jsx là mẫu)
```

## Panel Tool Launcher (CEP, không dùng UXP vì UXP không chạy được .jsx)
- Quét thư mục tool người dùng chọn (tối đa 3 cấp), tìm kiếm không dấu, chia nhóm, bấm 1 lần là chạy bằng `$.evalFile`.
- Hiện phiên bản/ngày của từng tool; cuối bảng hiện phiên bản panel.
- Cập nhật: so `capnhat.json` với phiên bản tại máy, tải hết rồi mới ghi đè (qua `TL_writeFile` trong host.jsx, .jsx ghi kèm BOM). Tool khớp theo tên file. Panel cập nhật thì tự tải lại.
- Chưa được thử trên Photoshop thật (chỉ thử trên trình duyệt với mock).

## Quy ước đầu file mỗi tool (bắt buộc, lưu UTF-8 có BOM)
```
#target photoshop
/*
  @name: Tên hiện trong panel
  @group: Nhóm (Artboard, Xuất file, ...)
  @desc: Một dòng mô tả ngắn.
  @version: 1.0.0
  @date: 2026-11-25
*/
```

## Khi sửa hoặc thêm tool / panel
Kho này là bản gốc duy nhất (bản trong /mnt/project-files chỉ là bản sao, có thể cũ).
1. Sửa code. Tăng `@version` và `@date` của tool đó (sửa nhỏ: 1.0.1, thêm tính năng: 1.1.0).
   Sửa panel thì tăng `PANEL_VERSION`, `PANEL_DATE` trong `js/main.js` và Version trong `CSXS/manifest.xml`.
2. Thêm một dòng vào đầu mục ngày trong `CHANGELOG.md`, đúng dạng (panel đọc dòng này làm ghi chú "Có gì mới"):
   `- TenFile.jsx v1.1.0: thay đổi gì` hoặc `- Panel Tool Launcher v1.2.0: thay đổi gì`
3. Chạy `python3 dong_goi.py` (tạo lại `capnhat.json` và `/mnt/project-files/BoToolPhotoshop.zip`), commit, push lên `main`.
4. Báo người dùng: mở panel là thấy khung "🔔 Có bản mới" kèm ghi chú, bấm "⬇ Cập nhật ngay". Tool vừa cập nhật có nhãn MỚI.
   Chỉ gửi zip mới khi cài lần đầu hoặc khi sửa `CaiDat.bat`/`manifest.xml`.
   GitHub raw có thể trễ tới ~5 phút sau khi push.

## Các tool hiện có
| File | Nhóm | Làm gì |
|---|---|---|
| DanhSoArtboard.jsx | Artboard | Đánh số lại artboard theo vị trí (trên xuống, trái sang) thành "Trang 01…", sắp lại bảng Layers, gom 1 bước History. |
| XuatArtboardNen.jsx | Xuất file | Xuất artboard theo thứ tự trang ra PDF (gộp) / JPG / PNG, trang đơn hoặc đôi, tự nén để TỔNG dung lượng ≤ giới hạn MB (PNG chỉ hạ DPI). Không đụng file gốc. Mặc định 20 MB, 300 DPI. Nút "Chất lượng cao nhất" = 300 DPI + JPEG 12, bỏ qua giới hạn MB, xuất 1 lần. Có giới hạn MB: ước tính bằng 3-5 trang mẫu rồi chọn sẵn DPI/chất lượng, tối đa 3 lần xuất đầy đủ (người dùng phàn nàn chậm khi thử nhiều lần). |
