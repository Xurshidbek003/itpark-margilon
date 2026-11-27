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
    if (/duplicate key/i.test(m)) return "Bunday ID/kod allaqachon mavjud";
    if (/row-level security|not allowed|permission/i.test(m)) return "Ruxsat yo'q — hisobingiz admins jadvalida borligini tekshiring";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Internet yoki server bilan aloqa yo'q";
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
  const confirmDlg = (text) => new Promise((res) => {
    openModal(`<h3>Tasdiqlang</h3><p>${esc(text)}</p><div class="modal__foot"><button class="btn btn--ghost" data-close>Bekor qilish</button><button class="btn btn--danger" id="cfYes">Ha, o'chirish</button></div>`);
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
  function formModal({ title, fields, values = {}, onSave }) {
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
    teachers: ["Ustozlar", viewTeachers], attendance: ["Davomat", viewAttendance], certs: ["Sertifikatlar", viewCerts], settings: ["Sozlamalar", viewSettings],
  };
  function route() {
    if ($("#app").hidden) return;
    const key = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "stat";
    $$("#sideNav a").forEach((a) => a.classList.toggle("is-active", a.dataset.view === key));
    $("#viewTitle").textContent = VIEWS[key][0];
    $("#viewActions").innerHTML = "";
    $("#view").onclick = null;
    $("#view").innerHTML = `<div class="empty">Yuklanmoqda...</div>`;
    $("#app").classList.remove("is-nav");
    VIEWS[key][1]().catch(() => { $("#view").innerHTML = `<div class="card empty"><b>Ma'lumot yuklanmadi</b>Sahifani yangilab ko'ring.</div>`; });
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
    $("#view").innerHTML = `
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
        <td><div class="actions"><button class="icon-btn del" data-del="${r.id}" title="O'chirish">🗑</button></div></td></tr>`).join("")
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
        <div class="ent__foot"><span class="muted" style="font-size:12px">#${c.sort ?? ""} · ${esc(c.id)}</span><div class="actions"><button class="icon-btn" data-edit="${esc(c.id)}" title="Tahrirlash">✏️</button><button class="icon-btn del" data-del="${esc(c.id)}" title="O'chirish">🗑</button></div></div>
      </div>`).join("")}</div>` : `<div class="card empty"><b>Kurslar yo'q</b>"+ Yangi kurs" tugmasi orqali qo'shing.</div>`;
    $("#addCourse").onclick = () => formModal({
      title: "Yangi kurs", fields: courseFields(true), values: { color: "#22c58b", soft: "#e3f7ee", sort: state.courses.length + 1, active: true },
      onSave: async (v) => { await q(sb.from("courses").insert(v)); toast("Kurs qo'shildi"); viewCourses(); },
    });
    $("#view").onclick = async (e) => {
      const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
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
    $("#view").innerHTML = `<div class="card">
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

  /* ================= SERTIFIKATLAR ================= */
  const TPL_DEFAULT = { heading: "CERTIFICATE", done: "kursini muvaffaqiyatli yakunladi", logos: ["", "", ""], signers: [{ name: "", title: "", image: "" }, { name: "", title: "", image: "" }] };
  async function loadTpl() {
    const row = await q(sb.from("settings").select("value").eq("key", "certificate").maybeSingle());
    const v = (row && row.value) || {};
    return {
      ...TPL_DEFAULT, ...v,
      logos: [0, 1, 2].map((i) => (v.logos || [])[i] || ""),
      signers: [0, 1].map((i) => ({ ...TPL_DEFAULT.signers[i], ...((v.signers || [])[i] || {}) })),
    };
  }
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  async function previewCert(c, tpl) {
    const url = window.Cert.verifyUrl(c.number);
    openModal(`<h3>Sertifikat №${esc(c.number)}</h3>
      <div class="certmeta"><b>${esc(c.full_name)}</b><span>${esc(c.course)}</span><span>${longDay(c.issued_at, { day: "numeric", month: "long", year: "numeric" })}</span>${c.revoked ? '<span class="pill pill--rejected">Bekor qilingan</span>' : ""}</div>
      <div id="certPrev"></div>
      <div class="certlink"><input class="input" readonly value="${esc(url)}" /><button class="btn btn--ghost btn--sm" id="cpy">Nusxalash</button><a class="btn btn--ghost btn--sm" href="${esc(url)}" target="_blank" rel="noopener">Ochish ↗</a></div>
      <div class="modal__foot"><button class="btn btn--ghost" id="dlPng">🖼 PNG</button><button class="btn btn--primary" id="dlPdf">⬇ PDF yuklab olish</button></div>`, true);
    await window.Cert.mount($("#certPrev"), c, tpl);
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
    tpl.signers.forEach((s, i) => { values[`s${i}name`] = s.name; values[`s${i}title`] = s.title; values[`s${i}image`] = s.image; });
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
        { type: "sub", label: "1-imzo (chap)" },
        { group: [{ name: "s0name", label: "Ism-familiya" }, { name: "s0title", label: "Lavozimi" }] },
        { name: "s0image", label: "Imzo va muhr rasmi", type: "image", folder: "cert" },
        { type: "sub", label: "2-imzo (o'rta)" },
        { group: [{ name: "s1name", label: "Ism-familiya" }, { name: "s1title", label: "Lavozimi" }] },
        { name: "s1image", label: "Imzo va muhr rasmi", type: "image", folder: "cert" },
      ],
      onSave: async (v) => {
        const value = {
          heading: v.heading, done: v.done,
          logos: [v.logo0, v.logo1, v.logo2].map((x) => x || ""),
          signers: [0, 1].map((i) => ({ name: v[`s${i}name`] || "", title: v[`s${i}title`] || "", image: v[`s${i}image`] || "" })),
        };
        await q(sb.from("settings").upsert({ key: "certificate", value, updated_at: new Date().toISOString() }));
        toast("Shablon saqlandi"); viewCerts();
      },
    });
  }

  async function viewCerts() {
    if (!state.courses.length) await loadCourses();
    const [rows, tpl] = await Promise.all([q(sb.from("certificates").select("*").order("created_at", { ascending: false }).limit(2000)), loadTpl()]);
    actions(`<button class="btn btn--ghost" id="tplBtn">🎨 Shablon</button><button class="btn btn--primary" id="addCert">+ Yangi sertifikat</button>`);
    const missing = !tpl.logos.some(Boolean) || !tpl.signers.every((s) => s.image);
    $("#view").innerHTML = `${missing ? `<div class="tplhint">⚠️ Shablonga logotiplar va imzo/muhr rasmlari hali to'liq yuklanmagan — sertifikatlarda ular bo'sh chiqadi. "🎨 Shablon" tugmasi orqali markazning asl fayllarini yuklang.</div>` : ""}
      <div class="card">
        <div class="toolbar"><input class="input" id="cq" placeholder="🔍 Ism, kurs yoki raqam" /><span class="muted" id="ccount" style="margin-left:auto;font-size:13px;font-weight:700"></span></div>
        <div class="table-wrap"><table><thead><tr><th>Raqam</th><th>F.I.Sh.</th><th>Kurs</th><th>Sana</th><th>Holat</th><th></th></tr></thead><tbody id="ctb"></tbody></table></div>
      </div>`;
    const draw = () => {
      const qv = $("#cq").value.trim().toLowerCase();
      const list = rows.filter((r) => !qv || `${r.number} ${r.full_name} ${r.course}`.toLowerCase().includes(qv));
      $("#ccount").textContent = `${list.length} ta`;
      $("#ctb").innerHTML = list.length ? list.map((r) => `<tr>
        <td><b style="font-family:ui-monospace,monospace">${esc(r.number)}</b></td>
        <td><b>${esc(r.full_name)}</b></td>
        <td>${esc(r.course)}</td>
        <td style="white-space:nowrap">${longDay(r.issued_at, { day: "2-digit", month: "short", year: "numeric" })}</td>
        <td>${r.revoked ? '<span class="pill pill--rejected">Bekor qilingan</span>' : '<span class="pill pill--done">Amalda</span>'}</td>
        <td><div class="actions">
          <button class="icon-btn" data-show="${r.id}" title="Ko'rish va yuklab olish">👁</button>
          <a class="icon-btn" href="${esc(window.Cert.verifyUrl(r.number))}" target="_blank" rel="noopener" title="Tekshirish sahifasini ochish">🔗</a>
          <button class="icon-btn" data-revoke="${r.id}" title="${r.revoked ? "Qayta tiklash" : "Bekor qilish"}">${r.revoked ? "↩" : "⛔"}</button>
          <button class="icon-btn del" data-del="${r.id}" title="O'chirish">🗑</button>
        </div></td></tr>`).join("")
        : `<tr><td colspan="6"><div class="empty"><b>Sertifikatlar yo'q</b>"+ Yangi sertifikat" tugmasi orqali yarating.</div></td></tr>`;
    };
    draw();
    $("#cq").addEventListener("input", draw);
    $("#tplBtn").onclick = () => tplModal(tpl);
    $("#addCert").onclick = () => formModal({
      title: "Yangi sertifikat",
      values: { issued_at: today() },
      fields: [
        { name: "full_name", label: "O'quvchining ism-familiyasi", required: true, placeholder: "Masalan: Törayev Raufbek" },
        { name: "course", label: "Kurs nomi", type: "datalist", required: true, options: state.courses.map((c) => c.title), placeholder: "Masalan: Kompyuter savodxonligi", help: "Ro'yxatdan tanlang yoki o'zingiz yozing" },
        { name: "issued_at", label: "Berilgan sana", type: "date", required: true },
      ],
      onSave: async (v) => {
        const row = await q(sb.from("certificates").insert(v).select().single());
        toast("Sertifikat yaratildi");
        viewCerts();
        setTimeout(() => previewCert(row, tpl), 350);
      },
    });
    $("#ctb").onclick = async (e) => {
      const sh = e.target.closest("[data-show]"), rv = e.target.closest("[data-revoke]"), dl = e.target.closest("[data-del]");
      if (sh) previewCert(rows.find((r) => r.id === sh.dataset.show), tpl);
      if (rv) {
        const r = rows.find((x) => x.id === rv.dataset.revoke);
        await q(sb.from("certificates").update({ revoked: !r.revoked }).eq("id", r.id));
        r.revoked = !r.revoked; draw(); toast(r.revoked ? "Sertifikat bekor qilindi — tekshirish sahifasida shunday ko'rinadi" : "Sertifikat qayta tiklandi");
      }
      if (dl) {
        const r = rows.find((x) => x.id === dl.dataset.del);
        if (!(await confirmDlg(`№${r.number} (${r.full_name}) sertifikati butunlay o'chiriladi va QR havolasi ishlamay qoladi. Faqat xato yaratilgan bo'lsa o'chiring, aks holda "Bekor qilish"dan foydalaning.`))) return;
        await q(sb.from("certificates").delete().eq("id", r.id));
        rows.splice(rows.indexOf(r), 1); draw(); toast("O'chirildi");
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
