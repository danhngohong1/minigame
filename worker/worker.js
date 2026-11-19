/**
 * Cloudflare Worker – minigame "Vòng quay may mắn" (FPT Telecom). Đặc tả: yeucau.md mục 2, 3, 4.
 *
 * Worker này chạy chung với giao diện (thư mục public/, xem wrangler.jsonc ở gốc repo).
 * Mọi API nằm dưới tiền tố /api (vd POST /api/spin); bảng D1 tự tạo ở lần chạy đầu.
 *
 * Cấu hình trong Worker (Settings):
 *   - Binding D1:  biến  DB  (khai báo trong wrangler.jsonc)
 *   - Secret:      ADMIN_KEY → mật khẩu trang admin / báo cáo / CSV
 *   - Biến (tuỳ chọn): SHEET_WEBHOOK → URL Apps Script; mỗi lượt quay được chép sang Google Sheet (chạy nền)
 *
 * API:
 *   POST /check        { phone }                    → { result:"ok", open, played:false } | { result:"ok", open, played:true, ...kết quả }
 *   POST /spin         { name, phone, area, area_other, src }   → { result:"success", ...kết quả } | { result:"duplicate", ...kết quả cũ }
 *                                                     | { result:"closed" } | { result:"error", message }
 *   GET  /admin/stock?key=…                         → { result:"ok", stock:{ AOMUA:{total,used,remaining}, MUBH:{…} } }
 *   POST /admin/stock  { key, AOMUA?, MUBH? }       → cập nhật tổng số lượng (không nhỏ hơn số đã phát)
 *   GET  /?action=summary&key=…                     → số liệu tổng hợp (JSON) cho admin.html
 *   GET  /?action=list&key=…                        → danh sách lượt quay (JSON)
 *   GET  /?action=export&key=…                      → CSV toàn bộ dữ liệu
 */

// ===== CẤU HÌNH =====
// Thứ tự trong mảng = thứ tự ô trên vòng quay (slot 0 ở đỉnh, theo chiều kim đồng hồ). Phải khớp PRIZES trong app/game.js.
const PRIZES = [
  { code: "V150",  name: "Voucher 150.000đ", weight: 60, limited: false },
  { code: "AOMUA", name: "Áo mưa",           weight: 5,  limited: true  },
  { code: "V200",  name: "Voucher 200.000đ", weight: 20, limited: false },
  { code: "MUBH",  name: "Mũ bảo hiểm",      weight: 5,  limited: true  },
  { code: "V300",  name: "Voucher 300.000đ", weight: 10, limited: false },
];
const AREAS = ["Tân Bình", "Quận 4", "Quận 6", "Khác"]; // "Khác" → bắt buộc có area_other (người chơi tự nhập)

// Thời gian chương trình, giờ Việt Nam "yyyy-MM-dd HH:mm". Để trống = không khoá.
const PROGRAM_START = "";
const PROGRAM_END = "";

const VN_OFFSET_MS = 7 * 3600 * 1000;
const CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ I, O, 0, 1 cho dễ đọc

// ===== TIỆN ÍCH =====
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

function vnNow() {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ");
}

function isOpen(now = vnNow()) {
  const t = now.slice(0, 16);
  if (PROGRAM_START && t < PROGRAM_START) return false;
  if (PROGRAM_END && t > PROGRAM_END) return false;
  return true;
}

