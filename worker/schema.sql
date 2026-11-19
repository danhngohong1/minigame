-- D1 schema cho minigame "Vòng quay may mắn" (xem yeucau.md mục 4)
-- Chạy: wrangler d1 execute <ten-db> --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS spins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,              -- giờ VN yyyy-MM-dd HH:mm:ss
  day         TEXT NOT NULL,              -- yyyy-MM-dd
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,              -- 0xxxxxxxxx
  phone_key   TEXT NOT NULL UNIQUE,       -- 9 số cuối, chống chơi trùng
  area        TEXT NOT NULL,              -- Tân Bình / Quận 4 / Quận 6 / Khác
  area_other  TEXT NOT NULL DEFAULT '',   -- khu vực người chơi tự nhập khi chọn "Khác"
  prize_code  TEXT NOT NULL,              -- V150 / V200 / V300 / AOMUA / MUBH
  prize_name  TEXT NOT NULL,
  rolled_code TEXT NOT NULL,              -- quà quay ra ban đầu (khác prize_code nếu bị đổi do hết hàng)
  claim_code  TEXT NOT NULL UNIQUE,       -- mã nhận quà
  src         TEXT NOT NULL DEFAULT ''    -- nguồn QR (?src=)
);

CREATE INDEX IF NOT EXISTS idx_spins_prize ON spins (prize_code);
CREATE INDEX IF NOT EXISTS idx_spins_day   ON spins (day);

CREATE TABLE IF NOT EXISTS stock (
  prize_code TEXT PRIMARY KEY,            -- AOMUA / MUBH
  total      INTEGER NOT NULL DEFAULT 0,  -- tổng số lượng BTC nhập trên admin
  updated_at TEXT NOT NULL DEFAULT ''
);

-- Mặc định 0 = chưa nhập → không phát quà hiện vật
INSERT OR IGNORE INTO stock (prize_code, total, updated_at) VALUES ('AOMUA', 0, ''), ('MUBH', 0, '');
