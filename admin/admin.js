(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cfg = window.APP_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) { $("#setup").hidden = false; return; }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  const CATS = { it: "IT", lang: "Til kursi", exam: "Imtihonga tayyorlov" };
  const ICONS = { code: "💻 Kod", globe: "🌍 Globus", sigma: "∑ Matematika", hangul: "한 Hangul", chat: "💬 Suhbat", award: "🏅 Sertifikat" };
  const STATUS = { new: "Yangi", contacted: "Bog'lanildi", done: "Yakunlandi", rejected: "Rad etildi" };
  const LTYPE = { enroll: "Kursga yozilish", message: "Xabar", teacher: "Ustoz arizasi" };
  const state = { courses: [], statDays: 30 };

  /* ---------------- helpers ---------------- */
  const busy = (on) => $("#loading").classList.toggle("is-on", on);
  let toastT;
  const toast = (msg, err = false) => {
    const t = $("#toast"); t.textContent = msg; t.classList.toggle("is-err", err); t.classList.add("is-show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-show"), err ? 5000 : 2600);
  };
  const errText = (e) => {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login/i.test(m)) return "Login yoki parol noto'g'ri";
    if (/Email not confirmed/i.test(m)) return "Email tasdiqlanmagan (Supabase'da foydalanuvchini 'Auto Confirm User' bilan yarating)";
    if (/certificates_group_student_uq/i.test(m)) return "Bu o'quvchiga shu guruh bo'yicha sertifikat allaqachon yaratilgan";
    if (/duplicate key/i.test(m)) return "Bunday ID/kod allaqachon mavjud";
    if (/row-level security|not allowed|permission/i.test(m)) return "Ruxsat yo'q — hisobingiz admins jadvalida borligini tekshiring";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Internet yoki server bilan aloqa yo'q";
    if (/Could not find the (table|function)|does not exist|schema cache/i.test(m)) return "Bazada CRM jadvallari yo'q — Supabase SQL Editor'da supabase/crm.sql faylini ishga tushiring";
    return m;
  };
  async function q(builder) {
    busy(true);
    try { const r = await builder; if (r.error) throw r.error; return r.data; }
    catch (e) { toast(errText(e), true); throw e; }
    finally { busy(false); }
  }
  const imgUrl = (p) => !p ? "" : /^(https?:|data:)/.test(p) ? p : "../" + p.replace(/^\.?\//, "");
  const initials = (n) => String(n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const fmtDate = (d) => new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const fmtDay = (d) => new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  const UZ_M = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const UZ_W = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
  const longDay = (d, opts = {}) => {
    const x = new Date(String(d).slice(0, 10) + "T00:00:00");
    const day = opts.day === "2-digit" ? String(x.getDate()).padStart(2, "0") : x.getDate();
    const mon = opts.month === "short" ? UZ_M[x.getMonth()].slice(0, 3) : UZ_M[x.getMonth()];
    return `${opts.weekday ? UZ_W[x.getDay()] + ", " : ""}${day}-${mon}${opts.year ? " " + x.getFullYear() : ""}`;
  };
  const num = (n) => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const pctOf = (log) => (!log || !log.length) ? 0 : Math.round(log.filter((s) => s !== 0).length / log.length * 100);
  const downloadCSV = (name, rows) => {
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  // sanalar (mahalliy vaqt bo'yicha YYYY-MM-DD)
  const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  const today = () => iso(new Date());
  const parseDay = (s) => new Date(String(s).slice(0, 10) + "T00:00:00");
  const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, m) => { const d = parseDay(s), day = d.getDate(); d.setMonth(d.getMonth() + m); if (d.getDate() < day) d.setDate(0); return iso(d); };
  const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
  const WD = { 1: "Du", 2: "Se", 3: "Ch", 4: "Pa", 5: "Ju", 6: "Sh", 7: "Ya" };
  const dow = (s) => parseDay(s).getDay() || 7;
  // guruh jadvali bo'yicha dars kunlari
  const lessonDays = (g, until = g.end_date) => {
    const out = [], last = until < g.end_date ? until : g.end_date, set = new Set((g.days || []).map(Number));
    for (let d = g.start_date; d <= last; d = addDays(d, 1)) if (set.has(dow(d))) out.push(d);
    return out;
  };
  // Supabase bir so'rovda 1000 qatordan ko'p bermaydi — bo'lib olamiz
  async function fetchAll(make) {
    const out = [];
    for (let from = 0; ; from += 1000) { const d = await q(make().range(from, from + 999)); out.push(...d); if (d.length < 1000) break; }
    return out;
  }

  /* ---------------- modal ---------------- */
  const modal = $("#modal"), modalBody = $("#modalBody");
  let onModalClose = null;
  const openModal = (html, wide = false) => {
    $(".modal__box", modal).classList.toggle("is-wide", wide);
    modalBody.innerHTML = html; modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false");
    setTimeout(() => { const f = $("input:not([type=hidden]):not([type=file]):not([disabled]), select, textarea", modalBody); f && f.focus(); }, 60);
  };
  const closeModal = () => {
    modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true");
    const cb = onModalClose; onModalClose = null; cb && cb();
  };
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });
  const confirmDlg = (text, yes) => new Promise((res) => {
    openModal(`<h3>Tasdiqlang</h3><p>${esc(text)}</p><div class="modal__foot"><button class="btn btn--ghost" data-close>Bekor qilish</button><button class="btn ${yes ? "btn--primary" : "btn--danger"}" id="cfYes">${esc(yes || "Ha, o'chirish")}</button></div>`);
    let result = false;
    onModalClose = () => res(result);
    $("#cfYes").onclick = () => { result = true; closeModal(); };
  });

  /* ---------------- form builder ---------------- */
  function fieldHtml(f, v) {
    const val = v ?? f.default ?? "";
    const req = f.required ? "required" : "";
    const dis = f.disabled ? "disabled" : "";
    const help = f.help ? `<small>${esc(f.help)}</small>` : "";
    switch (f.type) {
      case "textarea": return `<label class="field"><span>${esc(f.label)}</span><textarea name="${f.name}" rows="${f.rows || 3}" ${req}>${esc(val)}</textarea>${help}</label>`;
      case "select": return `<label class="field"><span>${esc(f.label)}</span><select name="${f.name}" ${req} ${dis}>${Object.entries(f.options).map(([k, t]) => `<option value="${esc(k)}" ${String(k) === String(val) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>${help}</label>`;
      case "sub": return `<div class="subhead">${esc(f.label)}</div>`;
      case "hint": return `<div class="tplhint">${esc(f.label)}</div>`;
      case "datalist": return `<label class="field"><span>${esc(f.label)}</span><input name="${f.name}" list="dl-${f.name}" value="${esc(val)}" placeholder="${esc(f.placeholder || "")}" autocomplete="off" ${req} /><datalist id="dl-${f.name}">${(f.options || []).map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>${help}</label>`;
      case "color": return `<label class="field"><span>${esc(f.label)}</span><input type="color" name="${f.name}" value="${esc(val || "#22c58b")}" />${help}</label>`;
      case "days": { const set = new Set((val || []).map(Number)); return `<div class="field"><span>${esc(f.label)}</span><div class="days">${Object.entries(WD).map(([k, t]) => `<label><input type="checkbox" name="${f.name}" value="${k}" ${set.has(+k) ? "checked" : ""} /><span>${t}</span></label>`).join("")}</div>${help}</div>`; }
      case "check": return `<label class="field field--check"><input type="checkbox" name="${f.name}" ${val !== false ? "checked" : ""} /> ${esc(f.label)}</label>`;
      case "image": return `<div class="field"><span>${esc(f.label)}</span><div class="imgpick" data-folder="${f.folder}">
          <div class="imgpick__prev">${val ? `<img src="${esc(imgUrl(val))}" alt="" />` : "Rasm yo'q"}</div>
          <div class="imgpick__ctl"><input class="input" name="${f.name}" value="${esc(val)}" placeholder="Rasm manzili yoki pastdan yuklang" />
          <label class="btn btn--ghost btn--sm">⬆ Rasm yuklash<input type="file" accept="image/*" /></label></div></div>${help}</div>`;
      case "log": return `<div class="field"><span>${esc(f.label)}</span><div class="logbox" data-log='${JSON.stringify(val || [])}'></div>
          <div class="logbtns"><button type="button" class="btn btn--sm s1" data-add="1">+ Keldi</button><button type="button" class="btn btn--sm s0" data-add="0">+ Kelmadi</button><button type="button" class="btn btn--sm s2" data-add="2">+ Sababli</button><button type="button" class="btn btn--sm btn--ghost" data-pop>↶ Oxirgisini o'chirish</button></div>
          <small>Katakchani bosib holatini almashtiring: keldi → kelmadi → sababli.</small></div>`;
      default: return `<label class="field"><span>${esc(f.label)}</span><input type="${f.type === "tags" ? "text" : (f.type || "text")}" name="${f.name}" value="${esc(Array.isArray(val) ? val.join(", ") : val)}" placeholder="${esc(f.placeholder || "")}" ${req} ${dis} />${help}</label>`;
    }
  }
  function formModal({ title, fields, values = {}, onSave, onOpen }) {
    const body = fields.map((f) => f.group ? `<div class="grid${f.group.length}">${f.group.map((g) => fieldHtml(g, values[g.name])).join("")}</div>` : fieldHtml(f, values[f.name])).join("");
    openModal(`<h3>${esc(title)}</h3><form id="mForm" novalidate>${body}<div class="modal__foot"><button type="button" class="btn btn--ghost" data-close>Bekor qilish</button><button class="btn btn--primary" type="submit">Saqlash</button></div></form>`);
    const form = $("#mForm");
    const flat = fields.flatMap((f) => f.group || [f]);
    // davomat muharriri
    $$(".logbox", form).forEach((box) => {
      const log = JSON.parse(box.dataset.log || "[]");
      const draw = () => {
        box.innerHTML = log.length ? log.map((s, i) => `<button type="button" class="s${s}" data-i="${i}" title="${i + 1}-dars">${i + 1}</button>`).join("") : `<span class="muted" style="font-size:13px;align-self:center">Hali darslar yo'q</span>`;
        box.dataset.log = JSON.stringify(log);
      };
      draw();
      box.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const i = +b.dataset.i; log[i] = log[i] === 1 ? 0 : log[i] === 0 ? 2 : 1; draw(); });
      const wrap = box.parentElement;
      $$("[data-add]", wrap).forEach((b) => (b.onclick = () => { log.push(+b.dataset.add); draw(); }));
      $("[data-pop]", wrap).onclick = () => { log.pop(); draw(); };
    });
    // rasm yuklash
    $$(".imgpick", form).forEach((pick) => {
      const input = $("input.input", pick), prev = $(".imgpick__prev", pick);
      const setPrev = (u) => { prev.innerHTML = u ? `<img src="${esc(imgUrl(u))}" alt="" />` : "Rasm yo'q"; };
      input.addEventListener("change", () => setPrev(input.value.trim()));
      $("input[type=file]", pick).addEventListener("change", async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (!file.type.startsWith("image/")) { toast("Faqat rasm fayllari", true); return; }
        if (file.size > 5 * 1024 * 1024) { toast("Rasm 5 MB dan kichik bo'lishi kerak", true); return; }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${pick.dataset.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        busy(true); prev.innerHTML = "Yuklanmoqda...";
        const { error } = await sb.storage.from("media").upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
        busy(false);
        if (error) { toast(errText(error), true); setPrev(input.value); return; }
        const url = sb.storage.from("media").getPublicUrl(path).data.publicUrl;
        input.value = url; setPrev(url); toast("Rasm yuklandi");
      });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const out = {}; let bad = null;
      for (const f of flat) {
        if (f.type === "log") { out[f.name] = JSON.parse($(".logbox", form).dataset.log || "[]"); continue; }
        if (f.type === "days") { out[f.name] = $$(`input[name="${f.name}"]:checked`, form).map((i) => +i.value); if (f.required && !out[f.name].length) bad = bad || f.label; continue; }
        const el = form.elements[f.name]; if (!el || f.disabled) continue;
        let v = f.type === "check" ? el.checked : el.value.trim();
        if (f.type === "number") v = v === "" ? null : Number(v);
        if (f.type === "tags") v = v.split(",").map((s) => s.trim()).filter(Boolean);
        if (f.upper && typeof v === "string") v = v.toUpperCase();
        if (f.required && (v === "" || v == null)) bad = bad || f.label;
        if (f.pattern && v && !new RegExp("^(?:" + f.pattern + ")$").test(v)) bad = bad || f.label + " (format)";
        out[f.name] = v === "" ? null : v;
      }
      if (bad) { toast(`"${bad}" maydonini to'g'ri to'ldiring`, true); return; }
      const btn = $("button[type=submit]", form); btn.disabled = true;
      try { await onSave(out); closeModal(); } catch (_) { /* xato toast orqali ko'rsatildi */ } finally { btn.disabled = false; }
    });
    onOpen && onOpen(form);
  }

  /* ---------------- auth ---------------- */
  const showLogin = (msg = "") => { $("#app").hidden = true; $("#auth").hidden = false; $("#loginErr").textContent = msg; };
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return showLogin();
    const { data: ok, error } = await sb.rpc("is_admin");
    if (error || !ok) {
      await sb.auth.signOut();
      return showLogin(error ? errText(error) : "Bu hisob admin emas. Supabase'da admins jadvaliga email qo'shilganini tekshiring.");
    }
    $("#auth").hidden = true; $("#app").hidden = false;
    $("#userEmail").textContent = session.user.email;
    loadCourses().then(updateLeadsCount).catch(() => {});
    await runAutoFinish();
    route();
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = $("button[type=submit]", f);
    btn.disabled = true; $("#loginErr").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    btn.disabled = false;
    if (error) { $("#loginErr").textContent = errText(error); return; }
    f.password.value = "";
    boot();
  });
  $("#logout").addEventListener("click", async () => { await sb.auth.signOut(); location.hash = ""; showLogin(); });

  /* ---------------- router ---------------- */
  const VIEWS = {
    stat: ["Statistika", viewStat], leads: ["Arizalar", viewLeads], courses: ["Kurslar", viewCourses],
    teachers: ["Ustozlar", viewTeachers], groups: ["Guruhlar", viewGroups], group: ["Guruh", viewGroup], students: ["O'quvchilar", viewStudents],
    attendance: ["Ustozlar davomati", viewAttendance], certs: ["Sertifikatlar", viewCerts], settings: ["Sozlamalar", viewSettings],
  };
  function route() {
    if ($("#app").hidden) return;
    if (modal.classList.contains("is-open")) closeModal();
    const [k, arg] = location.hash.slice(1).split("/");
    const key = VIEWS[k] ? k : "stat";
    const navKey = key === "group" ? "groups" : key;
    $$("#sideNav a").forEach((a) => a.classList.toggle("is-active", a.dataset.view === navKey));
    $("#viewTitle").textContent = VIEWS[key][0];
    $("#viewActions").innerHTML = "";
    $("#view").onclick = null;
    $("#view").innerHTML = `<div class="empty">Yuklanmoqda...</div>`;
    $("#app").classList.remove("is-nav");
    VIEWS[key][1](arg && decodeURIComponent(arg)).catch(() => { $("#view").innerHTML = `<div class="card empty"><b>Ma'lumot yuklanmadi</b>Sahifani yangilab ko'ring.</div>`; });
  }
  addEventListener("hashchange", route);
  $("#burger").addEventListener("click", () => $("#app").classList.toggle("is-nav"));
  const actions = (html) => { $("#viewActions").innerHTML = html; };

  async function loadCourses() { state.courses = await q(sb.from("courses").select("*").order("sort")); return state.courses; }
  const courseOpts = (empty = "— tanlanmagan —") => ({ "": empty, ...Object.fromEntries(state.courses.map((c) => [c.id, c.title])) });
  const courseName = (id) => (state.courses.find((c) => c.id === id) || {}).title || "—";
  async function updateLeadsCount() {
    const { count } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("status", "new");
    $("#leadsCount").textContent = count ? count : "";
  }
  async function updateCertCount() {
    const { count, error } = await sb.from("certificates").select("id", { count: "exact", head: true }).eq("status", "pending");
    $("#certsCount").textContent = !error && count ? count : "";
  }
  // muddati tugagan guruhlarni yakunlab, sertifikatlarni avtomatik yaratish
  async function runAutoFinish() {
    try {
      const { data, error } = await sb.rpc("finish_due_groups");
      if (!error && data > 0) toast(`Muddati tugagan guruhlar yakunlandi — ${data} ta sertifikat tasdiqlashni kutmoqda`);
    } catch (_) { /* crm.sql hali ishga tushirilmagan bo'lishi mumkin */ }
    updateCertCount().catch(() => {});
  }
  async function loadTeachers() { state.teachers = await q(sb.from("teachers").select("id,name,role,course_id,active").order("sort")); return state.teachers; }
  const teacherOpts = () => ({ "": "— tanlanmagan —", ...Object.fromEntries((state.teachers || []).map((t) => [t.id, t.name + (t.role ? " · " + t.role : "")])) });
  const teacherName = (id) => ((state.teachers || []).find((t) => t.id === id) || {}).name || "—";
  const courseOf = (id) => state.courses.find((c) => c.id === id) || {};

  /* ================= STATISTIKA ================= */
  async function viewStat() {
    const days = state.statDays;
    actions(`<div class="seg" id="rangeSeg">${[7, 30, 90].map((d) => `<button data-d="${d}" class="${d === days ? "is-active" : ""}">${d} kun</button>`).join("")}</div>`);
    $("#rangeSeg").onclick = (e) => { const b = e.target.closest("[data-d]"); if (b) { state.statDays = +b.dataset.d; viewStat(); } };
    const [daily, br] = await Promise.all([q(sb.rpc("stats_daily", { p_days: days })), q(sb.rpc("stats_breakdown", { p_days: days }))]);
    const today = daily[daily.length - 1] || { views: 0, visitors: 0, leads: 0 };
    const yest = daily[daily.length - 2] || { views: 0, visitors: 0 };
    const sum = (k) => daily.reduce((a, d) => a + Number(d[k] || 0), 0);
    const delta = (a, b) => {
      a = +a; b = +b;
      if (!b) return a ? `<em class="up">▲ kecha 0 edi</em>` : `<em class="flat">kecha ham 0</em>`;
      const p = Math.round((a - b) / b * 100);
      return `<em class="${p > 0 ? "up" : p < 0 ? "down" : "flat"}">${p > 0 ? "▲" : p < 0 ? "▼" : "•"} ${Math.abs(p)}% kechaga nisbatan</em>`;
    };
    const devs = br.devices || {}, devTotal = Object.values(devs).reduce((a, b) => a + b, 0) || 1;
    const DEV = { mobile: "📱 Telefon", tablet: "📟 Planshet", desktop: "🖥 Kompyuter" };
    const refs = br.referrers || [], refMax = Math.max(1, ...refs.map((r) => r.count));
    // CRM ko'rsatkichlari (crm.sql ishga tushirilmagan bo'lsa — ko'rsatilmaydi)
    let crmHtml = "";
    try {
      const [ga, st, cp, mt] = await Promise.all([
        sb.from("groups").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("students").select("id", { count: "exact", head: true }),
        sb.from("certificates").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("marks").select("status").eq("day", today()),
      ]);
      if (!ga.error && !st.error && !cp.error && !mt.error) {
        const came = mt.data.filter((m) => m.status !== 0).length;
        crmHtml = `<div class="kpis">
          <a class="kpi" href="#groups" style="--k:#dcf6ea"><small>Faol guruhlar</small><b>${num(ga.count)}</b><em class="flat">Guruhlarni ochish →</em></a>
          <a class="kpi" href="#students" style="--k:#e3f2fd"><small>O'quvchilar</small><b>${num(st.count)}</b><em class="flat">Jami ro'yxatda</em></a>
          <div class="kpi" style="--k:#efe9fd"><small>Bugungi davomat</small><b>${mt.data.length ? Math.round(came / mt.data.length * 100) + "%" : "—"}</b><em class="flat">${mt.data.length ? `${came} / ${mt.data.length} o'quvchi keldi` : "Bugun hali belgilanmagan"}</em></div>
          <a class="kpi" href="#certs" style="--k:#fff4d6"><small>Tasdiqlash kutayotgan sertifikatlar</small><b>${num(cp.count)}</b><em class="${cp.count ? "up" : "flat"}">${cp.count ? "Tasdiqlash →" : "Hammasi tasdiqlangan"}</em></a>
        </div>`;
      }
    } catch (_) { /* ixtiyoriy */ }
    $("#view").innerHTML = `${crmHtml}
      <div class="kpis">
        <div class="kpi" style="--k:#dcf6ea"><small>Bugungi tashrifchilar</small><b>${num(today.visitors)}</b>${delta(today.visitors, yest.visitors)}</div>
        <div class="kpi" style="--k:#e3f2fd"><small>Bugungi sahifa ko'rishlar</small><b>${num(today.views)}</b>${delta(today.views, yest.views)}</div>
        <div class="kpi" style="--k:#efe9fd"><small>${days} kunda ko'rishlar</small><b>${num(sum("views"))}</b><em class="flat">Jami: ${num(br.total_visitors)} noyob tashrifchi</em></div>
        <div class="kpi" style="--k:#fff4d6"><small>Yangi arizalar</small><b>${num(br.leads_new)}</b><em class="flat">${days} kunda: ${num(sum("leads"))} ta ariza</em></div>
      </div>
      <div class="card">
        <div class="card__head"><h3>Kunlik tashriflar</h3><div class="legend"><span><i style="background:#bfeedb"></i>Tashrifchilar</span><span><i style="background:var(--sky)"></i>Ko'rishlar</span></div></div>
        <div class="chart" id="chart"><div class="chart__tip" id="tip"></div></div>
      </div>
      <div class="split">
        <div class="card"><div class="card__head"><h3>Qurilmalar</h3></div><div class="hbars">${Object.keys(DEV).map((k) => { const c = devs[k] || 0; return `<div><div class="hbar__row"><span>${DEV[k]}</span><span>${num(c)} · ${Math.round(c / devTotal * 100)}%</span></div><div class="hbar__track"><div class="hbar__fill" style="width:${c / devTotal * 100}%"></div></div></div>`; }).join("")}</div></div>
        <div class="card"><div class="card__head"><h3>Qayerdan kelishdi</h3></div><div class="hbars">${refs.length ? refs.map((r) => `<div><div class="hbar__row"><span>${esc(r.source)}</span><span>${num(r.count)}</span></div><div class="hbar__track"><div class="hbar__fill" style="width:${r.count / refMax * 100}%;background:var(--sky)"></div></div></div>`).join("") : `<div class="empty">Hali ma'lumot yo'q</div>`}</div></div>
      </div>
      <div class="card" style="margin-top:18px">
        <div class="card__head"><h3>Kunlik hisobot</h3><button class="btn btn--ghost btn--sm" id="csvDaily">⬇ Excel (CSV)</button></div>
        <div class="table-wrap"><table><thead><tr><th>Sana</th><th class="num">Tashrifchilar</th><th class="num">Ko'rishlar</th><th class="num">Arizalar</th></tr></thead>
        <tbody>${[...daily].reverse().map((d) => `<tr><td>${longDay(d.day, { weekday: "short", day: "2-digit", month: "long" })}</td><td class="num">${num(d.visitors)}</td><td class="num">${num(d.views)}</td><td class="num">${num(d.leads)}</td></tr>`).join("")}</tbody></table></div>
      </div>`;
    $("#csvDaily").onclick = () => downloadCSV(`hisobot-${days}-kun.csv`, [["Sana", "Tashrifchilar", "Ko'rishlar", "Arizalar"], ...daily.map((d) => [d.day, d.visitors, d.views, d.leads])]);
    drawChart($("#chart"), daily);
  }
  let chartResize;
  function drawChart(el, data) {
    const render = () => {
      const W = el.clientWidth, H = el.clientHeight, pl = 34, pr = 8, pt = 10, pb = 26;
      if (W < 80 || H < 60) return; // konteyner hali chizilmagan
      const iw = W - pl - pr, ih = H - pt - pb, n = data.length;
      const max = Math.max(4, ...data.map((d) => Math.max(+d.views, +d.visitors)));
      const mag = Math.pow(10, Math.floor(Math.log10(max)));
      const step = max / mag > 5 ? mag : max / mag > 2 ? mag / 2 : mag / 5;
      const top = Math.ceil(max / step) * step;
      const y = (v) => pt + ih - (v / top) * ih;
      const bw = iw / n, x = (i) => pl + i * bw + bw / 2;
      const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v));
      const every = Math.ceil(n / Math.max(4, Math.floor(iw / 56)));
      const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(+d.views).toFixed(1)}`).join("");
      el.querySelector("svg")?.remove();
      el.insertAdjacentHTML("afterbegin", `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kunlik tashriflar grafigi">
        <g class="grid">${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/>`).join("")}</g>
        <g class="axis">${ticks.map((t) => `<text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
        ${data.map((d, i) => (i % every === 0 || i === n - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${fmtDay(d.day)}</text>` : "").join("")}</g>
        ${data.map((d, i) => { const h = pt + ih - y(+d.visitors); const w = Math.max(3, bw * .62); return `<rect class="bar" data-i="${i}" x="${x(i) - w / 2}" y="${y(+d.visitors)}" width="${w}" height="${Math.max(0, h)}" rx="${Math.min(5, w / 3)}"/>`; }).join("")}
        <path class="line" d="${line}"/>
        ${n <= 31 ? data.map((d, i) => `<circle class="dot" cx="${x(i)}" cy="${y(+d.views)}" r="3"/>`).join("") : ""}
        ${data.map((d, i) => `<rect data-hit="${i}" x="${pl + i * bw}" y="${pt}" width="${bw}" height="${ih}" fill="transparent"/>`).join("")}
      </svg>`);
      const tip = $("#tip", el), svg = el.querySelector("svg");
      const clear = () => { tip.style.opacity = 0; $$(".bar", svg).forEach((b) => b.classList.remove("is-hover")); };
      svg.onmousemove = (e) => {
        const r = e.target.closest("[data-hit]"); clear();
        if (!r) return;
        const i = +r.dataset.hit, d = data[i];
        $(`.bar[data-i="${i}"]`, svg).classList.add("is-hover");
        tip.innerHTML = `<b>${longDay(d.day, { day: "2-digit", month: "long" })}</b>${num(d.visitors)} tashrifchi · ${num(d.views)} ko'rish · ${num(d.leads)} ariza`;
        tip.style.left = Math.min(Math.max(x(i), 120), W - 120) + "px";
        tip.style.top = Math.min(y(+d.views), y(+d.visitors)) + "px";
        tip.style.opacity = 1;
      };
      svg.onmouseleave = clear;
    };
    render();
    removeEventListener("resize", chartResize);
    chartResize = () => { if (document.body.contains(el)) render(); };
    addEventListener("resize", chartResize);
  }

  /* ================= ARIZALAR ================= */
  async function viewLeads() {
    if (!state.courses.length) await loadCourses();
    const rows = await q(sb.from("leads").select("*").order("created_at", { ascending: false }).limit(1000));
    actions(`<button class="btn btn--ghost" id="csvLeads">⬇ Excel (CSV)</button>`);
    $("#view").innerHTML = `<div class="card">
      <div class="toolbar">
        <input class="input" id="lq" placeholder="🔍 Ism yoki telefon bo'yicha qidirish" />
        <select class="input" id="ls"><option value="">Barcha holatlar</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select class="input" id="lt"><option value="">Barcha turlar</option>${Object.entries(LTYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <span class="muted" id="lcount" style="margin-left:auto;font-size:13px;font-weight:700"></span>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Sana</th><th>Ism / telefon</th><th>Turi</th><th>Kurs</th><th>Xabar</th><th>Holat</th><th></th></tr></thead><tbody id="ltb"></tbody></table></div></div>`;
    const draw = () => {
      const qv = $("#lq").value.trim().toLowerCase(), sv = $("#ls").value, tv = $("#lt").value;
      const list = rows.filter((r) => (!sv || r.status === sv) && (!tv || r.type === tv) && (!qv || (r.name + " " + r.phone).toLowerCase().includes(qv)));
      $("#lcount").textContent = `${list.length} ta`;
      $("#ltb").innerHTML = list.length ? list.map((r) => `<tr>
        <td style="white-space:nowrap">${fmtDate(r.created_at)}</td>
        <td><b>${esc(r.name)}</b><a class="sub" href="tel:${esc(String(r.phone).replace(/\s/g, ""))}">${esc(r.phone)}</a></td>
        <td><span class="pill">${esc(LTYPE[r.type] || r.type)}</span></td>
        <td>${esc(courseName(r.course))}${r.time ? `<span class="sub">${esc(r.time)}</span>` : ""}</td>
        <td style="max-width:260px">${esc(r.message || "—")}</td>
        <td><select class="status pill--${r.status}" data-id="${r.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${v}</option>`).join("")}</select></td>
        <td><div class="actions">${r.type !== "teacher" ? `<button class="icon-btn" data-stu="${r.id}" title="O'quvchiga aylantirish">👤</button>` : ""}<button class="icon-btn del" data-del="${r.id}" title="O'chirish">🗑</button></div></td></tr>`).join("")
        : `<tr><td colspan="7"><div class="empty"><b>Arizalar yo'q</b>Saytdagi formalar orqali kelgan arizalar shu yerda chiqadi.</div></td></tr>`;
    };
    draw();
    ["#lq", "#ls", "#lt"].forEach((s) => $(s).addEventListener("input", draw));
    $("#ltb").addEventListener("change", async (e) => {
      const s = e.target.closest("select.status"); if (!s) return;
      await q(sb.from("leads").update({ status: s.value }).eq("id", s.dataset.id));
      rows.find((r) => String(r.id) === s.dataset.id).status = s.value; s.className = `status pill--${s.value}`;
      toast("Holat yangilandi"); updateLeadsCount();
    });
    $("#ltb").addEventListener("click", async (e) => {
      const st = e.target.closest("[data-stu]");
      if (st) {
        const r = rows.find((x) => String(x.id) === st.dataset.stu);
        return studentModal({
          title: "Arizadan o'quvchi yaratish", values: { full_name: r.name, phone: r.phone, note: r.message || "" }, leadId: r.id, courseHint: r.course,
          onSaved: async () => {
            await q(sb.from("leads").update({ status: "done" }).eq("id", r.id));
            r.status = "done"; draw(); updateLeadsCount();
          },
        });
      }
      const b = e.target.closest("[data-del]"); if (!b) return;
      if (!(await confirmDlg("Bu ariza butunlay o'chiriladi. Davom etasizmi?"))) return;
      await q(sb.from("leads").delete().eq("id", b.dataset.del));
      rows.splice(rows.findIndex((r) => String(r.id) === b.dataset.del), 1); draw(); toast("O'chirildi"); updateLeadsCount();
    });
    $("#csvLeads").onclick = () => downloadCSV("arizalar.csv", [["Sana", "Ism", "Telefon", "Turi", "Kurs", "Vaqt", "Xabar", "Holat"], ...rows.map((r) => [fmtDate(r.created_at), r.name, r.phone, LTYPE[r.type], courseName(r.course), r.time, r.message, STATUS[r.status]])]);
  }

  /* ================= KURSLAR ================= */
  const courseFields = (isNew) => [
    { group: [{ name: "title", label: "Kurs nomi", required: true }, { name: "id", label: "ID (lotin, kichik harf)", required: true, disabled: !isNew, pattern: "[a-z0-9-]+", placeholder: "masalan: python", help: isNew ? "Keyin o'zgartirib bo'lmaydi" : "" }] },
    { group: [{ name: "cat", label: "Bo'lim", type: "select", options: CATS }, { name: "icon", label: "Belgi (rasm bo'lmasa)", type: "select", options: ICONS }] },
    { name: "image", label: "Kurs rasmi", type: "image", folder: "courses", help: "Tavsiya: gorizontal, 1200×900 px, 5 MB gacha" },
    { group: [{ name: "level", label: "Daraja" }, { name: "duration", label: "Davomiyligi", placeholder: "8 oy" }] },
    { group: [{ name: "price", label: "Narxi (so'm / oy)", placeholder: "450 000" }, { name: "lessons", label: "Dars jadvali", placeholder: "Haftada 3 marta · 2 soat" }] },
    { name: "description", label: "Tavsif", type: "textarea" },
    { name: "tags", label: "Teglar (vergul bilan)", type: "tags", placeholder: "Python, Frontend, Git" },
    { group: [{ name: "color", label: "Asosiy rang", type: "color" }, { name: "soft", label: "Och fon rangi", type: "color" }, { name: "sort", label: "Tartib raqami", type: "number" }] },
    { name: "active", label: "Saytda ko'rsatilsin", type: "check" },
  ];
  async function viewCourses() {
    await loadCourses();
    actions(`<button class="btn btn--primary" id="addCourse">+ Yangi kurs</button>`);
    $("#view").innerHTML = state.courses.length ? `<div class="ents">${state.courses.map((c) => `
      <div class="ent" style="--soft:${esc(c.soft)};--c:${esc(c.color)}">
        <div class="ent__img">📘${c.image ? `<img src="${esc(imgUrl(c.image))}" alt="" />` : ""}<span class="pill ${c.active ? "pill--done" : "pill--off"}">${c.active ? "Saytda" : "Yashirin"}</span></div>
        <div class="ent__body"><h4>${esc(c.title)}</h4><p>${esc(CATS[c.cat])} · ${esc(c.duration || "")} · ${esc(c.price || "")} so'm</p></div>
        <div class="ent__foot"><span class="muted" style="font-size:12px">#${c.sort ?? ""} · ${esc(c.id)}</span><div class="actions"><button class="icon-btn" data-newgroup="${esc(c.id)}" title="Shu kursga yangi guruh ochish">👥</button><button class="icon-btn" data-edit="${esc(c.id)}" title="Tahrirlash">✏️</button><button class="icon-btn del" data-del="${esc(c.id)}" title="O'chirish">🗑</button></div></div>
      </div>`).join("")}</div>` : `<div class="card empty"><b>Kurslar yo'q</b>"+ Yangi kurs" tugmasi orqali qo'shing.</div>`;
    $("#addCourse").onclick = () => formModal({
      title: "Yangi kurs", fields: courseFields(true), values: { color: "#22c58b", soft: "#e3f7ee", sort: state.courses.length + 1, active: true },
      onSave: async (v) => { await q(sb.from("courses").insert(v)); toast("Kurs qo'shildi"); viewCourses(); },
    });
    $("#view").onclick = async (e) => {
      const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]"), ng = e.target.closest("[data-newgroup]");
      if (ng) return groupModal({ values: { course_id: ng.dataset.newgroup } });
      if (ed) {
        const c = state.courses.find((x) => x.id === ed.dataset.edit);
        formModal({ title: "Kursni tahrirlash", fields: courseFields(false), values: c, onSave: async (v) => { await q(sb.from("courses").update(v).eq("id", c.id)); toast("Saqlandi"); viewCourses(); } });
      }
      if (dl) {
        if (!(await confirmDlg("Kurs o'chiriladi. Unga bog'langan ustoz va davomat yozuvlarida kurs bo'sh qoladi."))) return;
        await q(sb.from("courses").delete().eq("id", dl.dataset.del)); toast("O'chirildi"); viewCourses();
      }
    };
  }

  /* ================= USTOZLAR ================= */
  const teacherFields = () => [
    { group: [{ name: "name", label: "Ism familiya", required: true }, { name: "role", label: "Mutaxassislik", placeholder: "Python & Backend" }] },
    { name: "photo", label: "Rasm", type: "image", folder: "teachers", help: "Tavsiya: vertikal portret, 800×920 px, 5 MB gacha" },
    { group: [{ name: "course_id", label: "Kurs", type: "select", options: courseOpts() }, { name: "exp", label: "Tajriba", placeholder: "5 yil" }] },
    { name: "note", label: "Yutuq / qisqa ma'lumot", placeholder: "IELTS 8.0" },
    { group: [{ name: "sort", label: "Tartib raqami", type: "number" }] },
    { name: "active", label: "Saytda ko'rsatilsin", type: "check" },
  ];
  async function viewTeachers() {
    if (!state.courses.length) await loadCourses();
    const rows = await q(sb.from("teachers").select("*").order("sort"));
    actions(`<button class="btn btn--primary" id="addT">+ Yangi ustoz</button>`);
    $("#view").innerHTML = rows.length ? `<div class="ents">${rows.map((t) => {
      const c = state.courses.find((x) => x.id === t.course_id) || {};
      return `<div class="ent ent--tall" style="--soft:${esc(c.soft || "#eef6f1")};--c:${esc(c.color || "#0f8a5f")}">
        <div class="ent__img"><span class="initials">${esc(initials(t.name))}</span>${t.photo ? `<img src="${esc(imgUrl(t.photo))}" alt="" />` : ""}<span class="pill ${t.active ? "pill--done" : "pill--off"}">${t.active ? "Saytda" : "Yashirin"}</span></div>
        <div class="ent__body"><h4>${esc(t.name)}</h4><p>${esc(t.role || "")} · ${esc(c.title || "—")}</p></div>
        <div class="ent__foot"><span class="muted" style="font-size:12px">${esc(t.exp || "")}</span><div class="actions"><button class="icon-btn" data-edit="${t.id}" title="Tahrirlash">✏️</button><button class="icon-btn del" data-del="${t.id}" title="O'chirish">🗑</button></div></div>
      </div>`;
    }).join("")}</div>` : `<div class="card empty"><b>Ustozlar yo'q</b>"+ Yangi ustoz" tugmasi orqali qo'shing.</div>`;
    $("#addT").onclick = () => formModal({
      title: "Yangi ustoz", fields: teacherFields(), values: { sort: rows.length + 1, active: true },
      onSave: async (v) => { await q(sb.from("teachers").insert(v)); toast("Ustoz qo'shildi"); viewTeachers(); },
    });
    $("#view").onclick = async (e) => {
      const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
      if (ed) {
        const t = rows.find((x) => x.id === ed.dataset.edit);
        formModal({ title: "Ustozni tahrirlash", fields: teacherFields(), values: t, onSave: async (v) => { await q(sb.from("teachers").update(v).eq("id", t.id)); toast("Saqlandi"); viewTeachers(); } });
      }
      if (dl) {
        if (!(await confirmDlg("Ustoz ma'lumotlari o'chiriladi."))) return;
        await q(sb.from("teachers").delete().eq("id", dl.dataset.del)); toast("O'chirildi"); viewTeachers();
      }
    };
  }

  /* ================= DAVOMAT ================= */
  const attFields = (isNew) => [
    { group: [{ name: "code", label: "Shaxsiy kod", required: true, disabled: !isNew, upper: true, pattern: "[A-Z0-9-]+", placeholder: "MG-1005", help: "Lotin harf, raqam va '-'" }, { name: "type", label: "Turi", type: "select", options: { student: "O'quvchi", teacher: "Ustoz" } }] },
    { name: "name", label: "Ism familiya", required: true },
    { group: [{ name: "course_id", label: "Kurs", type: "select", options: courseOpts() }, { name: "grp", label: "Guruh", placeholder: "IT-24 (ertalab)" }] },
    { name: "log", label: "Darslar", type: "log" },
  ];
  async function viewAttendance() {
    if (!state.courses.length) await loadCourses();
    const rows = await q(sb.from("attendance").select("*").order("code"));
    actions(`<button class="btn btn--primary" id="addA">+ Yangi o'quvchi / ustoz</button>`);
    $("#view").innerHTML = `<div class="tplhint">ℹ️ O'quvchilar davomati endi <a class="link" href="#groups">Guruhlar</a> bo'limida olinadi. Bu sahifa ustozlar va eski kodlar (MG-1001 kabi) davomati uchun qoldirildi.</div><div class="card">
      <div class="toolbar"><input class="input" id="aq" placeholder="🔍 Kod yoki ism" />
        <select class="input" id="at"><option value="">Hammasi</option><option value="student">O'quvchilar</option><option value="teacher">Ustozlar</option></select>
        <select class="input" id="ac"><option value="">Barcha kurslar</option>${state.courses.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("")}</select>
        <span class="muted" style="margin-left:auto;font-size:13px">Tez belgilash: ✓ keldi · ✗ kelmadi — yangi dars qo'shadi</span></div>
      <div class="table-wrap"><table><thead><tr><th>Kod</th><th>Ism</th><th>Kurs / guruh</th><th>Darslar</th><th class="num">Davomat</th><th></th></tr></thead><tbody id="atb"></tbody></table></div></div>`;
    const draw = () => {
      const qv = $("#aq").value.trim().toLowerCase(), tv = $("#at").value, cv = $("#ac").value;
      const list = rows.filter((r) => (!tv || r.type === tv) && (!cv || r.course_id === cv) && (!qv || (r.code + " " + r.name).toLowerCase().includes(qv)));
      $("#atb").innerHTML = list.length ? list.map((r) => {
        const p = pctOf(r.log);
        return `<tr>
        <td><b style="font-family:ui-monospace,monospace">${esc(r.code)}</b><span class="sub">${r.type === "teacher" ? "Ustoz" : "O'quvchi"}</span></td>
        <td>${esc(r.name)}</td>
        <td>${esc(courseName(r.course_id))}<span class="sub">${esc(r.grp || "")}</span></td>
        <td><div class="minilog">${(r.log || []).slice(-30).map((s) => `<i class="s${s}"></i>`).join("") || '<span class="muted">—</span>'}</div><span class="sub">${(r.log || []).length} ta dars</span></td>
        <td class="num"><span class="pct ${p >= 85 ? "good" : "bad"}">${p}%</span></td>
        <td><div class="actions"><button class="icon-btn" data-mark="1" data-code="${esc(r.code)}" title="Keldi">✓</button><button class="icon-btn" data-mark="0" data-code="${esc(r.code)}" title="Kelmadi">✗</button><button class="icon-btn" data-edit="${esc(r.code)}" title="Tahrirlash">✏️</button><button class="icon-btn del" data-del="${esc(r.code)}" title="O'chirish">🗑</button></div></td></tr>`;
      }).join("") : `<tr><td colspan="6"><div class="empty"><b>Yozuvlar yo'q</b>"+ Yangi" tugmasi orqali o'quvchi yoki ustoz qo'shing.</div></td></tr>`;
    };
    draw();
    ["#aq", "#at", "#ac"].forEach((s) => $(s).addEventListener("input", draw));
    $("#addA").onclick = () => formModal({
      title: "Yangi yozuv", fields: attFields(true), values: { type: "student", log: [] },
      onSave: async (v) => { await q(sb.from("attendance").insert(v)); toast("Qo'shildi"); viewAttendance(); },
    });
    $("#atb").onclick = async (e) => {
      const mk = e.target.closest("[data-mark]"), ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
      if (mk) {
        const r = rows.find((x) => x.code === mk.dataset.code); const log = [...(r.log || []), +mk.dataset.mark];
        await q(sb.from("attendance").update({ log, updated_at: new Date().toISOString() }).eq("code", r.code)); r.log = log; draw();
        toast(`${r.name}: ${mk.dataset.mark === "1" ? "keldi" : "kelmadi"} deb belgilandi`);
      }
      if (ed) {
        const r = rows.find((x) => x.code === ed.dataset.edit);
        formModal({ title: "Davomatni tahrirlash", fields: attFields(false), values: r, onSave: async (v) => { await q(sb.from("attendance").update({ ...v, updated_at: new Date().toISOString() }).eq("code", r.code)); toast("Saqlandi"); viewAttendance(); } });
      }
      if (dl) {
        if (!(await confirmDlg(`${dl.dataset.del} kodi va uning barcha davomati o'chiriladi.`))) return;
        await q(sb.from("attendance").delete().eq("code", dl.dataset.del)); toast("O'chirildi"); viewAttendance();
      }
    };
  }

  /* ================= GURUHLAR ================= */
  const GSTATUS = { active: "Faol", finished: "Yakunlangan" };
  const firstNum = (s) => { const m = String(s || "").match(/\d+/); return m ? +m[0] : ""; };
  const daysText = (g) => (g.days || []).slice().sort().map((d) => WD[d]).join(", ");
  const groupProgress = (g) => {
    const total = Math.max(1, daysBetween(g.start_date, g.end_date) + 1);
    const done = Math.min(total, Math.max(0, daysBetween(g.start_date, today()) + 1));
    return { pct: g.status === "finished" ? 100 : Math.round(done / total * 100), left: Math.max(0, daysBetween(today(), g.end_date)) };
  };

  async function groupModal({ values = {}, group = null } = {}) {
    await Promise.all([state.courses.length ? null : loadCourses(), state.teachers ? null : loadTeachers()]);
    const isNew = !group;
    const v0 = isNew ? { start_date: today(), days: [1, 3, 5], ...values } : { ...group };
    if (isNew && v0.course_id && !v0.months) v0.months = firstNum(courseOf(v0.course_id).duration);
    if (isNew && v0.months && !v0.end_date) v0.end_date = addDays(addMonths(v0.start_date, +v0.months), -1);
    if (isNew && v0.course_id && !v0.teacher_id) v0.teacher_id = ((state.teachers || []).find((t) => t.course_id === v0.course_id) || {}).id || "";
    formModal({
      title: isNew ? "Yangi guruh" : "Guruhni tahrirlash",
      values: v0,
      fields: [
        { group: [{ name: "course_id", label: "Kurs", type: "select", required: true, options: courseOpts("— kursni tanlang —") }, { name: "name", label: "Guruh nomi", required: true, placeholder: "IT-25 (ertalab)" }] },
        { group: [{ name: "teacher_id", label: "Ustoz", type: "select", options: teacherOpts() }, { name: "room", label: "Xona", placeholder: "2-xona" }] },
        { type: "sub", label: "Davomiyligi" },
        { group: [{ name: "start_date", label: "Boshlanish sanasi", type: "date", required: true }, { name: "months", label: "Davomiyligi (oy)", type: "number", placeholder: "8" }, { name: "end_date", label: "Tugash sanasi", type: "date", required: true }] },
        { type: "hint", label: "Oy sonini kiritsangiz, tugash sanasi avtomatik hisoblanadi. Tugash sanasidan keyingi kuni guruh avtomatik yakunlanadi va o'quvchilarga sertifikat yaratiladi (tasdiqlaganingizdan keyin faollashadi)." },
        { group: [{ name: "days", label: "Dars kunlari", type: "days", required: true }, { name: "time", label: "Dars vaqti", placeholder: "14:00 — 16:00" }] },
      ],
      onOpen: (form) => {
        const E = form.elements;
        const calc = () => { const m = +E.months.value; if (E.start_date.value && m > 0) E.end_date.value = addDays(addMonths(E.start_date.value, m), -1); };
        E.months.addEventListener("input", calc);
        E.start_date.addEventListener("change", calc);
        E.end_date.addEventListener("input", () => { E.months.value = ""; });
        E.course_id.addEventListener("change", () => {
          const c = courseOf(E.course_id.value);
          if (!E.months.value && firstNum(c.duration)) { E.months.value = firstNum(c.duration); calc(); }
          if (!E.teacher_id.value) { const t = (state.teachers || []).find((x) => x.course_id === c.id); if (t) E.teacher_id.value = t.id; }
        });
      },
      onSave: async (v) => {
        delete v.months;
        if (v.end_date < v.start_date) { toast("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas", true); throw new Error("dates"); }
        if (isNew) {
          const row = await q(sb.from("groups").insert(v).select().single());
          toast("Guruh yaratildi — endi o'quvchilarni qo'shing");
          state.gTab = "students"; location.hash = "group/" + row.id;
        } else {
          // muddat uzaytirilsa — guruh qaytadan faol bo'ladi
          if (group.status === "finished" && v.end_date >= today()) { v.status = "active"; v.finished_at = null; }
          await q(sb.from("groups").update(v).eq("id", group.id));
          toast("Saqlandi"); route();
        }
      },
    });
  }

  async function viewGroups() {
    await Promise.all([loadCourses(), loadTeachers()]);
    const rows = await q(sb.from("groups").select("*, group_students(count)").order("start_date", { ascending: false }));
    const f = state.gFilter || "active";
    const cnt = (s) => rows.filter((r) => !s || r.status === s).length;
    actions(`<div class="seg" id="gSeg">${[["active", "Faol"], ["finished", "Yakunlangan"], ["", "Hammasi"]].map(([k, t]) => `<button data-f="${k}" class="${k === f ? "is-active" : ""}">${t} · ${cnt(k)}</button>`).join("")}</div><button class="btn btn--primary" id="addG">+ Yangi guruh</button>`);
    $("#view").innerHTML = `<div class="toolbar"><input class="input" id="gq" placeholder="🔍 Guruh yoki ustoz" /><select class="input" id="gc"><option value="">Barcha kurslar</option>${state.courses.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join("")}</select></div><div id="glist"></div>`;
    const draw = () => {
      const qv = $("#gq").value.trim().toLowerCase(), cv = $("#gc").value;
      const list = rows.filter((r) => (!f || r.status === f) && (!cv || r.course_id === cv) && (!qv || `${r.name} ${teacherName(r.teacher_id)}`.toLowerCase().includes(qv)));
      $("#glist").innerHTML = list.length ? `<div class="groups">${list.map((g) => {
        const c = courseOf(g.course_id), p = groupProgress(g), n = (g.group_students && g.group_students[0] && g.group_students[0].count) || 0;
        return `<a class="grp" href="#group/${g.id}" style="--c:${esc(c.color || "#22c58b")};--soft:${esc(c.soft || "#e3f7ee")}">
          <div class="grp__top"><span class="pill grp__course">${esc(c.title || "Kurs tanlanmagan")}</span><span class="pill ${g.status === "active" ? "pill--done" : "pill--off"}">${GSTATUS[g.status]}</span></div>
          <h4>${esc(g.name)}</h4>
          <div class="grp__meta"><span>👩‍🏫 ${esc(teacherName(g.teacher_id))}</span><span>📅 ${longDay(g.start_date, { day: "numeric", month: "short", year: "numeric" })} — ${longDay(g.end_date, { day: "numeric", month: "short", year: "numeric" })}</span><span>🕒 ${esc(daysText(g))}${g.time ? " · " + esc(g.time) : ""}</span><span>👥 ${n} ta o'quvchi${g.room ? " · " + esc(g.room) : ""}</span></div>
          <div class="prog"><i style="width:${p.pct}%"></i></div>
          <small>${g.status === "finished" ? "Yakunlangan" : g.start_date > today() ? `${daysBetween(today(), g.start_date)} kundan keyin boshlanadi` : `${p.pct}% o'tdi · ${p.left} kun qoldi`}</small>
        </a>`;
      }).join("")}</div>` : `<div class="card empty"><b>Guruhlar yo'q</b>${rows.length ? "Filtrni o'zgartirib ko'ring." : `"+ Yangi guruh" tugmasi orqali birinchi guruhni oching.`}</div>`;
    };
    draw();
    ["#gq", "#gc"].forEach((s) => $(s).addEventListener("input", draw));
    $("#gSeg").onclick = (e) => { const b = e.target.closest("[data-f]"); if (b) { state.gFilter = b.dataset.f; viewGroups(); } };
    $("#addG").onclick = () => groupModal();
  }

  const CSTATUS = { pending: ["Tasdiqlash kutilmoqda", "pill--contacted"], active: ["Amalda", "pill--done"], revoked: ["Bekor qilingan", "pill--rejected"] };
  const certState = (c) => c.revoked ? "revoked" : c.status === "pending" ? "pending" : "active";

  async function viewGroup(id) {
    await Promise.all([state.courses.length ? null : loadCourses(), loadTeachers()]);
    const [g, members, marks, certs] = await Promise.all([
      q(sb.from("groups").select("*").eq("id", id).maybeSingle()),
      fetchAll(() => sb.from("group_students").select("joined_at, students(*)").eq("group_id", id)),
      fetchAll(() => sb.from("marks").select("student_id,day,status").eq("group_id", id).order("day")),
      q(sb.from("certificates").select("id,number,status,revoked,student_id").eq("group_id", id)),
    ]);
    if (!g) { $("#view").innerHTML = `<div class="card empty"><b>Guruh topilmadi</b><a class="link" href="#groups">← Guruhlar ro'yxatiga qaytish</a></div>`; return; }
    const c = courseOf(g.course_id), p = groupProgress(g);
    $("#viewTitle").textContent = g.name;
    const studs = members.filter((m) => m.students).map((m) => ({ ...m.students, joined_at: m.joined_at })).sort((a, b) => a.full_name.localeCompare(b.full_name));
    const mk = new Map(marks.map((m) => [m.student_id + "|" + m.day, m.status]));
    const certBy = Object.fromEntries(certs.map((x) => [x.student_id, x]));
    const pctFor = (sid) => { const l = marks.filter((m) => m.student_id === sid); return l.length ? Math.round(l.filter((m) => m.status !== 0).length / l.length * 100) : null; };
    const planned = lessonDays(g), passed = lessonDays(g, today());

    actions(`<a class="btn btn--ghost" href="#groups">← Guruhlar</a><button class="btn btn--ghost" id="gEdit">✏️ Tahrirlash</button>${g.status === "active"
      ? `<button class="btn btn--primary" id="gFinish">🏁 Yakunlash va sertifikat yaratish</button>`
      : `<button class="btn btn--primary" id="gIssue">🎓 Yetishmayotgan sertifikatlarni yaratish</button>`}<button class="icon-btn del" id="gDel" title="Guruhni o'chirish">🗑</button>`);

    const tab = state.gTab || "att";
    $("#view").innerHTML = `
      <div class="card ghead-card" style="--c:${esc(c.color || "#22c58b")}">
        <div class="ghead">
          <div><small>Kurs</small><b>${esc(c.title || "—")}</b></div>
          <div><small>Ustoz</small><b>${esc(teacherName(g.teacher_id))}</b></div>
          <div><small>Muddat</small><b>${longDay(g.start_date, { day: "numeric", month: "short", year: "numeric" })} — ${longDay(g.end_date, { day: "numeric", month: "short", year: "numeric" })}</b></div>
          <div><small>Jadval</small><b>${esc(daysText(g))}${g.time ? " · " + esc(g.time) : ""}</b></div>
          <div><small>Darslar</small><b>${passed.length} / ${planned.length} o'tildi</b></div>
          <div><small>Holat</small><b><span class="pill ${g.status === "active" ? "pill--done" : "pill--off"}">${GSTATUS[g.status]}</span></b></div>
        </div>
        <div class="prog" style="margin-top:16px"><i style="width:${p.pct}%"></i></div>
      </div>
      <div class="seg tabs" id="gTabs">${[["att", "✅ Davomat olish"], ["students", `👥 O'quvchilar · ${studs.length}`], ["journal", "📒 Jurnal"]].map(([k, t]) => `<button data-t="${k}" class="${k === tab ? "is-active" : ""}">${t}</button>`).join("")}</div>
      <div id="gBody"></div>`;
    $("#gTabs").onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { state.gTab = b.dataset.t; viewGroup(id); } };
    $("#gEdit").onclick = () => groupModal({ group: g });
    $("#gDel").onclick = async () => {
      if (!(await confirmDlg(`"${g.name}" guruhi, uning a'zoligi va davomat belgilari o'chiriladi. Yaratilgan sertifikatlar saqlanib qoladi.`))) return;
      await q(sb.from("groups").delete().eq("id", g.id)); toast("Guruh o'chirildi"); location.hash = "groups";
    };
    const afterIssue = (n) => { toast(n ? `${n} ta sertifikat yaratildi — "Sertifikatlar" bo'limida tasdiqlang` : "Yangi sertifikat yaratilmadi (hammasida bor)"); updateCertCount(); viewGroup(id); };
    if ($("#gFinish")) $("#gFinish").onclick = async () => {
      if (!studs.length) { toast("Guruhda o'quvchi yo'q", true); return; }
      if (!(await confirmDlg(`Guruh hozir yakunlanadi va ${studs.length} ta o'quvchiga sertifikat yaratiladi (tasdiqlashingiz kerak bo'ladi). Odatda bu tugash sanasidan keyin avtomatik bajariladi.`, "Ha, yakunlash"))) return;
      afterIssue(await q(sb.rpc("finish_group", { p_group: g.id })));
    };
    if ($("#gIssue")) $("#gIssue").onclick = async () => afterIssue(await q(sb.rpc("issue_group_certificates", { p_group: g.id })));

    const body = $("#gBody");
    const noStuds = `<div class="card empty"><b>Guruhda hali o'quvchi yo'q</b><button class="btn btn--primary" id="gAdd0" style="margin-top:12px">+ O'quvchi qo'shish</button></div>`;
    const openAdd = () => addStudentsModal(g, new Set(studs.map((s) => s.id)), () => { state.gTab = "students"; viewGroup(id); });

    /* --- O'quvchilar --- */
    if (tab === "students") {
      body.innerHTML = studs.length ? `<div class="card">
        <div class="card__head"><h3>O'quvchilar ro'yxati</h3><button class="btn btn--primary btn--sm" id="gAdd">+ O'quvchi qo'shish</button></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Kod</th><th>Ism / telefon</th><th>Ota-ona</th><th>Qo'shilgan</th><th class="num">Davomat</th><th>Sertifikat</th><th></th></tr></thead><tbody>
        ${studs.map((s, i) => { const pc = pctFor(s.id), ct = certBy[s.id]; return `<tr>
          <td class="muted">${i + 1}</td>
          <td><b class="mono">${esc(s.code)}</b></td>
          <td><b>${esc(s.full_name)}</b>${s.phone ? `<a class="sub" href="tel:${esc(s.phone.replace(/\s/g, ""))}">${esc(s.phone)}</a>` : ""}</td>
          <td>${s.parent_phone ? `<a href="tel:${esc(s.parent_phone.replace(/\s/g, ""))}">${esc(s.parent_phone)}</a>` : '<span class="muted">—</span>'}</td>
          <td style="white-space:nowrap">${longDay(s.joined_at, { day: "numeric", month: "short", year: "numeric" })}</td>
          <td class="num">${pc == null ? '<span class="muted">—</span>' : `<span class="pct ${pc >= 85 ? "good" : "bad"}">${pc}%</span>`}</td>
          <td>${ct ? `<a href="#certs" class="pill ${CSTATUS[certState(ct)][1]}">${CSTATUS[certState(ct)][0]}</a>` : '<span class="muted">—</span>'}</td>
          <td><div class="actions"><button class="icon-btn" data-sedit="${s.id}" title="Tahrirlash">✏️</button><button class="icon-btn del" data-rm="${s.id}" title="Guruhdan chiqarish">✕</button></div></td></tr>`; }).join("")}
        </tbody></table></div></div>` : noStuds;
      if ($("#gAdd")) $("#gAdd").onclick = openAdd;
      body.onclick = async (e) => {
        if (e.target.closest("#gAdd0")) return openAdd();
        const ed = e.target.closest("[data-sedit]"), rm = e.target.closest("[data-rm]");
        if (ed) studentModal({ student: studs.find((s) => s.id === ed.dataset.sedit), onSaved: () => viewGroup(id) });
        if (rm) {
          const s = studs.find((x) => x.id === rm.dataset.rm);
          if (!(await confirmDlg(`${s.full_name} guruhdan chiqariladi va shu guruhdagi davomat belgilari o'chadi. O'quvchining o'zi ro'yxatda qoladi.`, "Ha, chiqarish"))) return;
          await q(sb.from("group_students").delete().eq("group_id", g.id).eq("student_id", s.id)); toast("Guruhdan chiqarildi"); viewGroup(id);
        }
      };
      return;
    }

    /* --- Davomat olish --- */
    if (tab === "att") {
      if (!studs.length) { body.innerHTML = noStuds; body.onclick = (e) => { if (e.target.closest("#gAdd0")) openAdd(); }; return; }
      const lastDay = today() < g.end_date ? today() : g.end_date;
      // standart: bugun (dars kuni bo'lsa), aks holda oxirgi o'tilgan dars kuni
      const defDay = passed.includes(lastDay) ? lastDay : passed[passed.length - 1] || (g.start_date <= lastDay ? lastDay : g.start_date);
      let day = (state.attDays || {})[g.id] >= g.start_date && (state.attDays || {})[g.id] <= lastDay ? state.attDays[g.id] : defDay;
      const draft = {};
      const render = () => {
        studs.forEach((s) => { if (!(s.id in draft)) { const v = mk.get(s.id + "|" + day); draft[s.id] = v == null ? null : v; } });
        const isLesson = (g.days || []).map(Number).includes(dow(day));
        const marked = studs.filter((s) => mk.has(s.id + "|" + day)).length;
        body.innerHTML = `<div class="card">
          <div class="card__head">
            <div class="attday"><button class="icon-btn" id="dPrev" title="Oldingi dars">‹</button><input class="input" type="date" id="dDay" value="${day}" min="${g.start_date}" max="${lastDay}" /><button class="icon-btn" id="dNext" title="Keyingi dars">›</button>
              <span class="muted" style="font-size:13px;font-weight:700">${longDay(day, { weekday: true, day: "numeric", month: "long" })}</span></div>
            <div class="actions"><button class="btn btn--ghost btn--sm" id="allCame">Hammasi keldi</button></div>
          </div>
          ${!isLesson ? `<div class="tplhint">Bu kun guruh jadvali bo'yicha dars kuni emas (${esc(daysText(g))}). Qo'shimcha dars bo'lsa, baribir belgilashingiz mumkin.</div>` : ""}
          ${g.start_date > today() ? `<div class="tplhint">Guruh hali boshlanmagan — davomatni ${longDay(g.start_date, { day: "numeric", month: "long" })} dan olish mumkin.</div>` : ""}
          <div class="attlist">${studs.map((s, i) => `<div class="attrow"><span class="muted">${i + 1}</span><div><b>${esc(s.full_name)}</b><small class="mono">${esc(s.code)}</small></div>
            <div class="marks3" data-sid="${s.id}">${[[1, "Keldi"], [0, "Kelmadi"], [2, "Sababli"]].map(([v, t]) => `<button type="button" data-v="${v}" class="${draft[s.id] === v ? "is-on s" + v : ""}">${t}</button>`).join("")}</div></div>`).join("")}</div>
          <div class="modal__foot"><span class="muted" style="margin-right:auto;align-self:center;font-size:13px">${marked ? `Bu kun ${marked} / ${studs.length} o'quvchi belgilangan` : "Bu kun hali belgilanmagan"}</span><button class="btn btn--primary" id="attSave" ${g.start_date > today() ? "disabled" : ""}>Saqlash</button></div>
        </div>`;
        const go = (d) => { (state.attDays = state.attDays || {})[g.id] = d; day = d; Object.keys(draft).forEach((k) => delete draft[k]); render(); };
        $("#dDay").onchange = (e) => { const v = e.target.value; if (v && v >= g.start_date && v <= lastDay) go(v); else e.target.value = day; };
        $("#dPrev").onclick = () => { const d = [...passed].reverse().find((x) => x < day); if (d) go(d); };
        $("#dNext").onclick = () => { const d = passed.find((x) => x > day); if (d) go(d); };
        $("#allCame").onclick = () => { studs.forEach((s) => (draft[s.id] = 1)); render(); };
        $(".attlist", body).onclick = (e) => {
          const b = e.target.closest("[data-v]"); if (!b) return;
          const sid = b.parentElement.dataset.sid, v = +b.dataset.v;
          draft[sid] = draft[sid] === v ? null : v;
          $$("button", b.parentElement).forEach((x) => { const on = draft[sid] === +x.dataset.v; x.className = on ? "is-on s" + x.dataset.v : ""; });
        };
        $("#attSave").onclick = async () => {
          const up = studs.filter((s) => draft[s.id] != null).map((s) => ({ group_id: g.id, student_id: s.id, day, status: draft[s.id], updated_at: new Date().toISOString() }));
          const del = studs.filter((s) => draft[s.id] == null && mk.has(s.id + "|" + day)).map((s) => s.id);
          if (!up.length && !del.length) { toast("Hech kim belgilanmadi", true); return; }
          if (up.length) await q(sb.from("marks").upsert(up));
          if (del.length) await q(sb.from("marks").delete().eq("group_id", g.id).eq("day", day).in("student_id", del));
          up.forEach((r) => mk.set(r.student_id + "|" + day, r.status));
          del.forEach((sid) => mk.delete(sid + "|" + day));
          const missing = studs.length - up.length;
          toast(`Davomat saqlandi${missing ? ` · ${missing} ta o'quvchi belgilanmadi` : ""}`);
          render();
        };
      };
      render();
      return;
    }

    /* --- Jurnal --- */
    if (!studs.length) { body.innerHTML = noStuds; body.onclick = (e) => { if (e.target.closest("#gAdd0")) openAdd(); }; return; }
    const days = [...new Set([...passed, ...marks.map((m) => m.day)])].sort();
    const L = { 1: "✓", 0: "✗", 2: "S" };
    body.innerHTML = `<div class="card">
      <div class="card__head"><h3>Davomat jurnali</h3><div class="actions"><span class="legend"><span><i class="s1"></i>Keldi</span><span><i class="s0"></i>Kelmadi</span><span><i class="s2"></i>Sababli</span></span><button class="btn btn--ghost btn--sm" id="jCsv">⬇ Excel (CSV)</button></div></div>
      <p class="muted" style="font-size:13px;margin:-6px 0 12px">Katakni bosib holatni o'zgartiring: keldi → kelmadi → sababli → bo'sh.</p>
      ${days.length ? `<div class="table-wrap"><table class="jgrid"><thead><tr><th class="sticky">O'quvchi</th>${days.map((d) => `<th class="c" title="${longDay(d, { weekday: true, day: "numeric", month: "long" })}">${fmtDay(d)}</th>`).join("")}<th class="num">%</th></tr></thead><tbody>
        ${studs.map((s) => { const pc = pctFor(s.id); return `<tr><td class="sticky"><b>${esc(s.full_name)}</b></td>${days.map((d) => { const v = mk.get(s.id + "|" + d); return `<td class="c"><button class="jcell ${v == null ? "" : "s" + v}" data-sid="${s.id}" data-d="${d}">${v == null ? "" : L[v]}</button></td>`; }).join("")}<td class="num">${pc == null ? "—" : `<span class="pct ${pc >= 85 ? "good" : "bad"}">${pc}%</span>`}</td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="empty"><b>Hali darslar o'tilmagan</b>Guruh boshlangandan keyin bu yerda jurnal chiqadi.</div>`}
    </div>`;
    body.onclick = async (e) => {
      const b = e.target.closest(".jcell"); if (!b) return;
      const key = b.dataset.sid + "|" + b.dataset.d, cur = mk.get(key);
      const next = cur == null ? 1 : cur === 1 ? 0 : cur === 0 ? 2 : null;
      if (next == null) await q(sb.from("marks").delete().eq("group_id", g.id).eq("student_id", b.dataset.sid).eq("day", b.dataset.d));
      else await q(sb.from("marks").upsert({ group_id: g.id, student_id: b.dataset.sid, day: b.dataset.d, status: next, updated_at: new Date().toISOString() }));
      if (next == null) mk.delete(key); else mk.set(key, next);
      b.className = "jcell " + (next == null ? "" : "s" + next); b.textContent = next == null ? "" : L[next];
    };
    if ($("#jCsv")) $("#jCsv").onclick = () => downloadCSV(`jurnal-${g.name}.csv`, [["Kod", "O'quvchi", ...days, "Davomat %"], ...studs.map((s) => [s.code, s.full_name, ...days.map((d) => { const v = mk.get(s.id + "|" + d); return v == null ? "" : v === 1 ? "+" : v === 0 ? "-" : "S"; }), pctFor(s.id) ?? ""])]);
  }

  async function addStudentsModal(g, existing, onDone) {
    const all = await fetchAll(() => sb.from("students").select("id,code,full_name,phone").order("full_name"));
    const avail = all.filter((s) => !existing.has(s.id));
    const sel = new Set();
    openModal(`<h3>«${esc(g.name)}» guruhiga o'quvchi qo'shish</h3>
      <div class="toolbar"><input class="input" id="psq" placeholder="🔍 Ism, kod yoki telefon" style="max-width:none;flex:1" /><button class="btn btn--ghost" id="psNew">+ Yangi o'quvchi</button></div>
      <div class="picklist" id="psl"></div>
      <div class="modal__foot"><span class="muted" id="psc" style="margin-right:auto;align-self:center;font-size:13px;font-weight:700"></span><button class="btn btn--ghost" data-close>Bekor qilish</button><button class="btn btn--primary" id="psOk">Qo'shish</button></div>`);
    const draw = () => {
      const qv = $("#psq").value.trim().toLowerCase();
      const list = avail.filter((s) => !qv || `${s.full_name} ${s.code} ${s.phone || ""}`.toLowerCase().includes(qv));
      $("#psl").innerHTML = list.length ? list.slice(0, 300).map((s) => `<label class="pick"><input type="checkbox" value="${s.id}" ${sel.has(s.id) ? "checked" : ""} /><b>${esc(s.full_name)}</b><span>${esc(s.code)}${s.phone ? " · " + esc(s.phone) : ""}</span></label>`).join("")
        : `<div class="empty"><b>${avail.length ? "Topilmadi" : "Qo'shiladigan o'quvchi yo'q"}</b>"+ Yangi o'quvchi" tugmasi orqali ro'yxatga kiriting.</div>`;
      $("#psc").textContent = sel.size ? `${sel.size} ta tanlandi` : "";
    };
    draw();
    $("#psq").addEventListener("input", draw);
    $("#psl").addEventListener("change", (e) => { const i = e.target; if (i.checked) sel.add(i.value); else sel.delete(i.value); $("#psc").textContent = sel.size ? `${sel.size} ta tanlandi` : ""; });
    $("#psNew").onclick = () => studentModal({ groupId: g.id, onSaved: onDone });
    $("#psOk").onclick = async () => {
      if (!sel.size) { toast("Kamida bitta o'quvchini tanlang", true); return; }
      await q(sb.from("group_students").insert([...sel].map((sid) => ({ group_id: g.id, student_id: sid }))));
      toast(`${sel.size} ta o'quvchi guruhga qo'shildi`); closeModal(); onDone();
    };
  }

  /* ================= O'QUVCHILAR ================= */
  // student — tahrirlash uchun; groupId — yaratilgach shu guruhga qo'shiladi; leadId/courseHint — arizadan
  async function studentModal({ student = null, values = {}, groupId = "", leadId = null, courseHint = "", title, onSaved } = {}) {
    const isNew = !student;
    let groupOpts = null;
    if (isNew && !groupId) {
      const gs = await q(sb.from("groups").select("id,name,course_id").eq("status", "active").order("name"));
      groupOpts = { "": "— hozircha guruhsiz —", ...Object.fromEntries(gs.map((x) => [x.id, x.name + (courseOf(x.course_id).title ? " · " + courseOf(x.course_id).title : "")])) };
      if (courseHint && !values.group_id) values.group_id = (gs.find((x) => x.course_id === courseHint) || {}).id || "";
    }
    formModal({
      title: title || (isNew ? "Yangi o'quvchi" : "O'quvchini tahrirlash"),
      values: isNew ? values : student,
      fields: [
        { group: [{ name: "full_name", label: "Ism familiya", required: true, placeholder: "Masalan: Xasanova Diyora" }, { name: "code", label: "Shaxsiy kod", disabled: !isNew, upper: true, pattern: "[A-Z0-9-]+", placeholder: "Avtomatik: MG-2001", help: isNew ? "Bo'sh qoldirsangiz, avtomatik beriladi. Saytda davomatni shu kod bilan ko'radi." : "Saytda davomatni shu kod bilan ko'radi" }] },
        { group: [{ name: "phone", label: "Telefon", type: "tel", placeholder: "+998 90 123 45 67" }, { name: "parent_phone", label: "Ota-ona telefoni", type: "tel", placeholder: "+998 90 123 45 67" }] },
        { group: [{ name: "birth_date", label: "Tug'ilgan sana", type: "date" }, ...(groupOpts ? [{ name: "group_id", label: "Guruhga qo'shish", type: "select", options: groupOpts }] : [])] },
        { name: "note", label: "Izoh", type: "textarea", rows: 2 },
      ],
      onSave: async (v) => {
        const gid = groupId || v.group_id; delete v.group_id;
        if (isNew) {
          if (!v.code) delete v.code;
          if (leadId) v.lead_id = leadId;
          const row = await q(sb.from("students").insert(v).select().single());
          if (gid) await q(sb.from("group_students").insert({ group_id: gid, student_id: row.id }));
          toast(`O'quvchi qo'shildi · kodi: ${row.code}${gid ? " · guruhga biriktirildi" : ""}`);
        } else {
          await q(sb.from("students").update(v).eq("id", student.id));
          toast("Saqlandi");
        }
        onSaved && setTimeout(onSaved, 0);
      },
    });
  }

  async function viewStudents() {
    if (!state.courses.length) await loadCourses();
    const [rows, groups] = await Promise.all([
      fetchAll(() => sb.from("students").select("*, group_students(group_id)").order("created_at", { ascending: false })),
      q(sb.from("groups").select("id,name,status,course_id").order("start_date", { ascending: false })),
    ]);
    const gmap = Object.fromEntries(groups.map((x) => [x.id, x]));
    const gids = (s) => (s.group_students || []).map((x) => x.group_id);
    actions(`<button class="btn btn--ghost" id="csvS">⬇ Excel (CSV)</button><button class="btn btn--primary" id="addS">+ Yangi o'quvchi</button>`);
    $("#view").innerHTML = `<div class="card">
      <div class="toolbar"><input class="input" id="sq" placeholder="🔍 Ism, kod yoki telefon" />
        <select class="input" id="sg"><option value="">Barcha guruhlar</option><option value="-">Guruhsizlar</option>${groups.map((x) => `<option value="${x.id}">${esc(x.name)}${x.status === "finished" ? " (yakunlangan)" : ""}</option>`).join("")}</select>
        <span class="muted" id="scount" style="margin-left:auto;font-size:13px;font-weight:700"></span></div>
      <div class="table-wrap"><table><thead><tr><th>Kod</th><th>Ism / telefon</th><th>Ota-ona</th><th>Guruhlar</th><th>Qo'shilgan</th><th></th></tr></thead><tbody id="stb"></tbody></table></div></div>`;
    const draw = () => {
      const qv = $("#sq").value.trim().toLowerCase(), gv = $("#sg").value;
      const list = rows.filter((s) => (!gv || (gv === "-" ? !gids(s).length : gids(s).includes(gv))) && (!qv || `${s.full_name} ${s.code} ${s.phone || ""} ${s.parent_phone || ""}`.toLowerCase().includes(qv)));
      $("#scount").textContent = `${list.length} ta`;
      $("#stb").innerHTML = list.length ? list.map((s) => `<tr>
        <td><b class="mono">${esc(s.code)}</b></td>
        <td><b>${esc(s.full_name)}</b>${s.phone ? `<a class="sub" href="tel:${esc(s.phone.replace(/\s/g, ""))}">${esc(s.phone)}</a>` : ""}</td>
        <td>${s.parent_phone ? esc(s.parent_phone) : '<span class="muted">—</span>'}</td>
        <td>${gids(s).length ? gids(s).map((id) => gmap[id] ? `<a class="pill ${gmap[id].status === "active" ? "pill--done" : "pill--off"}" href="#group/${id}">${esc(gmap[id].name)}</a>` : "").join(" ") : '<span class="pill pill--contacted">Guruhsiz</span>'}</td>
        <td style="white-space:nowrap">${longDay(s.created_at, { day: "numeric", month: "short", year: "numeric" })}</td>
        <td><div class="actions"><button class="icon-btn" data-edit="${s.id}" title="Tahrirlash">✏️</button><button class="icon-btn del" data-del="${s.id}" title="O'chirish">🗑</button></div></td></tr>`).join("")
        : `<tr><td colspan="6"><div class="empty"><b>O'quvchilar yo'q</b>"+ Yangi o'quvchi" tugmasi yoki guruh sahifasi orqali qo'shing.</div></td></tr>`;
    };
    draw();
    ["#sq", "#sg"].forEach((s) => $(s).addEventListener("input", draw));
    $("#addS").onclick = () => studentModal({ onSaved: viewStudents });
    $("#csvS").onclick = () => downloadCSV("oquvchilar.csv", [["Kod", "Ism familiya", "Telefon", "Ota-ona telefoni", "Tug'ilgan sana", "Guruhlar", "Izoh"], ...rows.map((s) => [s.code, s.full_name, s.phone, s.parent_phone, s.birth_date, gids(s).map((id) => (gmap[id] || {}).name).filter(Boolean).join(", "), s.note])]);
    $("#stb").onclick = async (e) => {
      const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
      if (ed) studentModal({ student: rows.find((s) => s.id === ed.dataset.edit), onSaved: viewStudents });
      if (dl) {
        const s = rows.find((x) => x.id === dl.dataset.del);
        if (!(await confirmDlg(`${s.full_name} (${s.code}) butunlay o'chiriladi: guruhlardagi a'zoligi va davomati ham o'chadi. Sertifikatlari saqlanib qoladi.`))) return;
        await q(sb.from("students").delete().eq("id", s.id)); toast("O'chirildi"); viewStudents();
      }
    };
  }

  /* ================= SERTIFIKATLAR ================= */
  const TPL_DEFAULT = { heading: "CERTIFICATE", done: "kursini muvaffaqiyatli yakunladi", logos: ["", "", ""], signer: { name: "", title: "", image: "" } };
  async function loadTpl() {
    const row = await q(sb.from("settings").select("value").eq("key", "certificate").maybeSingle());
    const v = (row && row.value) || {};
    const t = {
      ...TPL_DEFAULT, ...v,
      logos: [0, 1, 2].map((i) => (v.logos || [])[i] || ""),
      // bitta imzo; eski shablonda (2 ta imzo) — 2-imzo olinadi
      signer: { ...TPL_DEFAULT.signer, ...(window.Cert.signerOf(v) || {}) },
    };
    delete t.signers;
    return t;
  }

  async function previewCert(c, tpl, onApprove) {
    const url = window.Cert.verifyUrl(c.number);
    const pending = certState(c) === "pending";
    openModal(`<h3>Sertifikat №${esc(c.number)}</h3>
      <div class="certmeta"><b>${esc(c.full_name)}</b><span>${esc(c.course)}</span><span>${longDay(c.issued_at, { day: "numeric", month: "long", year: "numeric" })}</span><span class="pill ${CSTATUS[certState(c)][1]}">${CSTATUS[certState(c)][0]}</span>${c.attendance_pct != null ? `<span>Davomat: ${c.attendance_pct}%</span>` : ""}</div>
      ${pending ? `<div class="tplhint">Bu sertifikat hali tasdiqlanmagan: QR havola ishlamaydi va yuklab olib bo'lmaydi. Tasdiqlangan kun sertifikatdagi sana bo'ladi.</div>` : ""}
      <div id="certPrev"></div>
      ${pending ? "" : `<div class="certlink"><input class="input" readonly value="${esc(url)}" /><button class="btn btn--ghost btn--sm" id="cpy">Nusxalash</button><a class="btn btn--ghost btn--sm" href="${esc(url)}" target="_blank" rel="noopener">Ochish ↗</a></div>`}
      <div class="modal__foot">${pending
        ? `<button class="btn btn--ghost" data-close>Yopish</button><button class="btn btn--primary" id="cApprove">✅ Tasdiqlash va faollashtirish</button>`
        : `<button class="btn btn--ghost" id="dlPng">🖼 PNG</button><button class="btn btn--primary" id="dlPdf">⬇ PDF yuklab olish</button>`}</div>`, true);
    await window.Cert.mount($("#certPrev"), c, tpl);
    if (pending) { $("#cApprove").onclick = () => { closeModal(); onApprove && onApprove(); }; return; }
    $("#cpy").onclick = () => navigator.clipboard.writeText(url).then(() => toast("Havola nusxalandi"), () => toast("Nusxalab bo'lmadi", true));
    const dl = async (btn, type) => {
      const label = btn.textContent; btn.disabled = true; btn.textContent = "Tayyorlanmoqda..."; busy(true);
      try { await window.Cert.download(c, tpl, type); } catch (e) { toast("Yuklab bo'lmadi: " + e.message, true); }
      busy(false); btn.disabled = false; btn.textContent = label;
    };
    $("#dlPdf").onclick = () => dl($("#dlPdf"), "pdf");
    $("#dlPng").onclick = () => dl($("#dlPng"), "png");
  }

  function tplModal(tpl) {
    const values = { heading: tpl.heading, done: tpl.done };
    tpl.logos.forEach((u, i) => (values["logo" + i] = u));
    Object.assign(values, { sname: tpl.signer.name, stitle: tpl.signer.title, simage: tpl.signer.image });
    formModal({
      title: "Sertifikat shabloni",
      values,
      fields: [
        { type: "hint", label: "Logotiplar, imzo va muhr rasmlarini markazning asl fayllaridan yuklang. Imzo bilan muhrni bitta shaffof fonli PNG rasm qilib yuklash eng yaxshi natija beradi." },
        { group: [{ name: "heading", label: "Sarlavha", required: true }, { name: "done", label: "Kurs nomidan keyingi matn", required: true }] },
        { type: "sub", label: "Logotiplar (chapdan o'ngga)" },
        { name: "logo0", label: "1-logotip", type: "image", folder: "cert" },
        { name: "logo1", label: "2-logotip", type: "image", folder: "cert" },
        { name: "logo2", label: "3-logotip", type: "image", folder: "cert" },
        { type: "sub", label: "Imzo va muhr" },
        { group: [{ name: "sname", label: "Ism-familiya", placeholder: "Abduganiev Sherdil" }, { name: "stitle", label: "Lavozimi", placeholder: "Director of \"IT Park Farg'ona\" LLC" }] },
        { name: "simage", label: "Imzo va muhr rasmi", type: "image", folder: "cert" },
      ],
      onSave: async (v) => {
        const value = {
          heading: v.heading, done: v.done,
          logos: [v.logo0, v.logo1, v.logo2].map((x) => x || ""),
          signer: { name: v.sname || "", title: v.stitle || "", image: v.simage || "" },
        };
        await q(sb.from("settings").upsert({ key: "certificate", value, updated_at: new Date().toISOString() }));
        toast("Shablon saqlandi"); viewCerts();
      },
    });
  }

  // Qo'lda sertifikat: ism va kurs tizimdan (o'quvchi + guruh / kurs) olinadi
  async function newCertModal(tpl) {
    const [studs, links] = await Promise.all([
      fetchAll(() => sb.from("students").select("id,code,full_name").order("full_name")),
      fetchAll(() => sb.from("group_students").select("group_id,student_id,groups(id,name,course_id)")),
    ]);
    if (!studs.length) { toast("Avval O'quvchilar bo'limida o'quvchi qo'shing", true); return; }
    const groupsOf = (sid) => links.filter((l) => l.student_id === sid && l.groups).map((l) => l.groups);
    formModal({
      title: "Yangi sertifikat",
      values: { issued_at: today() },
      fields: [
        { type: "hint", label: "Ism-familiya va kurs nomi tizimdagi ma'lumotdan olinadi. Ism xato bo'lsa, avval O'quvchilar bo'limida tuzating." },
        { name: "student_id", label: "O'quvchi", type: "select", required: true, options: { "": "— o'quvchini tanlang —", ...Object.fromEntries(studs.map((x) => [x.id, `${x.full_name} · ${x.code}`])) } },
        { group: [{ name: "group_id", label: "Guruh", type: "select", options: { "": "— guruhsiz —" } }, { name: "course_id", label: "Kurs", type: "select", options: courseOpts("— kursni tanlang —") }] },
        { name: "issued_at", label: "Berilgan sana", type: "date", required: true },
      ],
      onOpen: (form) => {
        const E = form.elements;
        const prev = document.createElement("div"); prev.className = "certpick"; E.issued_at.closest(".field").before(prev);
        const show = () => {
          const st = studs.find((x) => x.id === E.student_id.value);
          prev.innerHTML = st ? `Sertifikatda: <b>${esc(st.full_name)}</b> — <b>${esc(courseOf(E.course_id.value).title || "kurs tanlanmagan")}</b>` : "";
        };
        const syncGroup = () => {
          const g = groupsOf(E.student_id.value).find((x) => x.id === E.group_id.value);
          if (g) E.course_id.value = g.course_id || "";
          E.course_id.disabled = !!g;
          show();
        };
        E.student_id.addEventListener("change", () => {
          const gs = groupsOf(E.student_id.value);
          E.group_id.innerHTML = `<option value="">— guruhsiz —</option>` + gs.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}${courseOf(g.course_id).title ? " · " + esc(courseOf(g.course_id).title) : ""}</option>`).join("");
          if (gs.length) E.group_id.value = gs[0].id;
          syncGroup();
        });
        E.group_id.addEventListener("change", syncGroup);
        E.course_id.addEventListener("change", show);
      },
      onSave: async (v) => {
        const st = studs.find((x) => x.id === v.student_id);
        const course = courseOf(v.course_id).title;
        if (!course) { toast("Kursni tanlang", true); throw new Error("course"); }
        const row = { full_name: st.full_name, course, issued_at: v.issued_at, student_id: st.id, group_id: v.group_id || null };
        if (row.group_id) {
          const m = await fetchAll(() => sb.from("marks").select("status").eq("group_id", row.group_id).eq("student_id", st.id));
          if (m.length) row.attendance_pct = Math.round(m.filter((x) => x.status !== 0).length / m.length * 100);
        }
        const saved = await q(sb.from("certificates").insert(row).select().single());
        toast("Sertifikat yaratildi");
        state.cFilter = "";
        viewCerts();
        setTimeout(() => previewCert(saved, tpl), 350);
      },
    });
  }

  async function viewCerts() {
    if (!state.courses.length) await loadCourses();
    const [rows, tpl] = await Promise.all([fetchAll(() => sb.from("certificates").select("*").order("created_at", { ascending: false })), loadTpl()]);
    // guruh nomlari (crm.sql bo'lmasa — jim o'tkazib yuboriladi)
    const gr = await sb.from("groups").select("id,name");
    const gname = Object.fromEntries(((!gr.error && gr.data) || []).map((x) => [x.id, x.name]));
    const counts = { pending: 0, active: 0, revoked: 0 };
    rows.forEach((r) => counts[certState(r)]++);
    if (state.cFilter == null) state.cFilter = counts.pending ? "pending" : "";
    const f = state.cFilter;
    actions(`<button class="btn btn--ghost" id="tplBtn">🎨 Shablon</button><button class="btn btn--primary" id="addCert">+ Yangi sertifikat</button>`);
    const missing = !tpl.logos.some(Boolean) || !tpl.signer.image;
    $("#view").innerHTML = `${missing ? `<div class="tplhint">⚠️ Shablonga logotiplar va imzo/muhr rasmlari hali to'liq yuklanmagan — sertifikatlarda ular bo'sh chiqadi. "🎨 Shablon" tugmasi orqali markazning asl fayllarini yuklang.</div>` : ""}
      ${counts.pending ? `<div class="tplhint">🎓 ${counts.pending} ta sertifikat tasdiqlashni kutmoqda. Ular guruh muddati tugaganda avtomatik yaratildi — tasdiqlanmaguncha QR orqali tekshirib bo'lmaydi va yuklab olinmaydi.</div>` : ""}
      <div class="card">
        <div class="toolbar">
          <div class="seg" id="cSeg">${[["pending", "Kutilmoqda"], ["active", "Amalda"], ["revoked", "Bekor qilingan"], ["", "Hammasi"]].map(([k, t]) => `<button data-f="${k}" class="${k === f ? "is-active" : ""}">${t} · ${k ? counts[k] : rows.length}</button>`).join("")}</div>
          <input class="input" id="cq" placeholder="🔍 Ism, kurs, guruh yoki raqam" />
          <button class="btn btn--primary btn--sm" id="approveAll" hidden></button>
          <span class="muted" id="ccount" style="margin-left:auto;font-size:13px;font-weight:700"></span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Raqam</th><th>F.I.Sh.</th><th>Kurs / guruh</th><th class="num">Davomat</th><th>Sana</th><th>Holat</th><th></th></tr></thead><tbody id="ctb"></tbody></table></div>
      </div>`;
    let list = [];
    const draw = () => {
      const qv = $("#cq").value.trim().toLowerCase();
      list = rows.filter((r) => (!f || certState(r) === f) && (!qv || `${r.number} ${r.full_name} ${r.course} ${gname[r.group_id] || ""}`.toLowerCase().includes(qv)));
      $("#ccount").textContent = `${list.length} ta`;
      const pend = list.filter((r) => certState(r) === "pending");
      $("#approveAll").hidden = !pend.length;
      $("#approveAll").textContent = `✅ Ko'rsatilganlarni tasdiqlash (${pend.length})`;
      $("#ctb").innerHTML = list.length ? list.map((r) => { const st = certState(r); return `<tr>
        <td><b class="mono">${esc(r.number)}</b></td>
        <td><b>${esc(r.full_name)}</b></td>
        <td>${esc(r.course)}${r.group_id && gname[r.group_id] ? `<a class="sub" href="#group/${r.group_id}">${esc(gname[r.group_id])}</a>` : ""}</td>
        <td class="num">${r.attendance_pct == null ? '<span class="muted">—</span>' : `<span class="pct ${r.attendance_pct >= 85 ? "good" : "bad"}">${r.attendance_pct}%</span>`}</td>
        <td style="white-space:nowrap">${longDay(r.issued_at, { day: "2-digit", month: "short", year: "numeric" })}</td>
        <td><span class="pill ${CSTATUS[st][1]}">${CSTATUS[st][0]}</span></td>
        <td><div class="actions">
          ${st === "pending" ? `<button class="btn btn--primary btn--sm" data-approve="${r.id}">✅ Tasdiqlash</button>` : ""}
          <button class="icon-btn" data-show="${r.id}" title="Ko'rish${st === "pending" ? "" : " va yuklab olish"}">👁</button>
          ${st !== "pending" ? `<a class="icon-btn" href="${esc(window.Cert.verifyUrl(r.number))}" target="_blank" rel="noopener" title="Tekshirish sahifasini ochish">🔗</a>
          <button class="icon-btn" data-revoke="${r.id}" title="${r.revoked ? "Qayta tiklash" : "Bekor qilish"}">${r.revoked ? "↩" : "⛔"}</button>` : ""}
          <button class="icon-btn del" data-del="${r.id}" title="O'chirish">🗑</button>
        </div></td></tr>`; }).join("")
        : `<tr><td colspan="7"><div class="empty"><b>${f === "pending" ? "Tasdiqlash kutayotgan sertifikat yo'q" : "Sertifikatlar yo'q"}</b>${f === "pending" ? "Guruh muddati tugaganda sertifikatlar shu yerda paydo bo'ladi." : `"+ Yangi sertifikat" tugmasi orqali yarating.`}</div></td></tr>`;
    };
    draw();
    $("#cq").addEventListener("input", draw);
    $("#cSeg").onclick = (e) => { const b = e.target.closest("[data-f]"); if (b) { state.cFilter = b.dataset.f; viewCerts(); } };
    // tasdiqlash: sertifikat faollashadi, berilgan sana — tasdiqlangan kun
    const approve = async (items) => {
      const ids = items.map((r) => r.id);
      await q(sb.rpc("approve_certificates", { p_ids: ids }));
      toast(ids.length > 1 ? `${ids.length} ta sertifikat tasdiqlandi va faollashdi` : "Sertifikat tasdiqlandi va faollashdi");
      updateCertCount(); viewCerts();
    };
    $("#approveAll").onclick = async () => {
      const pend = list.filter((r) => certState(r) === "pending");
      if (!(await confirmDlg(`${pend.length} ta sertifikat tasdiqlanadi va QR orqali tekshirish mumkin bo'ladi. Davom etasizmi?`, "Ha, tasdiqlash"))) return;
      approve(pend);
    };
    $("#tplBtn").onclick = () => tplModal(tpl);
    $("#addCert").onclick = () => newCertModal(tpl);
    $("#ctb").onclick = async (e) => {
      const sh = e.target.closest("[data-show]"), rv = e.target.closest("[data-revoke]"), dl = e.target.closest("[data-del]"), ap = e.target.closest("[data-approve]");
      if (ap) approve([rows.find((r) => r.id === ap.dataset.approve)]);
      if (sh) { const r = rows.find((x) => x.id === sh.dataset.show); previewCert(r, tpl, () => approve([r])); }
      if (rv) {
        const r = rows.find((x) => x.id === rv.dataset.revoke);
        await q(sb.from("certificates").update({ revoked: !r.revoked }).eq("id", r.id));
        r.revoked = !r.revoked; viewCerts(); toast(r.revoked ? "Sertifikat bekor qilindi — tekshirish sahifasida shunday ko'rinadi" : "Sertifikat qayta tiklandi");
      }
      if (dl) {
        const r = rows.find((x) => x.id === dl.dataset.del);
        if (!(await confirmDlg(`№${r.number} (${r.full_name}) sertifikati butunlay o'chiriladi va QR havolasi ishlamay qoladi. Faqat xato yaratilgan bo'lsa o'chiring, aks holda "Bekor qilish"dan foydalaning.`))) return;
        await q(sb.from("certificates").delete().eq("id", r.id));
        updateCertCount(); viewCerts(); toast("O'chirildi");
      }
    };
  }

  /* ================= SOZLAMALAR ================= */
  async function viewSettings() {
    const rows = await q(sb.from("settings").select("*"));
    const st = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const site = st.site || {}, stats = Array.isArray(st.stats) ? [...st.stats] : [];
    while (stats.length < 4) stats.push({ value: 0, suffix: "", label: "" });
    $("#view").innerHTML = `<form id="setForm" novalidate>
      <div class="card"><div class="card__head"><h3>Aloqa ma'lumotlari</h3></div>
        <div class="grid2">${fieldHtml({ name: "phone", label: "Telefon" }, site.phone)}${fieldHtml({ name: "hours", label: "Ish vaqti" }, site.hours)}</div>
        ${fieldHtml({ name: "address", label: "Manzil" }, site.address)}
        <div class="grid3">${fieldHtml({ name: "googleForm", label: "Google Form havolasi" }, site.googleForm)}${fieldHtml({ name: "telegram", label: "Telegram havolasi" }, site.telegram)}${fieldHtml({ name: "instagram", label: "Instagram havolasi" }, site.instagram)}</div>
      </div>
      <div class="card"><div class="card__head"><h3>Bosh sahifadagi raqamlar</h3><span class="muted" style="font-size:13px">Saytdagi 4 ta statistika kartasi</span></div>
        ${stats.slice(0, 4).map((s, i) => `<div class="grid3">${fieldHtml({ name: `sv${i}`, label: `${i + 1}. Raqam`, type: "number" }, s.value)}${fieldHtml({ name: `ss${i}`, label: "Belgi (+, %)" }, s.suffix)}${fieldHtml({ name: `sl${i}`, label: "Izoh" }, s.label)}</div>`).join("")}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn btn--primary" type="submit">Saqlash</button></div>
    </form>`;
    $("#setForm").addEventListener("submit", async (e) => {
      e.preventDefault(); const f = e.target.elements;
      const siteV = { ...site }; ["phone", "hours", "address", "googleForm", "telegram", "instagram"].forEach((k) => (siteV[k] = f[k].value.trim()));
      const statsV = [0, 1, 2, 3].map((i) => ({ value: Number(f[`sv${i}`].value) || 0, suffix: f[`ss${i}`].value.trim(), label: f[`sl${i}`].value.trim() })).filter((s) => s.label);
      const now = new Date().toISOString();
      await q(sb.from("settings").upsert([{ key: "site", value: siteV, updated_at: now }, { key: "stats", value: statsV, updated_at: now }]));
      toast("Sozlamalar saqlandi");
    });
  }

  // rasm yuklanmasa — yashiramiz
  document.addEventListener("error", (e) => { if (e.target.tagName === "IMG" && e.target.closest(".ent__img, .imgpick__prev")) e.target.remove(); }, true);
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") showLogin(); });
  boot();
})();
