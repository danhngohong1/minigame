# Button

Nút bo tròn hoàn toàn: nút chính nền `brand` cam FPT, nút phụ viền cam nền trắng, nút ghost viền xám.

- **Cung cấp:** thẻ `<a>` hoặc `<button>` có class `lm-btn`; thêm `lm-btn--secondary`, `lm-btn--ghost`, và cỡ `lm-btn--sm` / `lm-btn--lg`.
- **Mỗi màn hình chỉ một nút chính** (nền cam). Hành động thứ hai dùng `--secondary`, thứ ba dùng `--ghost`.
- Nút chính cỡ nhỏ (`--sm`, 14px) tự đổi nền sang `brand-deep` để chữ trắng đủ độ tương phản.
- **Nên:** nhãn là động từ ngắn ("Đăng ký ngay"). **Không nên:** nhãn dài hơn 4 chữ, viết HOA toàn bộ, đặt emoji.
- Trạng thái vô hiệu dùng `surface-muted` + `ink-tertiary`; luôn ghi lý do bên cạnh.
