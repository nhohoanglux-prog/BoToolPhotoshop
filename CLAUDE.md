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
- Khi Photoshop đang Transform/mở hộp thoại, evalScript xếp hàng chờ: sau 3 giây panel báo "Photoshop đang bận" và tự chạy tiếp; chỉ so phiên bản tool sau khi quét xong thư mục (tránh ghi nhầm "tool mới").
- Người dùng đã chạy panel trên Photoshop thật (v1.2.0 hoạt động).

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
   Từ panel v1.4.0, panel lấy mã commit mới nhất qua api.github.com rồi tải raw theo mã đó nên bản mới hiện ngay (API lỗi/hết 60 lượt/giờ thì quay về main/, có thể trễ ~5 phút).

## Các tool hiện có
| File | Nhóm | Làm gì |
|---|---|---|
| DanhSoArtboard.jsx | Artboard | Đánh số lại artboard theo vị trí (trên xuống, trái sang) thành "Trang 01…", sắp lại bảng Layers, gom 1 bước History. |
| XuatArtboardNen.jsx | Xuất file | Xuất artboard theo thứ tự trang ra PDF (gộp) / JPG / PNG, trang đơn hoặc đôi, tự nén để TỔNG dung lượng ≤ giới hạn MB (PNG chỉ hạ DPI). Không đụng file gốc. Mặc định 20 MB, 300 DPI. Nút "Chất lượng cao nhất" = 300 DPI + JPEG 12, bỏ qua giới hạn MB, xuất 1 lần. Có giới hạn MB: ước tính bằng 3-5 trang mẫu rồi chọn sẵn DPI/chất lượng, xuất đúng 1 lần (lề an toàn 10%); lố thì hỏi confirm mới xuất lại, KHÔNG tự thử lại (người dùng muốn 1 lần). Ô "Tên file": trống = tên PSD, JPG/PNG dùng làm tiền tố. Xuất xong: hộp thoại có nút mở Explorer tô sẵn file (qua .vbs UTF-16 cho đường dẫn có dấu) và nút mở file. |
| XoayIsometric.jsx | Hình chiếu trục đo | v1.6.0. Hộp thoại GỌN (người dùng: bản cũ quá cao, thanh tiêu đề lọt lên trên màn hình, che ảnh): hàng Góc + hình nhỏ 70x58, hướng dẫn nằm trong nút "?" và helpTip, hàng cuối gồm Xem trước/Tự xem/?/Xong/Hủy. placeWindow(): lần đầu sát phải màn hình, kẹp trong $.screens, nhớ vị trí (customOptions XoayIsometric_win). Khi thêm điều khiển mới phải giữ hộp thoại thấp. Ô "Khóa khối" (mặc định bật, prefs lock, người dùng yêu cầu): linkSelectedLayers cho 3 mặt (dự phòng DOM layer.link) và GIỮ mask liên kết; tắt ô thì bỏ liên kết mask như v1.4.0. Chống cắt ảnh: ô "Khối theo tỉ lệ ảnh" (mặc định bật, prefs ratio): a = tỉ lệ ảnh mặt phải, b = tỉ lệ ảnh mặt trái, h = 1, rồi co theo thanh trượt; gõ tay số px thì tự tắt ô này. Khi tắt Khóa khối: mask bỏ liên kết (userMaskLinked=false) để kéo ảnh bằng Move tool trong khung mặt (dịch chuyển giữ đúng mặt phẳng; Ctrl+T co giãn đều cũng giữ đúng góc). Xem trước THỦ CÔNG mặc định (người dùng thấy tự xem trước chậm, phiền): nút "Xem trước", ô "Tự xem trước mỗi khi đổi" mặc định tắt (prefs key live2). Khối hộp: mỗi mặt có nút Xoay ↻ 90° + ô Lật (lật = ma trận [-1,0,0,1], det âm), nút đổi chỗ ảnh Trên⇄Trái, Trái⇄Phải, Trên⇄Phải, Xoay vòng (đổi kèm xoay/lật). Xoay 90/270 thì đổi w/h khi tính lấp đầy. ĐÃ chạy được trên Photoshop thật (xem trước + dựng khối khít cạnh, trong artboard). Kích thước khối: thanh trượt % (100% = bbox khối rộng bằng trung bình bề rộng 3 ảnh, đo lúc mở hộp thoại trong allLayers), không lưu px vào prefs nữa (v1.1.0 nhớ 3226 px từ bản cũ nên khối quá to). 2 thẻ: "Xoay 1 ảnh" (dropdown chọn 1 layer, mặc định layer đang chọn; radio Trên/Trái/Phải) và "Dựng khối hộp từ 3 ảnh". Xem trước: mỗi lần xem thì quay về history lúc mở hộp thoại rồi chạy lại trong suspendHistory + app.refresh; Hủy = quay về history ban đầu. 10 kiểu góc (isometric 30°, pixel 2:1, dimetric 7/42 và 15/15, trục đo mặt bằng 45/45, 30/60, 60/30, cavalier 45/30, cabinet). Đổi mặt trên cùng layer: reset transform trước (`placedLayerResetTransforms`, CHƯA kiểm chứng), giữ tỉ lệ cũ. Biến dạng chính: Trnf + rectangle/quadrilateral; dự phòng: co giãn → xiên → xoay, thử dấu. VỊ TRÍ luôn tính bằng bounds px (v1.0.0 dùng 4 góc smartObjectMore làm khối hộp bay lung tung); 4 góc chỉ dùng sau khi tự dò hệ số đơn vị (calibrateQuad). Khối hộp: canh giữa vùng 3 ảnh gốc, lấp đầy + mask tứ giác (nới 0,5 px), gom group tại chỗ như Ctrl+G. Có mock node để thử logic (không nằm trong kho). |
| CheDoNhe.jsx | Tối ưu file | v1.0.0, CHƯA chạy trên Photoshop thật. Proxy cho Smart Object nhúng: placedLayerExportContents cất file gốc vào `<tên>_AnhGoc_CheDoNhe/0001/<tên gốc>` (+ thongtin.txt, DOC_KY.txt), tạo bản nhẹ (mở file gốc, 8-bit, gộp layer, resize %, hạ resolution cùng tỉ lệ; .jpg nếu gốc là jpg, còn lại .psd) tên `NHE__0001__<pct>__<tên>`, placedLayerReplaceContents rồi đo boundsNoEffects (tắt mask tạm) trước/sau và resize + translate cho khớp khung cũ. Tên NHE__ = dấu hiệu đang nhẹ (XuatArtboardNen v1.5.0 kiểm tra và hỏi). Layer dùng chung nội dung (cùng documentID) xử lý 1 lần, chỉnh khung tất cả. Dùng lại bản nhẹ cũ nếu file gốc giống hệt (dung lượng + 3 đoạn 64 KB). Giữ nét artboard đang chọn (artboard chứa layer đang chọn); nút "Làm nét artboard đang chọn" = trả gốc artboard đó + làm nhẹ các artboard khác. Thanh trượt 10-90% (mặc định 50), bỏ qua ảnh < 1500 px, Linked, vector. RAM đọc bằng app.system + PowerShell (Get-CimInstance, Get-Process Photoshop) ra file txt; ước tính RAM ảnh nhúng = điểm ảnh x 4 byte. Snapshot trước khi chạy, lỗi thì quay về. Không bao giờ tự xóa ảnh gốc. Prefs: Folder.userData/BoToolPhotoshop/CheDoNhe.txt. |
| SoTrangTuDong.jsx | Artboard | v1.2.0. Người dùng chạy được v1.0.1 trên Photoshop thật: trang phải đúng góc, trang trái bị lệch ra giữa vì đọc bounds DOM cũ sau khi đổi justification. Từ v1.2.0: đặt justification TRƯỚC, đo lại bằng AM (measureLayer, boundsNoEffects theo layer ID) và dời tối đa 3 lần tới khi khớp. "Cập nhật tất cả" đóng hộp thoại (bỏ số xem thử) rồi chạy hết trong main() với khung tiến độ + nút Dừng/Esc (khối dùng chung progOpen/prog/progClose/isStopErr), dừng hoặc lỗi thì quay về history trước khi chạy. v1.1.0: Xem trước NHANH (người dùng: đợi lâu, sai lại chỉnh lâu): applyAll(..., limit) chỉ làm N trang có số đầu tiên (ô cạnh nút Xem trước, mặc định 3, nhớ ở customOptions SoTrangTuDong_prev); "Cập nhật tất cả" quay về history rồi làm hết mọi trang (bỏ qua nếu đã làm hết với cùng thiết lập); Hủy quay về history ban đầu. Từ v1.0.1: Người dùng đã mở được hộp thoại trên Photoshop thật; v1.0.0 lỗi "The layer cannot contain text" vì artLayers.add() + kind = TEXT KHÔNG dùng được trong artboard. Từ v1.0.1 tạo layer chữ bằng Action Manager (Mk TxLr, chọn layer trên cùng của artboard trước để layer mới nằm trong artboard; dự phòng: doc.artLayers.add rồi move vào artboard); layer "[Số trang]" không phải chữ thì xoá tạo lại. Phần đặt số chưa kiểm chứng trên Photoshop thật. Số trang kiểu Canva. Thứ tự trang = sortByPosition của DanhSoArtboard (thêm col/rowLen). Mỗi artboard 1 layer chữ tên bắt đầu "[Số trang]" (tìm đệ quy trong artboard, trùng thì xoá bớt), CẬP NHẬT TẠI CHỖ (giữ hiệu ứng), trang bỏ thì xoá layer. Kiểu lưu trong XMP của file (namespace http://ns.botoolphotoshop/sotrang/1.0/, property style, chuỗi key=value&…), dự phòng customOptions SoTrangTuDong_last. Người dùng chọn: 3 kiểu "01", "Trang 01", "01 / 43" (+ Tùy chỉnh với {so} {tong} {ten}); đối xứng như sách mặc định BẬT (trang col chẵn trong hàng ≥2 artboard = trang trái, lật ngang vị trí), mặc định Dưới phải; bìa không hiện số nhưng tính trang 1 (fromPage=2, start=2). Có ô "Gắn số từ trang thứ / mang số", Bỏ trang cuối, Bỏ "5, 10-12". Nút chính "Cập nhật tất cả" (người dùng yêu cầu): nếu layer đang chọn là số trang thì lấy font/cỡ/màu + vị trí (góc + lề so với artboard, đổi về kiểu trang phải nếu là trang trái) và chép layer style (CpFX/PaFX) cho tất cả. Cỡ chữ nhập px, đổi sang pt = px*72/resolution. Canh vị trí theo boundsNoEffects. Xem trước = quay về history lúc mở rồi chạy lại trong suspendHistory. Hộp thoại gọn 5 hàng, placeWindow nhớ vị trí (SoTrangTuDong_win). Chọn font: hộp tìm theo tên trong app.fonts. |
