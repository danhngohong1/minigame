# Vòng quay may mắn – FPT Telecom

Minigame quét QR → nhập thông tin → quay vòng quay 5 ô quà. Chạy trên Cloudflare Workers, dữ liệu lưu ở D1.

- Game: https://minigames.danhngohong1.workers.dev/
- Quản trị: https://minigames.danhngohong1.workers.dev/admin (nhập `ADMIN_KEY`)

## Cấu trúc

| Thư mục / file | Nội dung |
|---|---|
| `public/` | Giao diện: `index.html` (game), `admin.html` (quản trị), `style.css`, `game.js`, `token.css`, `assets/` |
| `worker/worker.js` | API dưới `/api` (check, spin, tồn kho, thống kê, CSV). Tự tạo bảng D1 ở lần chạy đầu |
| `worker/schema.sql` | Cấu trúc bảng `spins`, `stock` (tham khảo) |
| `wrangler.jsonc` | Cấu hình deploy: Worker `minigames`, D1 `vong-quay` |

## Deploy

Mỗi lần push lên nhánh `main`, Cloudflare Workers Builds tự chạy `npx wrangler deploy`.

Cấu hình một lần trên dashboard (Workers & Pages → minigames → Settings → Variables and Secrets):

- `ADMIN_KEY` (Secret): mật khẩu trang quản trị.
- `SHEET_WEBHOOK` (tuỳ chọn): URL Apps Script để chép mỗi lượt quay sang Google Sheet.

## Sửa nhanh

- Tỉ lệ quà: mảng `PRIZES` trong `worker/worker.js` (thứ tự phải khớp `PRIZES` trong `public/game.js`).
- Thời gian chương trình: `PROGRAM_START` / `PROGRAM_END` trong `worker/worker.js`.
- Số lượng áo mưa / mũ bảo hiểm: nhập trên trang quản trị.
- Link QR theo điểm đặt: thêm `?src=tanbinh`, `?src=quan4`, … để thống kê nguồn.

Game cũ "Tinh Hà FPT" vẫn còn trong lịch sử git (commit `47aea74`).
