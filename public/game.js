/* game.js – Vòng quay may mắn (FPT Telecom). Đặc tả: yeucau.md mục 2, 3, 5. */
(() => {
  "use strict";

  // ===================== CẤU HÌNH =====================
  // "/api" = Worker chạy cùng domain với trang (Cloudflare, xem wrangler.jsonc).
  // Để trống "" = CHẾ ĐỘ DEMO (random trên máy, chỉ để thử giao diện – không dùng khi chạy thật).
  const API_BASE = "/api";

  // Thứ tự = thứ tự ô trên vòng quay, PHẢI khớp PRIZES trong minigames/worker/worker.js.
  // Tỉ lệ chỉ dùng cho chế độ demo; khi chạy thật Worker quyết định kết quả.
  const PRIZES = [
    { code: "V150",     name: "Voucher 150.000đ", short: ["VOUCHER", "150K"], value: "150.000", kind: "voucher", weight: 6134, fill: "#FFE042", text: "#C2410C" },
    { code: "MOCKHOA",  name: "Móc khoá",         short: ["MÓC", "KHOÁ"],     icon: "ic-keychain", kind: "gift", weight: 200, fill: "#F27321", text: "#FFFFFF" },
    { code: "V200",     name: "Voucher 200.000đ", short: ["VOUCHER", "200K"], value: "200.000", kind: "voucher", weight: 2044, fill: "#FBB117", text: "#C2410C" },
    { code: "NON",      name: "Nón",              short: ["", "NÓN"],         icon: "ic-cap",      kind: "gift", weight: 200, fill: "#E8521E", text: "#FFFFFF" },
    { code: "V300",     name: "Voucher 300.000đ", short: ["VOUCHER", "300K"], value: "300.000", kind: "voucher", weight: 1022, fill: "#FFC629", text: "#C2410C" },
    { code: "BINHNUOC", name: "Bình nước",        short: ["BÌNH", "NƯỚC"],    icon: "ic-bottle",   kind: "gift", weight: 200, fill: "#F27321", text: "#FFFFFF" },
    { code: "TUI",      name: "Túi",              short: ["", "TÚI"],         icon: "ic-bag",      kind: "gift", weight: 200, fill: "#D9461A", text: "#FFFFFF" },
  ];
  const AREAS = ["Tân Bình", "Quận 4", "Quận 6", "Khác"]; // "Khác" → người chơi tự nhập khu vực
  const FIELDS = ["name", "phone", "area", "areaOther", "consent"];
  /** Khu vực để hiển thị: chọn "Khác" thì hiện nội dung tự nhập. */
  const areaLabel = (rec) => (rec.area === "Khác" && rec.area_other ? rec.area_other : rec.area || "");
  const SLICE = 360 / PRIZES.length;
  const STORE_KEY = "vq2_result_v1";
  const SOUND_KEY = "vq_sound";
  const DEMO = !API_BASE;

  // ===================== TIỆN ÍCH =====================
  const $ = (sel) => document.querySelector(sel);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
  };

  function normalizePhone(raw) {
    let d = String(raw || "").replace(/[\s.\-()]/g, "");
    if (d.startsWith("+")) d = d.slice(1);
    if (!/^\d+$/.test(d)) return "";
    if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
    return /^0\d{9}$/.test(d) ? d : "";
  }
  const normalizeName = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const maskPhone = (p) => (p && p.length >= 7 ? p.slice(0, 3) + "****" + p.slice(-3) : p || "");
  function fmtTime(t) {
    // "yyyy-MM-dd HH:mm:ss" → "HH:mm – dd/MM/yyyy"
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(t || "");
    return m ? `${m[4]}:${m[5]} – ${m[3]}/${m[2]}/${m[1]}` : t || "";
  }
  const prizeByCode = (c) => PRIZES.find((p) => p.code === c);
  const srcParam = (new URLSearchParams(location.search).get("src") || "").replace(/[^\w\-]/g, "").slice(0, 40);
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function cssDurationMs(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v) return fallback;
    const n = parseFloat(v);
    return v.endsWith("ms") ? n : n * 1000;
  }

  // ===================== API =====================
  class NetError extends Error {}

  async function post(path, body) {
    let res;
    try {
      res = await fetch(API_BASE.replace(/\/+$/, "") + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new NetError("network");
    }
    let data = null;
    try { data = await res.json(); } catch { /* bỏ qua */ }
    if (!data) throw new NetError("bad-response");
    if (res.status >= 500) throw new NetError(data.message || "server");
    return data;
  }

  // ----- Demo: mô phỏng Worker trên máy (localStorage) -----
  const demo = {
    db() { return store.get("vq2_demo_db") || { spins: {}, stock: { MOCKHOA: 3, NON: 3, BINHNUOC: 3, TUI: 3 } }; },
    save(db) { store.set("vq2_demo_db", db); },
    pick(list) {
      const total = list.reduce((s, p) => s + p.weight, 0);
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      let r = buf[0] % total;
      for (const p of list) { if (r < p.weight) return p; r -= p.weight; }
      return list[list.length - 1];
    },
    code() {
      const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const buf = new Uint32Array(6);
      crypto.getRandomValues(buf);
      return "QT-" + [...buf].map((n) => a[n % a.length]).join("");
    },
    now() {
      return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
    },
    pub(r) {
      return { prize_code: r.prize_code, prize_name: r.prize_name, slot: PRIZES.findIndex((p) => p.code === r.prize_code), claim_code: r.claim_code, created_at: r.created_at, area: r.area, area_other: r.area_other || "" };
    },
    wait: () => new Promise((r) => setTimeout(r, 350)),
    async check({ phone }) {
      await this.wait();
      const p = normalizePhone(phone);
      if (!p) return { result: "error", message: "Số điện thoại không hợp lệ" };
      const r = this.db().spins[p.slice(-9)];
      return r ? { result: "ok", open: true, played: true, ...this.pub(r) } : { result: "ok", open: true, played: false };
    },
    async spin({ name, phone, area, area_other }) {
      await this.wait();
      const db = this.db();
      const key = normalizePhone(phone).slice(-9);
      if (db.spins[key]) return { result: "duplicate", ...this.pub(db.spins[key]) };
      const rolled = this.pick(PRIZES);
      let prize = rolled;
      if (rolled.kind === "gift") {
        const used = Object.values(db.spins).filter((s) => s.prize_code === rolled.code).length;
        if (used >= (db.stock[rolled.code] || 0)) prize = this.pick(PRIZES.filter((p) => p.kind === "voucher"));
      }
      const row = { name, phone, area, area_other: area === "Khác" ? area_other : "", prize_code: prize.code, prize_name: prize.name, rolled_code: rolled.code, claim_code: this.code(), created_at: this.now() };
      db.spins[key] = row;
      this.save(db);
      // ?demo_fail=1 → giả lập mất mạng SAU khi server đã ghi, để thử nút "Thử lại"
      if (new URLSearchParams(location.search).get("demo_fail") === "1" && !sessionStorage.getItem("vq_failed")) {
        sessionStorage.setItem("vq_failed", "1");
        throw new NetError("demo");
      }
      return { result: "success", ...this.pub(row) };
    },
  };

  const api = {
    check: (body) => (DEMO ? demo.check(body) : post("/check", body)),
    spin: (body) => (DEMO ? demo.spin(body) : post("/spin", body)),
  };

  // ===================== ÂM THANH =====================
  const sound = {
    ctx: null,
    on: store.get(SOUND_KEY) !== false,
    unlock() {
      if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    },
    tone(freq, start, dur, type = "square", vol = 0.08) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + start;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    tick() { this.tone(1400, 0, 0.035, "square", 0.05); },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.12, 0.22, "triangle", 0.12));
      [784, 1047, 1319].forEach((f) => this.tone(f, 0.55, 0.6, "triangle", 0.07));
    },
  };

  function renderSoundButton() {
    const b = $("#btn-sound");
    b.setAttribute("aria-pressed", String(sound.on));
    b.setAttribute("aria-label", sound.on ? "Tắt âm thanh" : "Bật âm thanh");
  }

  // ===================== VÒNG QUAY (SVG) =====================
  const SVGNS = "http://www.w3.org/2000/svg";
  const C = 200;
  const polar = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  };
  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildWheel(container, idPrefix) {
    const svg = el("svg", { viewBox: "-10 -30 420 440", "aria-hidden": "true" });
    const defs = el("defs", {}, svg);
    const rim = el("linearGradient", { id: idPrefix + "-rim", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": "#F8981D" }, rim);
    el("stop", { offset: "1", "stop-color": "#E8521E" }, rim);
    const ptr = el("linearGradient", { id: idPrefix + "-ptr", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": "#FFE9B8" }, ptr);
    el("stop", { offset: "1", "stop-color": "#FFC629" }, ptr);

    // Viền ngoài
    el("circle", { cx: C, cy: C, r: 198, fill: `url(#${idPrefix}-rim)` }, svg);
    el("circle", { cx: C, cy: C, r: 172, fill: "#FFF5D7" }, svg);

    // Rotor: 7 ô bằng nhau
    const rotor = el("g", { class: "wheel-rotor" }, svg);
    const R = 168;
    PRIZES.forEach((p, i) => {
      const a0 = i * SLICE - SLICE / 2;
      const a1 = i * SLICE + SLICE / 2;
      const [x0, y0] = polar(R, a0);
      const [x1, y1] = polar(R, a1);
      el("path", { d: `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`, fill: p.fill, stroke: "#FFF5D7", "stroke-width": 3 }, rotor);

      const g = el("g", { transform: `rotate(${i * SLICE} ${C} ${C})` }, rotor);
      if (p.kind === "gift") {
        // ô quà hiện vật nổi bật hơn: viền sáng + ngôi sao
        el("path", { d: `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`, fill: "none", stroke: "#FFE042", "stroke-width": 5, transform: `rotate(${-i * SLICE} ${C} ${C})`, "stroke-linejoin": "round" }, g);
        const use = el("use", { href: "#" + p.icon, x: C - 24, y: 48, width: 48, height: 48 }, g);
        use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + p.icon);
        el("text", { x: C, y: 45, class: "slice-label", "font-size": 14, fill: "#FFE042" }, g).textContent = "★";
      } else {
        const use = el("use", { href: "#ic-voucher", x: C - 24, y: 56, width: 48, height: 30 }, g);
        use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#ic-voucher");
      }
      el("text", { x: C, y: 116, class: "slice-label", "font-size": p.kind === "gift" ? 17 : 15, fill: p.text }, g).textContent = p.short[0];
      el("text", { x: C, y: p.kind === "gift" ? 136 : 140, class: "slice-label", "font-size": p.kind === "gift" ? 17 : 26, fill: p.text }, g).textContent = p.short[1];
    });
    el("circle", { cx: C, cy: C, r: 40, fill: "#FFE042", stroke: "#F27321", "stroke-width": 4 }, rotor);

    // Bóng đèn (đứng yên, ngoài rotor)
    for (let k = 0; k < 10; k++) {
      const [x, y] = polar(185, k * 36 + 18);
      el("circle", { cx: x, cy: y, r: 6.5, class: "bulb" + (k % 2 ? " alt" : "") }, svg);
    }

    // Kim chỉ ở đỉnh
    el("path", {
      d: `M${C - 26} -22 h52 a6 6 0 0 1 6 6 v14 l-26 40 l-26 -40 v-14 a6 6 0 0 1 6 -6z`,
      fill: `url(#${idPrefix}-ptr)`, stroke: "#F27321", "stroke-width": 4, "stroke-linejoin": "round",
    }, svg);

    container.innerHTML = "";
    container.appendChild(svg);
    return rotor;
  }

  const wheel = {
    rotor: null,
    angle: 0,
    set(a) {
      this.angle = a;
      this.rotor.setAttribute("transform", `rotate(${a} ${C} ${C})`);
    },
    /** Quay đến ô `slot`, trả Promise khi dừng. */
    spinTo(slot) {
      const dur = cssDurationMs("--dur-spin", 5000);
      const turns = reduceMotion ? 3 : 6;
      const jitter = (Math.random() - 0.5) * (SLICE * 0.6); // lệch ngẫu nhiên trong ô cho tự nhiên
      const targetMod = (((-slot * SLICE + jitter) % 360) + 360) % 360;
      const curMod = ((this.angle % 360) + 360) % 360;
      const delta = turns * 360 + ((targetMod - curMod + 360) % 360);
      const from = this.angle;
      const to = from + delta;
      const ease = (t) => 1 - Math.pow(1 - t, 4);
      const sliceIdx = (a) => Math.floor((a + SLICE / 2) / SLICE);
      let lastIdx = sliceIdx(from);
      return new Promise((resolve) => {
        const t0 = performance.now();
        const frame = (now) => {
          const t = Math.min(1, (now - t0) / dur);
          const a = from + delta * ease(t);
          this.set(a);
          const idx = sliceIdx(a);
          if (idx !== lastIdx) { lastIdx = idx; sound.tick(); }
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
    },
  };

  // ===================== MÀN HÌNH =====================
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => { s.hidden = s.dataset.screen !== name; });
    window.scrollTo(0, 0);
  }

  // ===================== FORM =====================
  const form = $("#player-form");
  const touched = new Set();

  function readForm() {
    const area = $("#f-area").value || "";
    return {
      name: normalizeName($("#f-name").value),
      rawPhone: $("#f-phone").value,
      phone: normalizePhone($("#f-phone").value),
      area,
      areaOther: area === "Khác" ? normalizeName($("#f-area-other").value) : "",
      consent: $("#f-consent").checked,
    };
  }

  /** Hiện / ẩn ô nhập tay khi chọn "Khác". */
  function syncAreaOther() {
    const show = $("#f-area").value === "Khác";
    const wasHidden = $("#field-area-other").hidden;
    $("#field-area-other").hidden = !show;
    if (show && wasHidden) $("#f-area-other").focus();
    if (!show) touched.delete("areaOther");
  }

  function validate(v) {
    const e = {};
    if (!v.name) e.name = "Vui lòng nhập họ và tên";
    else if (v.name.length < 2) e.name = "Họ tên tối thiểu 2 ký tự";
    else if (v.name.length > 50) e.name = "Họ tên tối đa 50 ký tự";
    if (!v.rawPhone.trim()) e.phone = "Vui lòng nhập số điện thoại";
    else if (!v.phone) e.phone = "Số điện thoại phải gồm 10 số, bắt đầu bằng 0";
    if (!AREAS.includes(v.area)) e.area = "Vui lòng chọn khu vực";
    else if (v.area === "Khác") {
      if (!v.areaOther) e.areaOther = "Vui lòng nhập khu vực";
      else if (v.areaOther.length < 2) e.areaOther = "Khu vực tối thiểu 2 ký tự";
      else if (v.areaOther.length > 50) e.areaOther = "Khu vực tối đa 50 ký tự";
    }
    if (!v.consent) e.consent = "Vui lòng đồng ý để tiếp tục";
    return e;
  }

  function renderErrors() {
    const errs = validate(readForm());
    for (const f of FIELDS) {
      const msg = touched.has(f) ? errs[f] || "" : "";
      $("#err-" + f).textContent = msg;
      $("#err-" + f).closest(".field").classList.toggle("has-error", Boolean(msg));
    }
    $("#btn-start").disabled = Object.keys(errs).length > 0;
    return errs;
  }

  function showFormAlert(msg) {
    const a = $("#form-alert");
    a.textContent = msg || "";
    a.hidden = !msg;
  }

  form.addEventListener("input", (ev) => {
    const n = ev.target.name;
    // Lỗi đã hiện thì cập nhật ngay khi gõ; chưa hiện thì chờ rời ô
    if (n === "area" || n === "consent") touched.add(n);
    if (n === "area") syncAreaOther();
    showFormAlert("");
    renderErrors();
  });
  form.addEventListener("change", (ev) => {
    // một số trình duyệt di động chỉ phát "change" (không phát "input") cho <select>
    if (ev.target.name === "area") { touched.add("area"); syncAreaOther(); renderErrors(); }
  });
  form.addEventListener("focusout", (ev) => {
    if (["name", "phone", "areaOther"].includes(ev.target.name)) {
      touched.add(ev.target.name);
      renderErrors();
    }
  });

  let player = null;

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    FIELDS.forEach((f) => touched.add(f));
    if (Object.keys(renderErrors()).length) return;
    const v = readForm();
    const btn = $("#btn-start");
    btn.disabled = true;
    btn.textContent = "Đang kiểm tra…";
    showFormAlert("");
    try {
      const r = await api.check({ phone: v.phone });
      if (r.result !== "ok") {
        showFormAlert(r.message || "Có lỗi, vui lòng thử lại");
      } else if (r.played) {
        const rec = { ...r, name: "", phone: v.phone };
        store.set(STORE_KEY, rec);
        showResult(rec, { duplicate: true });
      } else if (!r.open) {
        showFormAlert("Chương trình hiện chưa mở hoặc đã kết thúc.");
      } else {
        player = { name: v.name, phone: v.phone, area: v.area, area_other: v.areaOther, src: srcParam };
        enterWheel();
      }
    } catch {
      showFormAlert("Mất kết nối, vui lòng thử lại");
    } finally {
      btn.textContent = "Bắt đầu quay";
      renderErrors();
    }
  });

  // ===================== QUAY =====================
  let spinning = false;

  function enterWheel() {
    $("#spin-error").hidden = true;
    $("#btn-spin").disabled = false;
    $("#wheel-hint").textContent = "Bấm QUAY để thử vận may!";
    showScreen("wheel");
  }

  function lockNavigation(on) {
    spinning = on;
    $("#wheel-play").classList.toggle("is-spinning", on);
    if (on) history.pushState({ spinning: true }, "");
  }
  window.addEventListener("popstate", () => {
    if (spinning) history.pushState({ spinning: true }, ""); // chặn nút Back khi đang quay
  });
  window.addEventListener("beforeunload", (e) => {
    if (spinning) { e.preventDefault(); e.returnValue = ""; }
  });

  async function doSpin() {
    if (spinning || !player) return;
    sound.unlock();
    lockNavigation(true);
    $("#btn-spin").disabled = true;
    $("#spin-error").hidden = true;
    $("#wheel-hint").textContent = "Đang quay…";

    let r;
    try {
      r = await api.spin(player);
    } catch {
      lockNavigation(false);
      $("#btn-spin").disabled = false;
      $("#wheel-hint").textContent = "Bấm QUAY để thử vận may!";
      $("#spin-error").querySelector("p").textContent = "Mất kết nối, vui lòng thử lại";
      $("#btn-retry").hidden = false;
      $("#spin-error").hidden = false;
      return;
    }

    if (r.result === "success" || r.result === "duplicate") {
      // "duplicate" ở đây = lượt đã được ghi ở lần bấm trước (vd mất mạng lúc nhận kết quả) → vẫn là kết quả của người chơi này
      const rec = { ...r, name: player.name, phone: player.phone, area: r.area || player.area, area_other: r.area ? r.area_other || "" : player.area_other };
      store.set(STORE_KEY, rec); // lưu ngay để tải lại trang vẫn thấy kết quả
      await wheel.spinTo(r.slot >= 0 ? r.slot : PRIZES.findIndex((p) => p.code === r.prize_code));
      lockNavigation(false);
      sound.fanfare();
      showResult(rec, { duplicate: false });
      return;
    }

    lockNavigation(false);
    $("#wheel-hint").textContent = "Bấm QUAY để thử vận may!";
    if (r.result === "closed") {
      $("#spin-error").querySelector("p").textContent = "Chương trình hiện chưa mở hoặc đã kết thúc.";
      $("#btn-retry").hidden = true;
    } else {
      $("#spin-error").querySelector("p").textContent = r.message || "Có lỗi, vui lòng thử lại";
      $("#btn-retry").hidden = false;
      $("#btn-spin").disabled = false;
    }
    $("#spin-error").hidden = false;
  }

  // ===================== KẾT QUẢ =====================
  function prizeVisual(p) {
    const box = $("#result-prize");
    box.innerHTML = "";
    if (!p) return;
    if (p.kind === "voucher") {
      const t = document.createElement("div");
      t.className = "voucher-ticket";
      t.innerHTML = "<span>Voucher</span><b></b>";
      t.querySelector("b").innerHTML = `${p.value}<sup>đ</sup>`;
      box.appendChild(t);
    } else {
      const d = document.createElement("div");
      d.className = "gift-big";
      d.innerHTML = `<svg viewBox="0 0 64 64"><use href="#${p.icon}"/></svg>`;
      box.appendChild(d);
    }
  }

  let current = null;

  function showResult(rec, { duplicate, fromReload } = {}) {
    current = rec;
    const p = prizeByCode(rec.prize_code);
    const modal = $(".result-modal");
    modal.classList.toggle("is-duplicate", Boolean(duplicate));
    $("#result-title").textContent = duplicate ? "Số điện thoại này đã tham gia" : "Chúc mừng!";
    $("#result-sub").textContent = duplicate ? "Phần quà bạn đã trúng trước đó" : "Bạn đã trúng";
    prizeVisual(p);
    $("#result-prize-name").textContent = rec.prize_name || (p && p.name) || "";
    $("#row-name").hidden = !rec.name;
    $("#r-name").textContent = rec.name || "";
    $("#r-phone").textContent = maskPhone(rec.phone);
    $("#r-area").textContent = areaLabel(rec);
    $("#r-time").textContent = fmtTime(rec.created_at);
    $("#r-code").textContent = rec.claim_code || "";
    $("#btn-close-dup").hidden = !duplicate;
    $("#result-modal").hidden = false;
    document.body.classList.add("is-locked");
    if (!duplicate && !fromReload) confetti();
  }

  function hideResult() {
    $("#result-modal").hidden = true;
    document.body.classList.remove("is-locked");
  }

  // ----- Pháo giấy -----
  function confetti() {
    if (reduceMotion) return;
    const cv = $("#confetti");
    const ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#FFE042", "#FFC629", "#F58220", "#FFFFFF", "#E8521E", "#FFF1A8"];
    const parts = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      s: 6 + Math.random() * 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 3200);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 3200) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  // ----- Lưu ảnh kết quả (vẽ canvas, không cần thư viện) -----
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  async function renderResultImage(rec) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch { /* bỏ qua */ } }
    const W = 720, H = 1080;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const display = "'Baloo 2', 'Be Vietnam Pro', sans-serif";
    const text = "'Be Vietnam Pro', sans-serif";

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#F8981D"); bg.addColorStop(0.45, "#F58220"); bg.addColorStop(1, "#F27321");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // header logo
    const logo = await loadImage("assets/logo-ftel30.png");
    const lh = 60, lw = logo ? (lh * logo.width) / logo.height : 276;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, 40, -24, lw + 48, lh + 64, 24); ctx.fill();
    if (logo) ctx.drawImage(logo, 64, 16, lw, lh);

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF"; ctx.font = `800 54px ${display}`;
    ctx.fillText("VÒNG QUAY MAY MẮN", W / 2, 175);

    // thẻ kem
    ctx.fillStyle = "#FFFBEC";
    roundRect(ctx, 40, 215, W - 80, 820, 36); ctx.fill();

    ctx.fillStyle = "#F27321"; ctx.font = `800 48px ${display}`;
    ctx.fillText("CHÚC MỪNG!", W / 2, 295);
    ctx.fillStyle = "#5C2D0A"; ctx.font = `500 26px ${text}`;
    ctx.fillText("Bạn đã trúng", W / 2, 340);

    // vé quà
    const vg = ctx.createLinearGradient(0, 370, 0, 490);
    vg.addColorStop(0, "#FFE042"); vg.addColorStop(1, "#FBB117");
    ctx.fillStyle = vg; roundRect(ctx, 150, 370, W - 300, 120, 22); ctx.fill();
    ctx.fillStyle = "#C2410C"; ctx.font = `800 50px ${display}`;
    ctx.fillText(rec.prize_name || "", W / 2, 448, W - 330);

    // thông tin
    const rows = [["Họ tên", rec.name], ["Số điện thoại", maskPhone(rec.phone)], ["Khu vực", areaLabel(rec)], ["Thời gian", fmtTime(rec.created_at)]].filter((r) => r[1]);
    ctx.fillStyle = "#FFFFFF"; roundRect(ctx, 80, 520, W - 160, 60 * rows.length + 20, 20); ctx.fill();
    rows.forEach(([k, v], i) => {
      const y = 568 + i * 60;
      ctx.textAlign = "left"; ctx.fillStyle = "#8A5A35"; ctx.font = `500 26px ${text}`;
      ctx.fillText(k, 110, y);
      ctx.textAlign = "right"; ctx.fillStyle = "#3D1A02"; ctx.font = `700 26px ${text}`;
      ctx.fillText(v, W - 110, y, 330);
    });

    // mã nhận quà
    const cy = 540 + 60 * rows.length + 30;
    ctx.setLineDash([12, 8]); ctx.lineWidth = 4; ctx.strokeStyle = "#F8981D";
    ctx.fillStyle = "#FFFFFF"; roundRect(ctx, 140, cy, W - 280, 130, 20); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = "center"; ctx.fillStyle = "#8A5A35"; ctx.font = `600 22px ${text}`;
    ctx.fillText("Mã nhận quà", W / 2, cy + 42);
    ctx.fillStyle = "#E8521E"; ctx.font = `800 52px ${display}`;
    ctx.fillText(rec.claim_code || "", W / 2, cy + 102);

    ctx.fillStyle = "#5C2D0A"; ctx.font = `600 22px ${text}`;
    ctx.fillText("Vui lòng đưa màn hình này cho nhân viên", W / 2, cy + 180);
    ctx.fillText("để nhận quà ngay tại chỗ.", W / 2, cy + 212);

    ctx.fillStyle = "#FFFFFF"; ctx.font = `800 30px ${display}`;
    ctx.fillText("Hotline 1900 6600 · fpt.vn", W / 2, H - 14);

    return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
  }

  async function saveImage() {
    if (!current) return;
    const btn = $("#btn-save");
    btn.disabled = true;
    try {
      const blob = await renderResultImage(current);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vong-quay-${current.claim_code || "ket-qua"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Dự phòng cho trình duyệt không tự tải (vd Zalo, Facebook in-app): hiện ảnh để nhấn giữ lưu
      $("#saved-image").src = url;
      $("#image-modal").hidden = false;
    } finally {
      btn.disabled = false;
    }
  }

  // ===================== KHỞI ĐỘNG =====================
  function resetToIntro() {
    hideResult();
    showScreen("intro");
  }

  async function init() {
    $("#demo-banner").hidden = !DEMO;
    buildWheel($("#wheel-preview"), "wp");
    wheel.rotor = buildWheel($("#wheel-play"), "wq");
    renderSoundButton();
    renderErrors();

    $("#btn-join").addEventListener("click", () => { sound.unlock(); showScreen("form"); $("#f-name").focus(); });
    $("#btn-back-intro").addEventListener("click", () => showScreen("intro"));
    $("#btn-spin").addEventListener("click", doSpin);
    $("#btn-retry").addEventListener("click", doSpin);
    $("#btn-save").addEventListener("click", saveImage);
    $("#btn-close-dup").addEventListener("click", () => { hideResult(); store.del(STORE_KEY); showScreen("form"); });
    $("#btn-close-image").addEventListener("click", () => {
      $("#image-modal").hidden = true;
      const src = $("#saved-image").src;
      if (src.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(src), 1000);
    });
    $("#btn-sound").addEventListener("click", () => {
      sound.on = !sound.on;
      store.set(SOUND_KEY, sound.on);
      if (sound.on) { sound.unlock(); sound.tick(); }
      renderSoundButton();
    });

    // Tải lại trang: hiện lại kết quả đã lưu, rồi đối chiếu với server
    const saved = store.get(STORE_KEY);
    if (saved && saved.claim_code && saved.phone) {
      wheel.set(-(prizeByCode(saved.prize_code) ? PRIZES.indexOf(prizeByCode(saved.prize_code)) : 0) * SLICE);
      showScreen("wheel");
      $("#btn-spin").disabled = true;
      showResult(saved, { duplicate: !saved.name, fromReload: true });
      try {
        const r = await api.check({ phone: saved.phone });
        if (r.result === "ok" && r.played) {
          if (r.claim_code !== saved.claim_code || r.prize_code !== saved.prize_code) {
            const rec = { ...r, name: saved.name, phone: saved.phone };
            store.set(STORE_KEY, rec);
            showResult(rec, { duplicate: !saved.name, fromReload: true });
          }
        } else if (r.result === "ok" && !r.played) {
          store.del(STORE_KEY); // server không có lượt này (dữ liệu đã xoá) → cho chơi lại từ đầu
          resetToIntro();
        }
      } catch {
        /* mất mạng: giữ kết quả đã lưu trên máy */
      }
    } else {
      showScreen("intro");
    }
  }

  init();
})();