function randomInt(max) {
  // Số nguyên ngẫu nhiên [0, max) bằng crypto, loại bỏ lệch modulo
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

function weightedPick(list) {
  const total = list.reduce((s, p) => s + p.weight, 0);
  let r = randomInt(total);
  for (const p of list) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return list[list.length - 1];
}

function claimCode() {
  let s = "VQ-";
  for (let i = 0; i < 6; i++) s += CLAIM_ALPHABET[randomInt(CLAIM_ALPHABET.length)];
  return s;
}

/** Chuẩn hoá SĐT: chấp nhận +84 / 84 / 0, trả "0xxxxxxxxx" hoặc "" nếu sai. */
function normalizePhone(raw) {
  let d = String(raw || "").replace(/[\s.\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (!/^\d+$/.test(d)) return "";
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : "";
}

function normalizeName(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

const prizeByCode = (code) => PRIZES.find((p) => p.code === code);
const slotOf = (code) => PRIZES.findIndex((p) => p.code === code);

function publicResult(row) {
  return {
    prize_code: row.prize_code,
    prize_name: row.prize_name,
    slot: slotOf(row.prize_code),
    claim_code: row.claim_code,
    created_at: row.created_at,
    area: row.area,
    area_other: row.area_other || "",
  };
}

async function readJson(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return null;
  }
}

function checkKey(env, key) {
  return Boolean(env.ADMIN_KEY) && typeof key === "string" && key === env.ADMIN_KEY;
}

async function findByPhoneKey(db, phoneKey) {
  return db
    .prepare("SELECT prize_code, prize_name, claim_code, created_at, area, area_other FROM spins WHERE phone_key = ?1")
    .bind(phoneKey)
    .first();
}

async function stockInfo(db) {
  const { results } = await db
    .prepare(
      `SELECT p.code AS code, COALESCE(s.total, 0) AS total,
              (SELECT COUNT(*) FROM spins WHERE prize_code = p.code) AS used
       FROM (SELECT 'AOMUA' AS code UNION ALL SELECT 'MUBH') AS p
       LEFT JOIN stock s ON s.prize_code = p.code`
    )
    .all();
  const out = {};
  for (const r of results) out[r.code] = { total: r.total, used: r.used, remaining: Math.max(0, r.total - r.used) };
  return out;
}

// ===== NGƯỜI CHƠI =====
async function handleCheck(request, env) {
  const data = await readJson(request);
  const phone = normalizePhone(data && data.phone);
  if (!phone) return json({ result: "error", message: "Số điện thoại không hợp lệ" }, 400);
  const row = await findByPhoneKey(env.DB, phone.slice(-9));
  const open = isOpen();
  if (!row) return json({ result: "ok", open, played: false });
  return json({ result: "ok", open, played: true, ...publicResult(row) });
}

async function handleSpin(request, env, ctx) {
  const data = await readJson(request);
  if (!data) return json({ result: "error", message: "Dữ liệu gửi lên không hợp lệ" }, 400);

  const name = normalizeName(data.name).normalize("NFC");
  const phone = normalizePhone(data.phone);
  const area = String(data.area || "").trim().normalize("NFC");
  const src = String(data.src || "").replace(/[^\w\-]/g, "").slice(0, 40);

  if (name.length < 2 || name.length > 50) return json({ result: "error", message: "Họ tên phải từ 2 đến 50 ký tự" }, 400);
  if (!phone) return json({ result: "error", message: "Số điện thoại không hợp lệ" }, 400);
  if (!AREAS.includes(area)) return json({ result: "error", message: "Khu vực không hợp lệ" }, 400);
  const areaOther = area === "Khác" ? normalizeName(data.area_other).normalize("NFC") : "";
  if (area === "Khác" && (areaOther.length < 2 || areaOther.length > 50)) {
    return json({ result: "error", message: "Khu vực tự nhập phải từ 2 đến 50 ký tự" }, 400);
  }

  const phoneKey = phone.slice(-9);

  // Đã chơi → trả lại kết quả cũ (kể cả khi người chơi bấm thử lại sau lỗi mạng)
  const existing = await findByPhoneKey(env.DB, phoneKey);
  if (existing) return json({ result: "duplicate", ...publicResult(existing) });

  const now = vnNow();
  if (!isOpen(now)) return json({ result: "closed" });

  const rolled = weightedPick(PRIZES);
  // Quà dự phòng nếu quà hiện vật đã hết: 1 voucher bất kì theo tỉ lệ tương đối 60 : 20 : 10
  const fallback = rolled.limited ? weightedPick(PRIZES.filter((p) => !p.limited)) : rolled;

  // 1 câu lệnh duy nhất: kiểm tra tồn kho + chống trùng SĐT + ghi kết quả → không phát vượt số lượng khi nhiều người quay cùng lúc
  const sql = `INSERT INTO spins (created_at, day, name, phone, phone_key, area, prize_code, prize_name, rolled_code, claim_code, src, area_other)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6,
            CASE WHEN g.ok THEN ?7 ELSE ?9 END,
            CASE WHEN g.ok THEN ?8 ELSE ?10 END,
            ?7, ?11, ?12, ?14
     FROM (SELECT (?13 = 0) OR (
             COALESCE((SELECT total FROM stock WHERE prize_code = ?7), 0)
             > (SELECT COUNT(*) FROM spins WHERE prize_code = ?7)
           ) AS ok) AS g
     WHERE 1
     ON CONFLICT (phone_key) DO NOTHING
     RETURNING prize_code, prize_name, claim_code, created_at, area, area_other`;

  let row = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      row = await env.DB.prepare(sql)
        .bind(now, now.slice(0, 10), name, phone, phoneKey, area,
              rolled.code, rolled.name, fallback.code, fallback.name,
              claimCode(), src, rolled.limited ? 1 : 0, areaOther)
        .first();
      break;
    } catch (err) {
      // Trùng mã nhận quà (rất hiếm) → sinh mã khác và thử lại
      if (String(err).includes("claim_code") && attempt < 4) continue;
      throw err;
    }
  }

  if (!row) {
    // Một yêu cầu khác của cùng SĐT vừa ghi trước → trả kết quả đó
    const again = await findByPhoneKey(env.DB, phoneKey);
    if (again) return json({ result: "duplicate", ...publicResult(again) });
    return json({ result: "error", message: "Không ghi được lượt quay, vui lòng thử lại" }, 500);
  }

  if (env.SHEET_WEBHOOK) {
    ctx.waitUntil(
      fetch(env.SHEET_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          created_at: row.created_at, name, phone, area, area_other: areaOther,
          prize: row.prize_name, rolled: rolled.name, claim_code: row.claim_code, src,
        }),
      }).catch((err) => console.error("Sheet mirror:", err))
    );
  }

  return json({ result: "success", ...publicResult(row) });
}

