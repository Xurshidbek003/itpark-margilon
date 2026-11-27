(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { SITE, COURSES, TEACHERS, ATTENDANCE } = window;
  const courseById = Object.fromEntries(COURSES.map((c) => [c.id, c]));

  /* ---------- matnlar (admin "Saytni tahrirlash" orqali o'zgartiriladi) ---------- */
  const TX = window.TEXTS || {};
  const DEF = (window.TEXT_DEFAULTS = window.TEXT_DEFAULTS || {});
  const T = (k, d) => { if (!(k in DEF)) DEF[k] = d; return TX[k] != null && TX[k] !== "" ? TX[k] : d; };
  const tt = (k, d) => `<span data-t="${k}">${esc(T(k, d))}</span>`;
  $$("[data-t]").forEach((el) => { const k = el.dataset.t; if (!(k in DEF)) DEF[k] = el.textContent; if (TX[k] != null && TX[k] !== "") el.textContent = TX[k]; });

  const ICONS = {
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
    sigma: '<path d="M18 5H6l6 7-6 7h12"/>',
    hangul: '<path d="M4 6h7M7.5 6v3.5M4.5 13a3 3 0 1 0 6 0 3 3 0 1 0-6 0M15 4v16M15 11h4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 10h8M8 13h5"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  /* ---------- site info ---------- */
  $$("[data-site]").forEach((el) => (el.textContent = SITE[el.dataset.site] || ""));
  $$("[data-tel]").forEach((el) => (el.href = "tel:" + SITE.phone.replace(/\s/g, "")));
  $$("[data-site-href]").forEach((el) => (el.href = SITE[el.dataset.siteHref] || "#"));
  $("#year").textContent = new Date().getFullYear();
  if (Array.isArray(window.STATS)) {
    $$(".stat").forEach((el, i) => {
      const st = window.STATS[i]; if (!st) { el.remove(); return; }
      $("[data-count]", el).dataset.count = Number(st.value) || 0;
      $("span", el).textContent = st.suffix || "";
      $("p", el).textContent = st.label || "";
    });
  }

  /* ---------- nav ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  $("#burger").addEventListener("click", () => nav.classList.toggle("is-open"));
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("is-open")));
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$("#navLinks a").forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["kurslar", "davomat", "ustozlar", "faq", "boglanish"].forEach((id) => sectionObs.observe(document.getElementById(id)));

  /* ---------- courses ---------- */
  // Rasm topilmasa — uni olib tashlaymiz, ostidagi pastel muqova ko'rinadi
  document.addEventListener("error", (e) => {
    if (e.target.tagName === "IMG" && e.target.hasAttribute("data-fallback")) e.target.remove();
  }, true);
  const img = (src, alt) => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" data-fallback style="position:relative;z-index:1" />` : "";
  const CAT = { it: "IT", lang: "Til kursi", exam: "Imtihonga tayyorlov" };

  const coursesEl = $("#courses");
  const renderCourses = (filter = "all") => {
    coursesEl.innerHTML = COURSES.filter((c) => filter === "all" || c.cat === filter).map((c, i) => `
      <button class="course" style="--c:${c.color}; --soft:${c.soft || "#eef6f1"}; animation-delay:${i * 60}ms" data-course="${c.id}">
        <div class="course__media">
          <div class="cover"><span class="cover__icon">${icon(c.icon)}</span></div>
          ${img(c.image, c.title)}
          <div class="course__badges"><span class="cat">${tt("cat." + c.cat, CAT[c.cat] || "")}</span><span>${esc(c.duration)}</span></div>
        </div>
        <div class="course__body">
          <h3>${esc(c.title)}</h3>
          <span class="course__level">${esc(c.level)}</span>
          <p class="course__desc">${esc(c.desc)}</p>
          <div class="course__tags">${c.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
          <div class="course__foot">
            <div class="course__price"><b>${esc(c.price)} ${tt("course.som", "so'm")}</b><small>${tt("course.month", "oyiga")} · ${esc(c.lessons)}</small></div>
            <span class="course__go"><i class="i-arrow"></i></span>
          </div>
        </div>
      </button>`).join("");
  };
  renderCourses();
  $("#courseTabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab"); if (!b) return;
    $$(".tab").forEach((t) => t.classList.toggle("is-active", t === b));
    renderCourses(b.dataset.filter);
  });
  coursesEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-course]");
    if (card) openEnroll(card.dataset.course);
  });

  /* ---------- course select ---------- */
  const courseOptions = (sel) => `<option value="">${esc(T("form.pickCourse", "Kursni tanlang"))}</option>` + COURSES.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.title)}</option>`).join("");
  $("#msgCourse").innerHTML = courseOptions();

  /* ---------- teachers ---------- */
  $("#teachers").innerHTML = TEACHERS.map((t) => {
    const c = courseById[t.course];
    return `<article class="teacher reveal" style="--c:${c ? c.color : "#10b981"}; --soft:${c && c.soft ? c.soft : "#eef6f1"}">
      <div class="teacher__photo">
        <div class="teacher__ph"><span>${esc(initials(t.name))}</span></div>
        ${img(t.photo, t.name)}
        <span class="teacher__exp">${esc(t.exp)} ${tt("teacher.exp", "tajriba")}</span>
        <a class="teacher__social" href="${esc(SITE.telegram)}" target="_blank" rel="noopener" aria-label="Telegram"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21.5 4.5 2.8 11.7c-1 .4-1 1.6.1 1.9l4.7 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.9 3.6c.6.4 1.4.1 1.6-.6l3.3-15.6c.2-1-.8-1.9-1.9-1.6ZM9.6 14.6l-.4 4 .1-.1L18 7.6Z"/></svg></a>
      </div>
      <div class="teacher__info">
        <h4>${esc(t.name)}</h4>
        <div class="teacher__role">${esc(t.role)}</div>
        <div class="teacher__meta"><span>${esc(c ? c.title : "")}</span><span>${esc(t.note)}</span></div>
      </div>
    </article>`;
  }).join("");

  /* ---------- attendance ---------- */
  let attType = "student";
  const seg = $("#attType"), attCode = $("#attCode"), attResult = $("#attResult"), attField = $(".att__field");
  const setType = (type) => {
    attType = type;
    seg.classList.toggle("is-teacher", type === "teacher");
    $$(".seg__btn", seg).forEach((b) => b.classList.toggle("is-active", b.dataset.type === type));
    attCode.placeholder = type === "teacher" ? "Masalan: UST-101" : "Masalan: MG-1001";
  };
  seg.addEventListener("click", (e) => { const b = e.target.closest(".seg__btn"); if (b) setType(b.dataset.type); });
  $$(".chip").forEach((c) => c.addEventListener("click", () => {
    const code = c.dataset.code;
    setType(code.startsWith("UST") ? "teacher" : "student");
    attCode.value = code; checkAttendance();
  }));
  $("#attForm").addEventListener("submit", (e) => { e.preventDefault(); checkAttendance(); });

  async function checkAttendance() {
    const code = attCode.value.trim().toUpperCase().replace(/\s+/g, "");
    let rec = ATTENDANCE[code];
    if (window.sb && code) {
      attResult.innerHTML = `<div class="att__empty"><div class="att__empty-icon"><i class="i-search"></i></div><p>${tt("att.loading", "Tekshirilmoqda...")}</p></div>`;
      const types = [attType, attType === "student" ? "teacher" : "student"];
      rec = null;
      for (const tp of types) {
        const { data, error } = await window.sb.rpc("check_attendance", { p_code: code, p_type: tp });
        if (error) { attResult.innerHTML = `<div class="res res--error"><div class="att__empty-icon">!</div><b>${tt("att.netErr", "Server bilan aloqa yo'q")}</b><p style="margin-top:8px;font-size:14px">${tt("att.netErr2", "Birozdan so'ng qayta urinib ko'ring.")}</p></div>`; return; }
        if (data && data[0]) { rec = { ...data[0], group: data[0].grp, course: data[0].course_id, log: data[0].log || [] }; break; }
      }
    }
    if (!code || !rec || rec.type !== attType) {
      attField.classList.remove("is-error"); void attField.offsetWidth; attField.classList.add("is-error");
      const hint = rec && rec.type !== attType ? tt("att.wrongType", "Bu kod boshqa turga tegishli — yuqoridan to'g'ri turni (O'quvchi / Ustoz) tanlang.") : tt("att.notFoundHint", "Kodni tekshirib, qayta urinib ko'ring yoki administratorga murojaat qiling.");
      attResult.innerHTML = `<div class="res res--error"><div class="att__empty-icon">✕</div><b>${code ? tt("att.notFound", "Kod topilmadi") : tt("att.enterCode", "Kodni kiriting")}</b><p style="margin-top:8px;font-size:14px">${hint}</p></div>`;
      return;
    }
    const total = rec.log.length || 1;
    const came = rec.log.filter((s) => s === 1).length;
    const missed = rec.log.filter((s) => s === 0).length;
    const excused = rec.log.filter((s) => s === 2).length;
    const pct = Math.round(((came + excused) / total) * 100);
    const course = courseById[rec.course];
    const isT = rec.type === "teacher";
    const good = pct >= 85;
    attResult.innerHTML = `<div class="res">
      <div class="res__head">
        <span class="res__av">${esc(initials(rec.name))}</span>
        <div><b>${esc(rec.name)}</b><small>${esc(course ? course.title : "")} · ${esc(rec.group)}</small></div>
        <span class="res__tag">${isT ? tt("att.teacher", "Ustoz") : tt("att.student", "O'quvchi")} · ${esc(code)}</span>
      </div>
      <div class="res__main">
        <div class="ring" style="--p:0">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" class="ring__val" style="stroke:${good ? "var(--em)" : "var(--amber)"}"/></svg>
          <div class="ring__label"><b data-pct>0%</b><small>${tt("dash.ring", "davomat")}</small></div>
        </div>
        <div class="res__nums">
          <div><small>${tt("res.total", "Jami darslar")}</small><b>${total}</b></div>
          <div><small>${isT ? tt("res.held", "O'tkazdi") : tt("dash.came", "Keldi")}</small><b class="ok">${came}</b></div>
          <div><small>${tt("dash.missed", "Kelmadi")}</small><b class="bad">${missed}</b></div>
          <div><small>${tt("res.excused", "Sababli")}</small><b class="warn">${excused}</b></div>
        </div>
      </div>
      <div class="res__label"><span>${tt("res.last", "Oxirgi darslar")}</span><span>${total} ${tt("res.pcs", "ta")}</span></div>
      <div class="res__grid">${rec.log.map((s, i) => `<span class="s${s}" style="animation-delay:${i * 25}ms" title="${i + 1}-dars">${i + 1}</span>`).join("")}</div>
      <div class="res__legend"><span><i style="background:#9fe6c6"></i>${tt("dash.came", "Keldi")}</span><span><i style="background:#f5b5b5"></i>${tt("dash.missed", "Kelmadi")}</span><span><i style="background:#f8dc8c"></i>${tt("res.excused", "Sababli")}</span></div>
      <div class="res__msg ${good ? "" : "is-warn"}">${good ? (isT ? tt("res.goodT", "Ajoyib! Barcha darslar o'z vaqtida o'tkazilmoqda.") : tt("res.good", "Zo'r natija! Shu tarzda davom eting 💪")) : tt("res.warn", "Davomat 85% dan past. Qoldirilgan darslarni ustoz bilan to'ldirib oling.")}</div>
    </div>`;
    const ring = $(".res .ring", attResult), label = $("[data-pct]", attResult);
    requestAnimationFrame(() => requestAnimationFrame(() => ring.style.setProperty("--p", pct)));
    animateNum(label, pct, "%", 1200);
  }

  /* ---------- counters & reveal ---------- */
  function animateNum(el, to, suffix = "", dur = 1600) {
    const start = performance.now();
    const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3)))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      const n = $("[data-count]", e.target);
      if (n) animateNum(n, +n.dataset.count);
      revealObs.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 80}ms`; revealObs.observe(el); });

  /* ---------- leads storage ---------- */
  const saveLead = (lead) => {
    if (window.sb) {
      const row = { type: lead.type, name: lead.name, phone: lead.phone, course: lead.course || null, time: lead.time || null, message: lead.message || null };
      window.sb.from("leads").insert(row).then(({ error }) => { if (error) console.warn("Ariza yuborilmadi:", error.message); });
      return;
    }
    try {
      const all = JSON.parse(localStorage.getItem("itpark_leads") || "[]");
      all.push({ ...lead, at: new Date().toISOString() });
      localStorage.setItem("itpark_leads", JSON.stringify(all));
    } catch (_) { /* storage unavailable — ignore */ }
  };
  const phoneOk = (v) => v.replace(/\D/g, "").length >= 9;
  const validate = (form) => {
    let ok = true;
    $$("[required]", form).forEach((inp) => {
      const bad = !inp.value.trim() || (inp.name === "phone" && !phoneOk(inp.value));
      inp.closest(".field").classList.toggle("is-error", bad);
      if (bad) ok = false;
    });
    return ok;
  };
  const maskPhone = (inp) => inp.addEventListener("input", () => {
    let d = inp.value.replace(/\D/g, "");
    if (d.startsWith("998")) d = d.slice(3);
    d = d.slice(0, 9);
    const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
    inp.value = d ? "+998 " + p.join(" ") : "";
  });
  const clearErr = (root) => $$(".field input", root).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-error")));

  /* ---------- toast ---------- */
  let toastT;
  const toast = (msg) => {
    const t = $("#toast"); t.textContent = msg; t.classList.add("is-show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-show"), 3200);
  };

  /* ---------- modal ---------- */
  const modal = $("#modal"), modalBody = $("#modalBody");
  let lastFocus;
  const openModal = (html) => {
    lastFocus = document.activeElement;
    modalBody.innerHTML = html;
    modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    clearErr(modalBody);
    setTimeout(() => { const f = $("input", modalBody); f && f.focus(); }, 80);
  };
  const closeModal = () => {
    modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lastFocus && lastFocus.focus();
  };
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });

  const successHtml = (title, text) => `<div class="success"><div class="success__icon">✓</div><h3>${title}</h3><p class="muted">${text}</p><button class="btn btn--dark" data-close>${tt("modal.close", "Yopish")}</button></div>`;

  function openEnroll(courseId = "") {
    const c = courseById[courseId];
    openModal(`
      <h3>${c ? tt("enroll.titleCourse", "Kursga yozilish") : tt("enroll.title", "Ro'yxatdan o'tish")}</h3>
      <p class="muted">${tt("enroll.lead", "Ma'lumotlaringizni qoldiring — bepul sinov darsiga taklif qilamiz.")}</p>
      ${c ? `<div class="modal__course" style="--c:${c.color}; --soft:${c.soft || "#eef6f1"}"><span class="modal__thumb"><span class="cover__icon" style="position:absolute;inset:0">${icon(c.icon)}</span>${img(c.image, c.title)}</span><div><b>${esc(c.title)}</b><small>${esc(c.duration)} · ${esc(c.price)} ${tt("course.som", "so'm")} / ${tt("course.mo", "oy")}</small></div></div>` : ""}
      <form id="enrollForm" novalidate>
        <label class="field">${tt("form.name", "Ismingiz")}<input name="name" required placeholder="Ism Familiya" /></label>
        <label class="field">${tt("form.phone", "Telefon raqam")}<input name="phone" required placeholder="+998 __ ___ __ __" inputmode="tel" /></label>
        <label class="field">${tt("form.courseShort", "Kurs")}<select name="course">${courseOptions(courseId)}</select></label>
        <label class="field">${tt("form.time", "Qulay vaqt")}<select name="time"><option>${esc(T("form.time1", "Ertalab (09:00 – 12:00)"))}</option><option>${esc(T("form.time2", "Tushlik (13:00 – 16:00)"))}</option><option>${esc(T("form.time3", "Kechki (16:00 – 19:00)"))}</option></select></label>
        <button class="btn btn--primary btn--block" type="submit">${tt("msg.btn", "Yuborish")} <i class="i-arrow"></i></button>
      </form>`);
    const f = $("#enrollForm");
    maskPhone(f.elements.phone);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(f)) return;
      const name = f.elements.name.value.trim();
      saveLead({ type: "enroll", name, phone: f.elements.phone.value, course: f.elements.course.value, time: f.elements.time.value });
      modalBody.innerHTML = successHtml(`${tt("enroll.thanks", "Rahmat,")} ${esc(name.split(" ")[0])}!`, tt("enroll.done", "Arizangiz qabul qilindi. Administrator 15 daqiqa ichida siz bilan bog'lanadi."));
    });
  }
  $$("[data-enroll]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); openEnroll(); }));

  $("#openJoin").addEventListener("click", () => {
    openModal(`
      <h3>${tt("join.mTitle", "Ustozlar jamoasiga ariza")}</h3>
      <p class="muted">${tt("join.mLead", "Qisqacha ma'lumot qoldiring — HR bo'limi siz bilan bog'lanadi.")}</p>
      <form id="joinForm" novalidate>
        <label class="field">${tt("form.fullName", "Ism Familiya")}<input name="name" required /></label>
        <label class="field">${tt("form.phone", "Telefon raqam")}<input name="phone" required placeholder="+998 __ ___ __ __" inputmode="tel" /></label>
        <label class="field">${tt("form.direction", "Yo'nalish")}<select name="course">${courseOptions()}</select></label>
        <label class="field">${tt("form.exp", "Tajriba va sertifikatlar")}<textarea name="message" rows="3" placeholder="Masalan: 3 yil, IELTS 7.5"></textarea></label>
        <button class="btn btn--primary btn--block" type="submit">${tt("join.btn", "Ariza yuborish")} <i class="i-arrow"></i></button>
      </form>`);
    const f = $("#joinForm");
    maskPhone(f.elements.phone);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(f)) return;
      saveLead({ type: "teacher", name: f.elements.name.value.trim(), phone: f.elements.phone.value, course: f.elements.course.value, message: f.elements.message.value.trim() });
      modalBody.innerHTML = successHtml(tt("join.doneTitle", "Arizangiz yuborildi!"), tt("join.done", "Ko'rib chiqib, 2–3 ish kuni ichida siz bilan bog'lanamiz."));
    });
  });

  const msgForm = $("#msgForm");
  maskPhone(msgForm.elements.phone);
  clearErr(msgForm);
  msgForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(msgForm)) { toast(T("toast.invalid", "Iltimos, ism va telefon raqamni to'g'ri kiriting")); return; }
    const el = msgForm.elements;
    saveLead({ type: "message", name: el.name.value.trim(), phone: el.phone.value, course: el.course.value, message: el.message.value.trim() });
    msgForm.reset();
    toast(T("toast.sent", "✓ Xabaringiz yuborildi — tez orada bog'lanamiz!"));
  });
})();
