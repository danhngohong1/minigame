# Vòng quay may mắn – bản 2 (quà tặng hiện vật)

Clone y hệt game ở thư mục gốc repo, chỉ khác bộ quà. Deploy lên Worker `minigames`:

- Game: https://minigames.danhngohong1.workers.dev/
- Quản trị: https://minigames.danhngohong1.workers.dev/admin (nhập `ADMIN_KEY`)

## Bộ quà (7 ô)

| Quà | Tỉ lệ |
|---|---|
| Voucher 150.000đ | 61,34% |
| Voucher 200.000đ | 20,44% |
| Voucher 300.000đ | 10,22% |
| Móc khoá | 2% |
| Nón | 2% |
| Bình nước | 2% |
| Túi | 2% |

3 voucher chia 92% theo đúng tỉ lệ 6 : 2 : 1 của game gốc. Quà hiện vật hết hàng (hoặc chưa nhập số lượng trên trang quản trị) → tự đổi sang voucher.

Sửa tỉ lệ: mảng `PRIZES` trong `worker/worker.js` (thứ tự phải khớp `PRIZES` trong `public/game.js`).

## Dữ liệu

Dùng chung D1 `vong-quay` với game gốc nhưng bảng riêng `spins_qt` / `stock_qt` (tự tạo ở lần chạy đầu), nên:
- Thống kê, CSV, tồn kho tách biệt hoàn toàn với game gốc.
- Một SĐT đã chơi game gốc vẫn chơi được game này (mỗi game 1 lần).
- Mã nhận quà bắt đầu bằng `QT-` (game gốc là `VQ-`).

## Cấu hình deploy (một lần trên Cloudflare)

Workers & Pages → **minigames** → Settings → Build:
- Git repository: `danhngohong1/minigame`, nhánh `main`
- **Root directory: `minigames`** (để build dùng `minigames/wrangler.jsonc`, không đụng game gốc)
- Deploy command: `npx wrangler deploy`

Variables and Secrets của Worker `minigames`: `ADMIN_KEY` (Secret), `SHEET_WEBHOOK` (tuỳ chọn, nên dùng Sheet riêng).
