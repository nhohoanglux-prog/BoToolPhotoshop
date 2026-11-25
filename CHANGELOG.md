# Nhật ký cập nhật

## 2026-11-25
- SoTrangTuDong.jsx v1.0.1: sửa lỗi "The layer cannot contain text" khi bấm Xem trước / Cập nhật tất cả (số trang trong artboard giờ được tạo như khi bấm công cụ chữ).
- SoTrangTuDong.jsx v1.0.0: tool mới "Số trang tự động" kiểu Canva: gắn số cho mọi artboard theo thứ tự trang, 3 kiểu "01", "Trang 01", "01 / 43" (hoặc tự gõ mẫu), đối xứng như sách (trang trái số ở góc trái, trang phải ở góc phải), bìa không hiện số nhưng vẫn tính là trang 1, chọn trang bắt đầu, số bắt đầu và trang bỏ qua; chỉnh tay 1 số trang (font, cỡ, màu, vị trí) rồi chạy tool, bấm "Cập nhật tất cả" là mọi trang đổi theo. Kiểu được lưu ngay trong file.
- XoayIsometric.jsx v1.6.0: hộp thoại gọn hơn nhiều (bỏ khung minh hoạ to, gom chữ hướng dẫn vào nút "?", các nút xếp sát nhau); lần đầu mở nằm sát bên phải màn hình, thanh tiêu đề luôn nằm trong màn hình để kéo được; nhớ vị trí bạn kéo tới cho lần sau.
- CheDoNhe.jsx v1.0.0: tool mới "Chế độ nhẹ" giúp bớt lag: tạm thay ảnh Smart Object bằng bản nhẹ theo % bạn chọn (thanh trượt), kích thước và vị trí giữ nguyên, ảnh gốc được cất ở thư mục cạnh file; xem RAM Photoshop đang dùng và RAM dự kiến sau khi làm nhẹ; giữ nét artboard đang chọn, nút "Làm nét artboard đang chọn" để đổi sang trang khác; "Trả về đầy đủ tất cả" để lấy lại ảnh gốc.
- XuatArtboardNen.jsx v1.5.0: báo trước nếu file đang ở chế độ nhẹ (ảnh mờ), để bạn trả về đầy đủ rồi mới xuất.
- XoayIsometric.jsx v1.5.0: thêm ô "Khóa khối" (bật sẵn): dựng xong 3 layer được liên kết với nhau và mask dính với ảnh, kéo 1 mặt là cả khối đi theo. Muốn dịch ảnh trong 1 mặt thì bấm tắt biểu tượng xích giữa ảnh và mask, kéo xong bấm lại.
- XoayIsometric.jsx v1.4.0: khối hộp bớt cắt ảnh: thêm ô "Khối theo tỉ lệ ảnh" (bật sẵn, 2 mặt tường giữ trọn ảnh); ảnh gốc vẫn nguyên trong Smart Object và mask không dính vào ảnh nữa, nên dựng xong bạn dùng Move tool (V) kéo ảnh qua lại để chọn phần muốn hiện, khung mặt đứng yên.
- XoayIsometric.jsx v1.3.0: không tự xem trước nữa, chọn xong bấm "Xem trước" mới hiện (vẫn bật lại được ô "Tự xem trước mỗi khi đổi"); thêm nút đổi chỗ ảnh giữa các mặt (Trên ⇄ Trái, Trái ⇄ Phải, Trên ⇄ Phải, Xoay vòng 3 ảnh); mỗi mặt có nút "Xoay ↻" 90° và ô "Lật"; thẻ Xoay 1 ảnh có thêm ô "Lật ngang".
- Panel Tool Launcher v1.4.0: bản mới hiện ngay sau khi đưa lên, không phải chờ ~5 phút như trước (panel hỏi GitHub mã bản mới nhất rồi tải đúng bản đó).
- XoayIsometric.jsx v1.2.0: khối hộp không còn quá to: kích thước tự tính theo 3 ảnh gốc (100% = khối rộng bằng trung bình 3 ảnh), thêm thanh trượt "Độ lớn khối" 10–200% để thu / phóng khi đang xem trước.
- XoayIsometric.jsx v1.1.0: chia 2 thẻ "Xoay 1 ảnh" (chỉ xoay đúng ảnh bạn chọn) và "Dựng khối hộp từ 3 ảnh"; xem trước trực tiếp trên ảnh, bấm "Xong" để giữ, "Hủy" để trả lại như cũ; sửa lỗi khối hộp bị bay lung tung: khối giờ dựng ngay chỗ 3 ảnh đang nằm và gom group tại chỗ (vẫn nằm trong artboard).
- Panel Tool Launcher v1.3.0: hết treo ở "Đang quét thư mục…" khi Photoshop đang Transform hoặc mở hộp thoại; panel báo rõ và tự chạy tiếp khi Photoshop rảnh. Sửa lỗi ghi nhầm "tool mới" cho tool đã có.
- XoayIsometric.jsx v1.0.0: tool mới "Xoay ảnh Isometric": biến ảnh phẳng thành mặt trên / mặt trái / mặt phải theo 10 kiểu góc (isometric 30°, dimetric, trục đo 45°, 30/60, cavalier, cabinet…), giữ Smart Object để sửa lại được, và nút "Dựng khối hộp" từ 3 ảnh.
- XuatArtboardNen.jsx v1.4.0: thêm ô "Tên file" (để trống thì dùng tên file PSD). Xuất có giới hạn MB giờ chỉ xuất 1 lần; nếu vẫn lố thì hỏi bạn có muốn xuất lại nhỏ hơn không, không tự thử lại.
- XuatArtboardNen.jsx v1.3.0: xuất xong có nút "Mở thư mục chứa file" (mở File Explorer, tô sẵn file vừa xuất) và nút "Mở file PDF" / "Mở ảnh đầu tiên".
- XuatArtboardNen.jsx v1.2.0: nút "Chất lượng cao nhất" giờ luôn xuất 300 DPI, chất lượng 12, không giới hạn dung lượng, chỉ 1 lần. Khi có giới hạn MB, script ước tính trước bằng vài trang mẫu nên thường chỉ xuất 1 lần, nhanh hơn nhiều.
- Panel Tool Launcher v1.2.0: thêm khung "Có gì mới" (hiện ghi chú trước khi cập nhật và sau khi cập nhật xong), nhãn MỚI cho tool vừa thêm hoặc vừa cập nhật, link "Có gì mới" ở cuối bảng.
- XuatArtboardNen.jsx v1.1.0: thêm nút "Chất lượng cao nhất" (xuất ngay 300 DPI, JPEG 12, vẫn giữ giới hạn MB nếu có); mặc định DPI cao nhất đổi thành 300.
- Panel Tool Launcher v1.1.0: thêm số phiên bản, ngày cập nhật và nút "⬇ Cập nhật".
- DanhSoArtboard.jsx v1.0.0: bản đầu tiên.
- XuatArtboardNen.jsx v1.0.0: bản đầu tiên.
