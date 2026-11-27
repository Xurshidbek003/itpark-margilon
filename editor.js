// Sahifada tahrirlash rejimi: faqat admin uchun (sayt manzili + ?edit)
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const cfg = window.APP_CONFIG || {};
  const DEF = window.TEXT_DEFAULTS || {};

  /* ---------- uslublar ---------- */
  const css = document.createElement("style");
  css.textContent = `
    .edit-mode .reveal { opacity: 1 !important; transform: none !important; }
    .edit-mode [data-t] { outline: 1.5px dashed transparent; outline-offset: 3px; border-radius: 4px; cursor: text; transition: outline-color .15s, background .15s; }
    .edit-mode [data-t]:hover { outline-color: #22c58b; background: rgba(34,197,139,.08); }
    .edit-mode [data-t]:focus { outline: 2px solid #22c58b; background: rgba(34,197,139,.12); }
    .edit-mode [data-t].is-changed { outline-color: #f5a524; }
    .edit-mode [data-t].is-changed:hover, .edit-mode [data-t].is-changed:focus { outline-color: #f5a524; background: rgba(245,165,36,.12); }
    .edit-mode [data-managed] { cursor: help; }
    .edit-mode body { padding-bottom: 96px; }
    .edbar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 9999; width: min(980px, calc(100% - 24px)); display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 12px 10px 18px; border-radius: 20px; background: #1b2a24; color: #fff; font: 600 14px/1.3 Manrope, system-ui, sans-serif; box-shadow: 0 24px 60px -20px rgba(0,0,0,.55); }
    .edbar b { font-weight: 800; white-space: nowrap; }
    .edbar .hint { color: rgba(255,255,255,.6); font-size: 12.5px; flex: 1; min-width: 180px; }
    .edbar .cnt { background: rgba(255,255,255,.1); padding: 5px 10px; border-radius: 999px; font-size: 12.5px; white-space: nowrap; }
    .edbar .cnt.has { background: #f5a524; color: #1b2a24; }
    .edbar button, .edbar a { border: 0; cursor: pointer; font: 700 13.5px Manrope, system-ui, sans-serif; padding: 9px 14px; border-radius: 12px; background: rgba(255,255,255,.1); color: #fff; text-decoration: none; white-space: nowrap; }
    .edbar button:hover, .edbar a:hover { background: rgba(255,255,255,.18); }
    .edbar button[disabled] { opacity: .4; pointer-events: none; }
    .edbar .save { background: #22c58b; color: #fff; }
    .edbar .save:hover { background: #1db47e; }
    .edtoast { position: fixed; left: 50%; bottom: 96px; transform: translate(-50%, 20px); opacity: 0; z-index: 10000; background: #fff; color: #1b2a24; padding: 11px 18px; border-radius: 14px; font: 700 14px Manrope, system-ui, sans-serif; box-shadow: 0 18px 40px -16px rgba(0,0,0,.35); transition: .3s; pointer-events: none; max-width: calc(100% - 32px); text-align: center; }
    .edtoast.is-show { opacity: 1; transform: translate(-50%, 0); }
    .edtoast.is-err { background: #b84343; color: #fff; }
    @media (max-width: 640px) { .edbar .hint { display: none; } .edbar { gap: 6px; padding: 8px; } .edbar button, .edbar a { padding: 8px 10px; font-size: 12.5px; } }
  `;
  document.head.appendChild(css);

  let toastT;
  const toast = (msg, err = false) => {
    let t = $(".edtoast"); if (!t) { t = document.createElement("div"); t.className = "edtoast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("is-err", err); t.classList.add("is-show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-show"), err ? 5000 : 2600);
  };
  const bar = document.createElement("div");
  bar.className = "edbar";
  const adminUrl = new URL("admin/", location.href).href;
  const exitUrl = location.pathname + location.hash;

  /* ---------- kirish va huquqni tekshirish ---------- */
  const fail = (msg) => { bar.innerHTML = `<b>✏️ ${msg}</b><span class="hint"></span><a href="${adminUrl}">Admin panelga kirish</a><a href="${exitUrl}">Yopish</a>`; document.body.appendChild(bar); };
  if (!cfg.supabaseUrl || !window.supabase) return fail("Tahrirlash uchun Supabase ulanmagan");
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return fail("Tahrirlash uchun avval admin panelga kiring");
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (!isAdmin) return fail("Bu hisobda tahrirlash huquqi yo'q");

  const { data: row, error: rowErr } = await sb.from("settings").select("value").eq("key", "texts").maybeSingle();
  if (rowErr) return fail("Matnlarni yuklab bo'lmadi: " + rowErr.message);
  let saved = (row && row.value && typeof row.value === "object") ? { ...row.value } : {};

  /* ---------- tahrirlash rejimi ---------- */
  document.documentElement.classList.add("edit-mode");
  $$("details").forEach((d) => (d.open = true));
  const changes = {};
  const baseOf = (k) => (saved[k] != null && saved[k] !== "" ? saved[k] : DEF[k]);
  const current = (k) => (k in changes ? changes[k] : baseOf(k));

  const prep = (el) => {
    if (el.dataset.edReady) return;
    el.dataset.edReady = "1";
    el.contentEditable = "plaintext-only";
    if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    el.spellcheck = false;
    const k = el.dataset.t;
    if (k in changes) el.textContent = changes[k];
    el.classList.toggle("is-changed", k in changes);
  };
  $$("[data-t]").forEach(prep);
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches("[data-t]")) prep(n);
      $$("[data-t]", n).forEach(prep);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Bosilganda havola/tugma ishlamasin — matn tahrirlansin (Ctrl/Cmd + bosish — odatdagidek ishlaydi)
  document.addEventListener("click", (e) => {
    if (e.target.closest(".edbar")) return;
    if (e.ctrlKey || e.metaKey) return;
    const t = e.target.closest("[data-t]");
    if (t) { e.preventDefault(); e.stopPropagation(); if (document.activeElement !== t) t.focus(); return; }
    const m = e.target.closest("[data-managed]");
    if (m) { e.preventDefault(); e.stopPropagation(); toast(`Bu qism admin panelning "${m.dataset.managed}" bo'limidan o'zgartiriladi`); }
  }, true);
  document.addEventListener("keydown", (e) => {
    const t = e.target.closest && e.target.closest("[data-t]");
    if (!t) return;
    if (e.key === "Enter") { e.preventDefault(); t.blur(); }
    if (e.key === "Escape") { t.textContent = current(t.dataset.t); t.blur(); }
    if (e.key === " ") e.stopPropagation(); // tugma ichida bo'sh joy "bosish" bo'lib ketmasin
  }, true);
  document.addEventListener("keyup", (e) => { if (e.key === " " && e.target.closest && e.target.closest("[data-t]")) e.preventDefault(); }, true);
  // Faqat oddiy matn joylansin
  document.addEventListener("paste", (e) => {
    const t = e.target.closest && e.target.closest("[data-t]");
    if (!t) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ");
    document.execCommand("insertText", false, text);
  }, true);

  const same = (k) => $$(`[data-t="${CSS.escape(k)}"]`);
  const markChanged = (k) => same(k).forEach((x) => x.classList.toggle("is-changed", k in changes));
  document.addEventListener("input", (e) => {
    const t = e.target.closest && e.target.closest("[data-t]"); if (!t) return;
    same(t.dataset.t).forEach((x) => { if (x !== t) x.textContent = t.textContent; });
  }, true);
  document.addEventListener("focusout", (e) => {
    const t = e.target.closest && e.target.closest("[data-t]"); if (!t) return;
    const k = t.dataset.t;
    let v = t.textContent.replace(/\s+/g, " ").trim();
    if (!v) { v = current(k); toast("Matn bo'sh bo'lishi mumkin emas — avvalgisi qaytarildi", true); }
    same(k).forEach((x) => (x.textContent = v));
    if (v === baseOf(k)) delete changes[k]; else changes[k] = v;
    markChanged(k); refresh();
  }, true);
  let focused = null;
  document.addEventListener("focusin", (e) => { const t = e.target.closest && e.target.closest("[data-t]"); if (t) focused = t; refresh(); }, true);

  /* ---------- panel ---------- */
  bar.innerHTML = `
    <b>✏️ Tahrirlash rejimi</b>
    <span class="hint">Matnni bosib yozing, Enter — tasdiqlash. Tugma yoki havolani ishlatish: Ctrl + bosish.</span>
    <span class="cnt" id="edCnt">O'zgarish yo'q</span>
    <button id="edReset" title="Tanlangan matnni dastlabki holiga qaytarish">↺ Asl holi</button>
    <button id="edCancel">Bekor qilish</button>
    <button class="save" id="edSave" disabled>Saqlash</button>
    <a href="${exitUrl}" id="edExit">Chiqish</a>`;
  document.body.appendChild(bar);
  function refresh() {
    const n = Object.keys(changes).length;
    const cnt = $("#edCnt"); cnt.textContent = n ? `${n} ta o'zgarish` : "O'zgarish yo'q"; cnt.classList.toggle("has", !!n);
    $("#edSave").disabled = !n;
    const k = focused && focused.dataset.t;
    $("#edReset").disabled = !k || DEF[k] == null || current(k) === DEF[k];
  }
  refresh();

  $("#edReset").addEventListener("click", () => {
    if (!focused) return;
    const k = focused.dataset.t, d = DEF[k];
    if (d == null) return;
    same(k).forEach((x) => (x.textContent = d));
    if (d === baseOf(k)) delete changes[k]; else changes[k] = d;
    markChanged(k); refresh(); toast("Dastlabki matn qaytarildi — saqlashni unutmang");
  });
  const clearChanges = () => Object.keys(changes).forEach((k) => delete changes[k]);
  $("#edCancel").addEventListener("click", () => {
    if (Object.keys(changes).length && !confirm("Saqlanmagan o'zgarishlar bekor qilinsinmi?")) return;
    clearChanges(); location.reload();
  });
  $("#edSave").addEventListener("click", async () => {
    const next = { ...saved, ...changes };
    Object.keys(next).forEach((k) => { if (next[k] == null || next[k] === "" || next[k] === DEF[k]) delete next[k]; });
    const btn = $("#edSave"); btn.disabled = true; btn.textContent = "Saqlanmoqda...";
    const { error } = await sb.from("settings").upsert({ key: "texts", value: next, updated_at: new Date().toISOString() });
    btn.textContent = "Saqlash";
    if (error) { refresh(); toast("Saqlanmadi: " + error.message, true); return; }
    saved = next; clearChanges();
    $$(".is-changed").forEach((x) => x.classList.remove("is-changed"));
    refresh(); toast("✓ Saqlandi — o'zgarishlar saytda ko'rinadi");
  });
  addEventListener("beforeunload", (e) => { if (Object.keys(changes).length) { e.preventDefault(); e.returnValue = ""; } });
  $("#edExit").addEventListener("click", (e) => {
    if (Object.keys(changes).length && !confirm("Saqlanmagan o'zgarishlar bor. Baribir chiqasizmi?")) { e.preventDefault(); return; }
    clearChanges();
  });
  toast("Tahrirlash rejimi yoqildi");
})();
