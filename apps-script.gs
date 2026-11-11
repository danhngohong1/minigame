/**
 * Webhook nhận dữ liệu từ minigame "Tinh Hà FPT – Vũ trụ manifest".
 * Game gửi POST (text/plain) với body: { name, phone, reward, address, gift, fallback }
 *
 * Tab dữ liệu (tab đầu tiên, hoặc SHEET_NAME) – tự tạo dòng tiêu đề nếu đang trống:
 *   A: Thời gian | B: Người nhận thông điệp | C: Số liên lạc | D: Phần thưởng | E: Địa chỉ gửi thông điệp
 *
 * Tab "Tổng hợp" – tự tạo và tự cập nhật sau mỗi lượt chơi: mỗi ngày 1 dòng
 *   Ngày | Lượt chơi | Tổng quà | Nón bảo hiểm | Sạc dự phòng | Túi Canvas | Lời chúc | Quà còn lại
 *   Muốn tính lại toàn bộ: menu "Tinh Hà FPT → Cập nhật tab Tổng hợp" (hoặc chạy hàm capNhatTongHop).
 *
 * Giới hạn 50 quà hiện vật/ngày (giờ Việt Nam): hết quà → người chơi nhận lời chúc + tem chứng nhận.
 *
 * Sau khi sửa file này: Deploy → Manage deployments → Edit → Version: New version → Deploy (giữ nguyên URL).
 */

const SHEET_NAME = "";            // Để trống = dùng tab đầu tiên (không tính tab Tổng hợp). Hoặc ghi tên tab, ví dụ "Data".
const SUMMARY_NAME = "Tổng hợp";  // Tên tab tổng hợp theo ngày
const DAILY_GIFT_LIMIT = 50;
const TZ = "Asia/Ho_Chi_Minh";

const HEADERS = ["Thời gian", "Người nhận thông điệp", "Số liên lạc", "Phần thưởng", "Địa chỉ gửi thông điệp"];
const SUMMARY_HEADERS = ["Ngày", "Lượt chơi", "Tổng quà", "Nón bảo hiểm", "Sạc dự phòng", "Túi Canvas", "Lời chúc", "Quà còn lại"];
const GIFT_TYPES = ["Nón bảo hiểm", "Sạc dự phòng", "Túi Canvas"];

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (SHEET_NAME) return ss.getSheetByName(SHEET_NAME);
  return ss.getSheets().filter(s => s.getName() !== SUMMARY_NAME)[0];
}

const dayKey = (d) => Utilities.formatDate(d, TZ, "yyyy-MM-dd");

// Phần thưởng là quà hiện vật nếu không phải "Lời chúc: ..."
function isGift(reward) {
  const r = String(reward || "").trim();
  return r !== "" && r.indexOf("Lời chúc") !== 0;
}

// Đếm số quà hiện vật đã trao trong ngày hôm nay (cột A = thời gian, cột D = phần thưởng)
function giftsToday(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const today = dayKey(new Date());
  const rows = sheet.getRange(2, 1, last - 1, 4).getValues();
  let n = 0;
  for (const r of rows) {
    if (r[0] instanceof Date && dayKey(r[0]) === today && isGift(r[3])) n++;
  }
  return n;
}

