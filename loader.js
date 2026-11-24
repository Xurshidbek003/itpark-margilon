// Saytni Supabase'dagi ma'lumotlar bilan to'ldiradi, keyin app.js ni ishga tushiradi.
// Supabase sozlanmagan yoki javob bermasa — data.js dagi ma'lumotlar ishlatiladi.
(async () => {
  const cfg = window.APP_CONFIG || {};
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  if (cfg.supabaseUrl && cfg.supabaseKey && window.supabase) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: false } });
    window.sb = sb;
    try {
      const [s, c, t] = await withTimeout(Promise.all([
        sb.from("settings").select("key,value"),
        sb.from("courses").select("*").eq("active", true).order("sort"),
        sb.from("teachers").select("*").eq("active", true).order("sort"),
      ]), 5000);
      if (s.error || c.error || t.error) throw s.error || c.error || t.error;
      const settings = Object.fromEntries((s.data || []).map((r) => [r.key, r.value]));
      if (settings.site) window.SITE = { ...window.SITE, ...settings.site };
      if (Array.isArray(settings.stats)) window.STATS = settings.stats;
      if (c.data && c.data.length) window.COURSES = c.data.map((x) => ({ ...x, desc: x.description, tags: x.tags || [] }));
      if (t.data) window.TEACHERS = t.data.map((x) => ({ ...x, course: x.course_id }));
      window.ATTENDANCE = {}; // davomat endi faqat server orqali tekshiriladi
      window.DATA_SOURCE = "supabase";
    } catch (e) {
      console.warn("Supabase'dan ma'lumot olinmadi, data.js ishlatiladi:", e.message || e);
      window.sb = null;
    }

    // Tashrifni yozib qo'yish (statistika uchun)
    try {
      let vid = null;
      try {
        vid = localStorage.getItem("itp_vid");
        if (!vid) { vid = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2); localStorage.setItem("itp_vid", vid); }
      } catch (_) { vid = "anon-" + String(Math.random()).slice(2, 10); }
      const w = innerWidth;
      sb.from("visits").insert({
        visitor_id: vid,
        path: (location.pathname + location.hash).slice(0, 300),
        referrer: (document.referrer || "").slice(0, 300),
        device: w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop",
      }).then(() => {});
    } catch (_) { /* statistika ixtiyoriy */ }
  }

  const s = document.createElement("script");
  s.src = "app.js?v=3";
  document.body.appendChild(s);
})();
