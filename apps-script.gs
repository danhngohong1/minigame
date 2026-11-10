/**
 * Webhook nhận dữ liệu từ minigame "Thông Điệp Vũ Trụ FPT – Chạm Là Đón Lộc".
 * Game gửi POST (text/plain) với body: { name, phone, reward, address }
 *
 * Cột trong Sheet (tự tạo dòng tiêu đề nếu Sheet đang trống):
 *   A: Thời gian | B: Người nhận thông điệp | C: Số liên lạc | D: Phần thưởng | E: Địa chỉ gửi thông điệp
 */

const SHEET_NAME = ""; // Để trống = dùng tab đầu tiên. Hoặc ghi tên tab, ví dụ "Data".

const HEADERS = ["Thời gian", "Người nhận thông điệp", "Số liên lạc", "Phần thưởng", "Địa chỉ gửi thông điệp"];

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // tránh 2 người gửi cùng lúc ghi đè lên nhau
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];

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

    sheet.appendRow([
      new Date(),
      data.name || "",
      "'" + (data.phone || ""),   // dấu ' giữ số 0 ở đầu số điện thoại
      data.reward || "",
      data.address || ""          // trường mới: địa chỉ (không bắt buộc, có thể trống)
    ]);

    return json({ result: "success" });
  } catch (err) {
    return json({ result: "error", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}
