// Sertifikat chizish, QR va yuklab olish (PDF/PNG). Tekshirish sahifasi va admin panel ishlatadi.
(() => {
  const ROOT = new URL(".", document.currentScript.src).href;
  const W = 1123, H = 794; // A4 albom, 96 dpi
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const abs = (u) => !u ? "" : /^(https?:|data:|blob:)/.test(u) ? u : new URL(u.replace(/^\.?\//, ""), ROOT).href;
  const verifyUrl = (n) => new URL("sertifikat/?n=" + encodeURIComponent(n), ROOT).href;

  const LIBS = {
    qr: ["https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js", "qrcode"],
    h2c: ["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "html2canvas"],
    pdf: ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf"],
  };
  const loading = {};
  const lib = (k) => {
    const [src, g] = LIBS[k];
    if (window[g]) return Promise.resolve(window[g]);
    return loading[k] || (loading[k] = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = src; s.onload = () => res(window[g]); s.onerror = () => rej(new Error("Kutubxona yuklanmadi: " + src));
      document.head.appendChild(s);
    }));
  };

  if (!document.querySelector("link[data-cert-fonts]")) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.dataset.certFonts = "1";
    l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap";
    document.head.appendChild(l);
  }
  const css = document.createElement("style");
  css.textContent = `
    .certwrap { position: relative; width: 100%; overflow: hidden; border-radius: 6px; box-shadow: 0 20px 50px -24px rgba(0,0,0,.35); background: #fff; }
    .cert { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: #fff; overflow: hidden; transform-origin: 0 0; font-family: Roboto, Arial, sans-serif; color: #111; isolation: isolate; }
    .cert * { box-sizing: border-box; }
    .cert__deco { position: absolute; right: 0; top: 0; width: 190px; height: ${H}px; }
    .cert__logos { position: absolute; left: 62px; top: 62px; height: 76px; width: 650px; display: flex; align-items: center; gap: 38px; }
    .cert__logos img { max-height: 70px; max-width: 200px; object-fit: contain; display: block; }
    .cert__qr { position: absolute; left: 770px; top: 64px; width: 128px; height: 128px; }
    .cert__qr svg { width: 100%; height: 100%; display: block; }
    .cert__title { position: absolute; left: 56px; top: 200px; margin: 0; font: 500 97px/1 Montserrat, Arial, sans-serif; color: #74d11a; letter-spacing: -1px; white-space: nowrap; }
    .cert__name { position: absolute; left: 60px; top: 330px; width: 660px; font: 500 56px/1.15 Roboto, Arial, sans-serif; white-space: nowrap; }
    .cert__line { position: absolute; left: 60px; top: 398px; width: 657px; height: 2px; background: #1b1b1b; }
    .cert__course { position: absolute; left: 62px; top: 413px; width: 720px; font: 500 31px/1.25 Roboto, Arial, sans-serif; color: #74d11a; white-space: nowrap; }
    .cert__done { position: absolute; left: 62px; top: 462px; width: 720px; font: 500 31px/1.25 Roboto, Arial, sans-serif; white-space: nowrap; }
    .cert__signer { position: absolute; top: 548px; left: 250px; width: 320px; text-align: center; }
    .cert__sign { position: relative; z-index: 1; height: 152px; display: flex; align-items: flex-end; justify-content: center; }
    .cert__sign img { max-height: 152px; max-width: 280px; object-fit: contain; display: block; }
    .cert__sline { width: 150px; height: 1.5px; background: #222; margin: -10px auto 0; }
    .cert__sname { font: 700 18.5px/1.2 Montserrat, Arial, sans-serif; margin-top: 10px; color: #1b1b1b; }
    .cert__stitle { font: 400 13px/1.3 Montserrat, Arial, sans-serif; color: #5a5a5a; margin-top: 6px; }
    .cert__num { position: absolute; left: 806px; top: 627px; width: 152px; height: 66px; border-top: 1.5px solid #222; border-bottom: 1.5px solid #222; display: flex; align-items: center; justify-content: center; font: 500 33px/1 Roboto, Arial, sans-serif; letter-spacing: .3px; }
    .cert__void { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-18deg); font: 700 84px/1 Montserrat, Arial, sans-serif; color: rgba(214,48,48,.75); border: 8px solid rgba(214,48,48,.75); padding: 10px 30px; border-radius: 16px; white-space: nowrap; z-index: 5; }
  `;
  document.head.appendChild(css);

  // O'ng tomondagi yashil qirrali bezak
  function deco() {
    const P = [[190, 0], [32, 128], [86, 198], [0, 246], [72, 318], [18, 388], [104, 468], [58, 522], [132, 592], [86, 652], [160, 722], [146, 794], [190, 794]];
    const C = ["#6fd31b", "#a5f43b", "#5ec415", "#94ec27", "#7bdc1d", "#b6f752", "#66cc18"];
    let tri = "";
    for (let i = 0; i < P.length - 2; i++) {
      const a = P[i], b = P[i + 1], my = (a[1] + b[1]) / 2;
      tri += `<polygon points="${a} ${b} 190,${my + 30}" fill="${C[i % C.length]}"/>`;
      tri += `<polygon points="${b} 190,${my + 30} 190,${b[1] + 70}" fill="${C[(i + 3) % C.length]}" opacity=".85"/>`;
    }
    return `<svg class="cert__deco" viewBox="0 0 190 ${H}" preserveAspectRatio="none"><polygon points="${P.map((p) => p.join(",")).join(" ")}" fill="#86e01f"/>${tri}</svg>`;
  }

  const signerOf = (tpl) => (tpl && (tpl.signer || (tpl.signers || [])[1] || (tpl.signers || [])[0])) || null;

  async function build(cert, tpl) {
    tpl = tpl || {};
    let qrSvg = "";
    try {
      const qrcode = await lib("qr");
      const q = qrcode(0, "M"); q.addData(verifyUrl(cert.number)); q.make();
      qrSvg = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (_) { qrSvg = ""; }
    const logos = (tpl.logos || []).filter(Boolean).map((u) => `<img src="${esc(abs(u))}" crossorigin="anonymous" alt="" />`).join("");
    // Bitta imzo. Eski shablonlarda (signers: [1-imzo, 2-imzo]) 2-imzo olinadi.
    const s = signerOf(tpl);
    const signers = s && (s.name || s.title || s.image) ? `
      <div class="cert__signer">
        <div class="cert__sign">${s.image ? `<img src="${esc(abs(s.image))}" crossorigin="anonymous" alt="" />` : ""}</div>
        <div class="cert__sline"></div>
        <div class="cert__sname">${esc(s.name)}</div>
        <div class="cert__stitle">${esc(s.title)}</div>
      </div>` : "";
    const el = document.createElement("div");
    el.className = "cert";
    el.innerHTML = `${deco()}
      <div class="cert__logos">${logos}</div>
      <div class="cert__qr">${qrSvg}</div>
      <h1 class="cert__title">${esc(tpl.heading || "CERTIFICATE")}</h1>
      <div class="cert__name">${esc(cert.full_name)}</div>
      <div class="cert__line"></div>
      <div class="cert__course">${esc(cert.course)}</div>
      <div class="cert__done">${esc(tpl.done || "kursini muvaffaqiyatli yakunladi")}</div>
      ${signers}
      <div class="cert__num">${esc(cert.number)}</div>
      ${cert.revoked ? `<div class="cert__void">BEKOR QILINGAN</div>` : ""}`;
    return el;
  }
  // Uzun ism/kurs nomlari sig'ishi uchun shriftni kichraytirish
  function fit(el) {
    [[".cert__name", 660, 56], [".cert__course", 720, 31], [".cert__done", 720, 31], [".cert__title", 690, 97]].forEach(([sel, max, base]) => {
      const n = el.querySelector(sel); if (!n) return;
      let size = base; n.style.fontSize = size + "px";
      while (n.scrollWidth > max && size > 14) { size -= 1; n.style.fontSize = size + "px"; }
    });
  }
  const ready = (el) => Promise.all([document.fonts ? document.fonts.ready : null,
    ...[...el.querySelectorAll("img")].map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))]);

  // Ekranda ko'rsatish (konteyner kengligiga moslashadi)
  async function mount(wrap, cert, tpl) {
    wrap.innerHTML = ""; wrap.classList.add("certwrap");
    const el = await build(cert, tpl);
    wrap.appendChild(el);
    const scale = () => { const k = wrap.clientWidth / W; el.style.transform = `scale(${k})`; wrap.style.height = H * k + "px"; };
    scale(); new ResizeObserver(scale).observe(wrap);
    fit(el); ready(el).then(() => fit(el));
    return el;
  }

  // Yuklab olish: type = "pdf" | "png"
  async function download(cert, tpl, type = "pdf") {
    const [h2c] = await Promise.all([lib("h2c"), type === "pdf" ? lib("pdf") : null]);
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;overflow:hidden;`;
    document.body.appendChild(host);
    try {
      const el = await build(cert, tpl);
      host.appendChild(el); fit(el); await ready(el); fit(el);
      const canvas = await h2c(el, { scale: 2.5, useCORS: true, backgroundColor: "#ffffff", logging: false, width: W, height: H });
      const name = `sertifikat-${cert.number}`;
      if (type === "png") {
        const a = document.createElement("a"); a.download = name + ".png"; a.href = canvas.toDataURL("image/png"); a.click();
      } else {
        const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 297, 210);
        pdf.save(name + ".pdf");
      }
    } finally { host.remove(); }
  }

  window.Cert = { mount, download, verifyUrl, abs, signerOf };
})();
