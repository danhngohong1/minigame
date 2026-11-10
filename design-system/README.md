Lumen là hệ thống thiết kế hiện đại, trẻ trung: nền trắng thoáng, cam FPT `brand` làm điểm nhấn năng động, chữ đậm và góc bo tròn mềm. Tỉ lệ màu gợi ý: khoảng 70% trắng (`surface`), 20% chữ và nền trung tính (`ink`, `surface-muted`), 10% cam (`brand`). Hệ thống không kèm logo; hãy thêm logo chính thức của bạn vào nhóm `assets/Logos/`.

## Giọng văn

- **Ngắn, gần gũi, có năng lượng.** Tiêu đề 3–6 chữ, nói thẳng lợi ích: "Mạng nhanh, sống chất." "Chọn gói hợp với bạn".
- **Xưng "bạn"** với người đọc; thương hiệu tự xưng "chúng tôi" chỉ trong nội dung dài.
- **Nút bắt đầu bằng động từ:** "Đăng ký ngay", "Xem chi tiết", "Nhận tư vấn". Viết hoa chữ đầu, không dấu chấm.
- **Con số cụ thể** thay cho tính từ chung chung: "1Gbps", "Lắp trong 24 giờ", "Từ 180.000đ/tháng".
- Không dùng emoji trong tiêu đề hay nút; tối đa một dấu chấm than mỗi trang.

## Màu sắc

- Nền mặc định là `surface` (trắng). Xen kẽ section bằng `surface-alt` (trắng ấm ánh cam) hoặc `surface-muted`. Tối đa một dải `band-dark-bg` mỗi trang để tạo nhịp.
- `brand` dành cho hành động chính và khối nhấn lớn: nút chính, icon nổi bật, khối màu trong Hero, card được đề xuất. Mỗi màn hình chỉ một nút `brand`.
- Chữ màu cam luôn dùng `brand-deep`, không dùng `brand` (cam sáng chỉ đạt 2.9:1 trên trắng).
- Chữ trắng trên nền `brand` chỉ đạt 2.9:1; nhãn nút trên nền cam luôn từ 16px, đậm 700 (`button`).
- `brand-soft` làm nền badge và ô icon; chữ trên đó là `brand-deep`.
- `info` (xanh FPT), `success`, `danger` chỉ báo trạng thái và luôn đi kèm chữ.

## Chữ

- Một họ chữ duy nhất: **Be Vietnam Pro** (Google Fonts, hỗ trợ đầy đủ dấu tiếng Việt), tải ở các độ đậm 400, 500, 600, 700, 800.
- Tiêu đề đậm (`hero` 800, `section-title` và `card-title` 700) với khoảng cách chữ âm để trông gọn và hiện đại. Nội dung đọc dùng `body` 400.
- `overline` viết HOA (text-transform: uppercase) màu `brand-deep`, đặt phía trên `section-title`.
- Dưới 734px: `hero` xuống 40px/44px, `section-title` xuống 32px/38px.

## Bố cục và khoảng cách

- Lưới 4px. Cột nội dung tối đa `content-max` (1200px), lề `space-6` trên desktop và `space-4` trên điện thoại.
- Khoảng cách giữa các section là `space-9` (96px) trên desktop, `space-8` (64px) trên điện thoại. Hãy để nhiều khoảng trắng.
- Card cách nhau `space-5`, padding trong `space-5`; Hero padding `space-7`.

## Hình khối, chiều sâu, chuyển động

- Mọi nút, badge, chip đều bo tròn hoàn toàn: `radius-pill`. Card dùng `radius-lg`, Hero và ảnh lớn dùng `radius-xl`, ô nhập liệu dùng `radius-md`.
- Card nghỉ ở `shadow-card`; khi hover chuyển sang `shadow-card-hover` và dịch lên 4px trong 200ms ease-out. Nút chính khi hover có `shadow-brand`.
- Chuyển động nhanh và nảy nhẹ (200–300ms). Tắt chuyển động khi người dùng bật prefers-reduced-motion.
- Focus: viền 2px liền màu `focus`, cách 2px, trên mọi link, nút và ô nhập.

## Biểu tượng

- Dùng bộ icon nét tròn (stroke 2px, đầu nét bo tròn) ở 24px, như Lucide hoặc Phosphor Regular. Icon lấy màu chữ bên cạnh, hoặc `brand-deep` khi đặt trong ô tròn `brand-soft`.
- Link dẫn sang trang khác kết thúc bằng mũi tên `→` cùng kiểu chữ.
- Không vẽ lại logo; dùng file logo chính thức.

## Component

`Button`, `TextLink`, `Badge`, `Card`, `Hero`, `GlobalNav`, `Footer`. Class nằm trong `components/bundle.css` và chỉ đọc các token ở trên.
