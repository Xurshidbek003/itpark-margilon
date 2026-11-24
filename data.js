// Barcha ma'lumotlar shu yerda — o'zgartirish uchun faqat shu faylni tahrirlang.
window.SITE = {
  phone: "+998 90 123 45 67",
  address: "Marg'ilon shahri, Mustaqillik ko'chasi, 24-uy",
  hours: "Dushanba — Shanba, 09:00 — 19:00",
  googleForm: "https://forms.google.com/",
  telegram: "https://t.me/",
  instagram: "https://instagram.com/",
};

// image: kurs rasmi (tavsiya 1200x900 px, .jpg). Fayl bo'lmasa, pastel muqova chiqadi.
// soft: karta uchun och fon rangi.
window.COURSES = [
  {
    id: "it", image: "images/kurslar/it.jpg", soft: "#e3f7ee", cat: "it", icon: "code", color: "#10b981",
    title: "IT & Dasturlash", level: "Boshlang'ichdan", duration: "8 oy", price: "450 000",
    lessons: "Haftada 3 marta · 2 soat",
    desc: "Python, veb-dasturlash (HTML, CSS, JavaScript) va real loyihalar. Portfolio bilan yakunlanadi.",
    tags: ["Python", "Frontend", "Git", "Loyihalar"],
  },
  {
    id: "en", image: "images/kurslar/ingliz.jpg", soft: "#e6f0fe", cat: "lang", icon: "globe", color: "#3b82f6",
    title: "Ingliz tili", level: "Beginner — IELTS", duration: "6–12 oy", price: "350 000",
    lessons: "Haftada 3 marta · 1.5 soat",
    desc: "General English va IELTS tayyorlov. Speaking club va har oylik mock test.",
    tags: ["IELTS", "Speaking club", "Mock test"],
  },
  {
    id: "math", image: "images/kurslar/matematika.jpg", soft: "#fff3dc", cat: "exam", icon: "sigma", color: "#f59e0b",
    title: "Matematika", level: "5–11 sinf, abituriyent", duration: "9 oy", price: "300 000",
    lessons: "Haftada 3 marta · 2 soat",
    desc: "Maktab dasturi, olimpiada masalalari va DTM testlariga tizimli tayyorgarlik.",
    tags: ["DTM", "Olimpiada", "Maktab"],
  },
  {
    id: "ko", image: "images/kurslar/koreys.jpg", soft: "#fde8f2", cat: "lang", icon: "hangul", color: "#ec4899",
    title: "Koreys tili", level: "TOPIK I — II", duration: "8 oy", price: "380 000",
    lessons: "Haftada 3 marta · 1.5 soat",
    desc: "Hangul alifbosidan TOPIK imtihonigacha. Koreyaga o'qish va ish uchun tayyorlov.",
    tags: ["TOPIK", "Hangul", "Grammatika"],
  },
  {
    id: "de", image: "images/kurslar/nemis.jpg", soft: "#efe9fd", cat: "lang", icon: "chat", color: "#8b5cf6",
    title: "Nemis tili", level: "A1 — B2", duration: "9 oy", price: "380 000",
    lessons: "Haftada 3 marta · 1.5 soat",
    desc: "Goethe va telc sertifikatlariga tayyorlov. Ausbildung dasturlari bo'yicha maslahat.",
    tags: ["Goethe", "Ausbildung", "A1–B2"],
  },
  {
    id: "cert", image: "images/kurslar/sertifikat.jpg", soft: "#def6f3", cat: "exam", icon: "award", color: "#14b8a6",
    title: "Milliy sertifikat", level: "Ona tili, tarix, matematika", duration: "4–6 oy", price: "320 000",
    lessons: "Haftada 3 marta · 2 soat",
    desc: "Milliy sertifikat imtihonining yangi formatiga moslashtirilgan intensiv kurs.",
    tags: ["A+ daraja", "Intensiv", "Test"],
  },
];

// photo: ustoz rasmi (tavsiya 800x920 px, vertikal). Fayl bo'lmasa, ismining bosh harflari chiqadi.
window.TEACHERS = [
  { name: "Azizbek Karimov", photo: "images/ustozlar/azizbek.jpg", role: "Python & Backend", exp: "6 yil", course: "it", note: "Ex-EPAM dasturchi" },
  { name: "Madina Yusupova", photo: "images/ustozlar/madina.jpg", role: "Ingliz tili · IELTS", exp: "5 yil", course: "en", note: "IELTS 8.0" },
  { name: "Jasur Tursunov", photo: "images/ustozlar/jasur.jpg", role: "Matematika", exp: "9 yil", course: "math", note: "Olimpiada murabbiyi" },
  { name: "Ji-woo Park", photo: "images/ustozlar/jiwoo.jpg", role: "Koreys tili", exp: "4 yil", course: "ko", note: "Ona tili — koreys" },
  { name: "Nodira Rahimova", photo: "images/ustozlar/nodira.jpg", role: "Nemis tili", exp: "7 yil", course: "de", note: "Goethe C1" },
  { name: "Sardor Aliyev", photo: "images/ustozlar/sardor.jpg", role: "Frontend · JavaScript", exp: "4 yil", course: "it", note: "React mutaxassisi" },
];

// Davomat bazasi (demo). status: 1 = keldi, 0 = kelmadi, 2 = sababli
window.ATTENDANCE = {
  "MG-1001": { type: "student", name: "Diyora Xasanova", course: "it", group: "IT-24 (ertalab)", log: [1,1,1,0,1,1,1,1,2,1,1,1,1,0,1,1] },
  "MG-1002": { type: "student", name: "Bekzod Ergashev", course: "en", group: "EN-B1 (kechki)", log: [1,1,0,1,1,1,0,1,1,1,1,1] },
  "MG-1003": { type: "student", name: "Shahzoda Mirzayeva", course: "ko", group: "KO-2 (ertalab)", log: [1,1,1,1,1,1,1,1,1,1,2,1] },
  "MG-1004": { type: "student", name: "Ulug'bek Nazarov", course: "math", group: "MATH-11 (tushlik)", log: [1,0,0,1,1,0,1,1,0,1,1,1,0,1] },
  "UST-101": { type: "teacher", name: "Azizbek Karimov", course: "it", group: "IT-24, IT-25", log: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1] },
  "UST-102": { type: "teacher", name: "Madina Yusupova", course: "en", group: "EN-B1, EN-IELTS", log: [1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
};