// ===== QUẢN TRỊ =====
async function handleStockGet(env, url) {
  if (!checkKey(env, url.searchParams.get("key"))) return json({ result: "error", message: "Sai hoặc thiếu key" }, 403);
  return json({ result: "ok", stock: await stockInfo(env.DB) });
}

async function handleStockPost(request, env) {
  const data = await readJson(request);
  if (!data || !checkKey(env, data.key)) return json({ result: "error", message: "Sai hoặc thiếu key" }, 403);

  const now = vnNow();
  const updates = [];
  for (const code of ["AOMUA", "MUBH"]) {
    if (data[code] === undefined || data[code] === null || data[code] === "") continue;
    const n = Number(data[code]);
    if (!Number.isInteger(n) || n < 0 || n > 1000000) {
      return json({ result: "error", message: `Số lượng ${prizeByCode(code).name} không hợp lệ` }, 400);
    }
    updates.push({ code, n });
  }
  if (!updates.length) return json({ result: "error", message: "Chưa nhập số lượng" }, 400);

  // Kiểm tra trước để báo lỗi rõ ràng; câu lệnh ghi vẫn tự chặn nếu có lượt quay xen giữa
  const before = await stockInfo(env.DB);
  for (const u of updates) {
    if (u.n < before[u.code].used) {
      return json({
        result: "error",
        message: `${prizeByCode(u.code).name}: đã phát ${before[u.code].used}, không thể nhập nhỏ hơn số này`,
      }, 400);
    }
  }

  await env.DB.batch(
    updates.map((u) =>
      env.DB.prepare(
        `INSERT INTO stock (prize_code, total, updated_at)
         SELECT ?1, ?2, ?3 WHERE ?2 >= (SELECT COUNT(*) FROM spins WHERE prize_code = ?1)
         ON CONFLICT (prize_code) DO UPDATE SET total = excluded.total, updated_at = excluded.updated_at`
      ).bind(u.code, u.n, now)
    )
  );

  return json({ result: "ok", stock: await stockInfo(env.DB) });
}

async function handleSummary(env) {
  const db = env.DB;
  const [{ results: byPrize }, { results: byAreaPrize }, { results: byDayPrize }, swapped, stock] = await Promise.all([
    db.prepare("SELECT prize_code, COUNT(*) AS n FROM spins GROUP BY prize_code").all(),
    db.prepare("SELECT area, prize_code, COUNT(*) AS n FROM spins GROUP BY area, prize_code").all(),
    db.prepare("SELECT day, prize_code, COUNT(*) AS n FROM spins GROUP BY day, prize_code ORDER BY day DESC").all(),
    db.prepare("SELECT COUNT(*) AS n FROM spins WHERE rolled_code <> prize_code").first(),
    stockInfo(db),
  ]);

  const total = byPrize.reduce((s, r) => s + r.n, 0);
  const weightSum = PRIZES.reduce((s, p) => s + p.weight, 0);
  const prizes = PRIZES.map((p) => {
    const n = (byPrize.find((r) => r.prize_code === p.code) || {}).n || 0;
    return { code: p.code, name: p.name, count: n, config_rate: p.weight / weightSum, actual_rate: total ? n / total : 0 };
  });

  const areas = AREAS.map((a) => {
    const counts = {};
    let sum = 0;
    for (const p of PRIZES) {
      const n = (byAreaPrize.find((r) => r.area === a && r.prize_code === p.code) || {}).n || 0;
      counts[p.code] = n;
      sum += n;
    }
    return { area: a, total: sum, counts };
  });

  const dayMap = new Map();
  for (const r of byDayPrize) {
    if (!dayMap.has(r.day)) dayMap.set(r.day, { day: r.day, total: 0, counts: {} });
    const d = dayMap.get(r.day);
    d.counts[r.prize_code] = r.n;
    d.total += r.n;
  }

  return json({
    result: "ok",
    now: vnNow(),
    open: isOpen(),
    program: { start: PROGRAM_START, end: PROGRAM_END },
    total,
    swapped_to_voucher: swapped ? swapped.n : 0,
    prizes,
    areas,
    days: [...dayMap.values()],
    stock,
  });
}

