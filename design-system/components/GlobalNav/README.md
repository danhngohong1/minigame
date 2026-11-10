# GlobalNav

Thanh điều hướng trắng trong mờ cao 64px: logo bên trái, link ở giữa, một nút đăng ký nhỏ bên phải.

- **Cung cấp:** `<nav class="lm-nav">` › `.lm-nav__inner` › `.lm-nav__brand` (logo hoặc tên thương hiệu), `.lm-nav__links`, và một `lm-btn lm-btn--sm`.
- Trang hiện tại đánh dấu bằng `aria-current="page"`: chữ `ink` và gạch chân cam 2px.
- **Dùng** `position: sticky; top: 0`; 4–7 link. Dưới 834px gom link vào nút menu.
- **Không nên** đặt quá một nút hoặc dùng chữ cam cho link điều hướng.