// Dựng lại toàn bộ tab "Tổng hợp" từ tab dữ liệu (ngày mới nhất ở trên cùng)
function capNhatTongHop() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = getSheet();
  let sum = ss.getSheetByName(SUMMARY_NAME);
  if (!sum) sum = ss.insertSheet(SUMMARY_NAME, ss.getSheets().length); // đặt ở cuối để không thành tab đầu tiên

  const byDay = {};
  const last = data.getLastRow();
  if (last >= 2) {
    const rows = data.getRange(2, 1, last - 1, 4).getValues();
    for (const r of rows) {
      if (!(r[0] instanceof Date)) continue;
      const k = dayKey(r[0]);
      const d = byDay[k] || (byDay[k] = { plays: 0, gifts: 0, types: [0, 0, 0], wishes: 0 });
      d.plays++;
      const reward = String(r[3] || "").trim();
      if (isGift(reward)) {
        d.gifts++;
        const t = GIFT_TYPES.findIndex(g => reward.indexOf(g) === 0);
        if (t !== -1) d.types[t]++;
      } else {
        d.wishes++;
      }
    }
  }

  const days = Object.keys(byDay).sort().reverse();
  const out = days.map(k => {
    const d = byDay[k], p = k.split("-");
    return [p[2] + "/" + p[1] + "/" + p[0], d.plays, d.gifts, d.types[0], d.types[1], d.types[2], d.wishes,
      Math.max(0, DAILY_GIFT_LIMIT - d.gifts)];
  });
  // Dòng tổng cộng
  const total = out.reduce((a, r) => { for (let i = 1; i <= 6; i++) a[i] += r[i]; return a; }, ["Tổng cộng", 0, 0, 0, 0, 0, 0, ""]);

  sum.clear(); // xoá cả nội dung lẫn định dạng cũ
  sum.getRange(1, 1, sum.getMaxRows(), 1).setNumberFormat("@"); // cột Ngày dạng chữ, tránh Sheets đảo ngày/tháng
  sum.getRange(1, 1, 1, SUMMARY_HEADERS.length).setValues([SUMMARY_HEADERS])
    .setFontWeight("bold").setBackground("#F37021").setFontColor("#FFFFFF");
  sum.getRange(2, 1, 1, SUMMARY_HEADERS.length).setValues([total]).setFontWeight("bold").setBackground("#FFE8DA");
  if (out.length) sum.getRange(3, 1, out.length, SUMMARY_HEADERS.length).setValues(out);
  sum.setFrozenRows(2);
  sum.autoResizeColumns(1, SUMMARY_HEADERS.length);
}

// Thêm menu trong Google Sheet để cập nhật tab Tổng hợp bằng tay
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Tinh Hà FPT")
    .addItem("Cập nhật tab Tổng hợp", "capNhatTongHop")
    .addToUi();
}

// GET ?action=quota → { remaining, limit } (để kiểm tra nhanh số quà còn lại hôm nay)
function doGet(e) {
  try {
    const used = giftsToday(getSheet());
    return json({ result: "ok", remaining: Math.max(0, DAILY_GIFT_LIMIT - used), limit: DAILY_GIFT_LIMIT });
  } catch (err) {
    return json({ result: "error", message: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // tránh 2 người gửi cùng lúc ghi đè lên nhau
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    // Mỗi số điện thoại chỉ chơi 1 lần: số đã có ở cột C thì không ghi thêm.
    // So 9 số cuối để khớp cả những dòng cũ bị mất số 0 ở đầu.
    const phone = String(data.phone || "").replace(/\D/g, "");
    const lastRow = sheet.getLastRow();
    if (phone && lastRow > 1) {
      const used = sheet.getRange(2, 3, lastRow - 1, 1).getDisplayValues()
        .map(r => String(r[0]).replace(/\D/g, "").slice(-9));
      if (used.indexOf(phone.slice(-9)) !== -1) {
        return json({ result: "duplicate" });
      }
    }

    // Sheet trống thì tạo dòng tiêu đề; nếu đã có tiêu đề mà thiếu cột E thì thêm "Địa chỉ gửi thông điệp"
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    } else if (!sheet.getRange(1, 5).getValue()) {
      sheet.getRange(1, 5).setValue(HEADERS[4]).setFontWeight("bold");
    }

    // Giới hạn 50 quà/ngày: đã đủ thì đổi phần thưởng sang lời chúc (game gửi kèm "fallback")
    let reward = data.reward || "";
    let used = giftsToday(sheet);
    let gift = isGift(reward);
    if (gift && used >= DAILY_GIFT_LIMIT) {
      reward = data.fallback || "Lời chúc (hết quà trong ngày)";
      gift = false;
    }
    if (gift) used++;

    sheet.appendRow([
      new Date(),
      data.name || "",
      "'" + (data.phone || ""),   // dấu ' giữ số 0 ở đầu số điện thoại
      reward,
      data.address || ""          // địa chỉ (không bắt buộc, có thể trống)
    ]);

    // Cập nhật tab Tổng hợp; lỗi ở đây không làm hỏng lượt chơi
    try { capNhatTongHop(); } catch (err) { console.error(err); }

    return json({ result: "success", gift: gift, remaining: Math.max(0, DAILY_GIFT_LIMIT - used) });
  } catch (err) {
    return json({ result: "error", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}