async function handleList(env) {
  const { results } = await env.DB.prepare(
    `SELECT created_at, day, name, phone, area, area_other, prize_code, prize_name, rolled_code, claim_code, src
     FROM spins ORDER BY id DESC`
  ).all();
  return json({ result: "ok", rows: results });
}

async function handleExport(env) {
  const { results } = await env.DB.prepare(
    "SELECT created_at, name, phone, area, area_other, prize_name, rolled_code, prize_code, claim_code, src FROM spins ORDER BY id"
  ).all();
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Thời gian", "Họ tên", "Số điện thoại", "Khu vực", "Khu vực tự nhập (Khác)", "Quà nhận", "Quà quay ra ban đầu", "Mã nhận quà", "Nguồn QR"];
  const lines = [head.map(cell).join(",")];
  for (const r of results) {
    const rolled = r.rolled_code !== r.prize_code ? (prizeByCode(r.rolled_code) || {}).name || r.rolled_code : "";
    // SĐT bọc ="0..." để Excel giữ số 0 đầu
    lines.push([r.created_at, r.name, `="${r.phone}"`, r.area, r.area_other, r.prize_name, rolled, r.claim_code, r.src].map(cell).join(","));
  }
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vong-quay-${vnNow().slice(0, 10)}.csv"`,
      ...CORS,
    },
  });
}

// ===== TỰ TẠO BẢNG (lần đầu mỗi isolate; an toàn khi chạy lại) – giống schema.sql =====
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS spins (
     id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, day TEXT NOT NULL,
     name TEXT NOT NULL, phone TEXT NOT NULL, phone_key TEXT NOT NULL UNIQUE,
     area TEXT NOT NULL, area_other TEXT NOT NULL DEFAULT '',
     prize_code TEXT NOT NULL, prize_name TEXT NOT NULL, rolled_code TEXT NOT NULL,
     claim_code TEXT NOT NULL UNIQUE, src TEXT NOT NULL DEFAULT '')`,
  "CREATE INDEX IF NOT EXISTS idx_spins_prize ON spins (prize_code)",
  "CREATE INDEX IF NOT EXISTS idx_spins_day ON spins (day)",
  "CREATE TABLE IF NOT EXISTS stock (prize_code TEXT PRIMARY KEY, total INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT '')",
  "INSERT OR IGNORE INTO stock (prize_code, total, updated_at) VALUES ('AOMUA', 0, ''), ('MUBH', 0, '')",
];
let schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch(SCHEMA.map((s) => db.prepare(s))).catch((err) => {
      schemaReady = null; // lỗi thì lần sau thử lại
      throw err;
    });
  }
  return schemaReady;
}

// ===== ROUTER =====
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    // Chạy chung Worker với giao diện tĩnh (wrangler.jsonc → assets): mọi API nằm dưới /api
    let path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/api" || path.startsWith("/api/")) path = path.slice(4) || "/";
    try {
      await ensureSchema(env.DB);
      if (request.method === "POST") {
        if (path === "/check") return await handleCheck(request, env);
        if (path === "/spin") return await handleSpin(request, env, ctx);
        if (path === "/admin/stock") return await handleStockPost(request, env);
      }
      if (request.method === "GET") {
        if (path === "/admin/stock") return await handleStockGet(env, url);
        const action = url.searchParams.get("action");
        if (action === "summary" || action === "list" || action === "export") {
          if (!checkKey(env, url.searchParams.get("key"))) return json({ result: "error", message: "Sai hoặc thiếu key" }, 403);
          if (action === "summary") return await handleSummary(env);
          if (action === "list") return await handleList(env);
          return await handleExport(env);
        }
        if (path === "/") return json({ result: "ok", open: isOpen() });
      }
      return json({ result: "error", message: "Không hỗ trợ" }, 404);
    } catch (err) {
      console.error(err);
      return json({ result: "error", message: "Lỗi máy chủ" }, 500);
    }
  },
};
