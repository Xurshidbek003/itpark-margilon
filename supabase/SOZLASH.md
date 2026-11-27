# Admin panelni ulash (Supabase) — 5 daqiqa

1. **Loyiha yarating:** https://supabase.com → *Start your project* → GitHub bilan kiring →
   *New project*. Nomi: `itpark-margilon`, Region: *Central EU (Frankfurt)*.
   Database parolini o'ylab toping va saqlab qo'ying.
2. **Bazani yarating:** chap menyuda *SQL Editor* → *New query* → `supabase/schema.sql`
   faylining hammasini joylang → **Run**. ("Success" chiqishi kerak.)
3. **Admin foydalanuvchi:** *Authentication → Users → Add user → Create new user*.
   Email va parol kiriting, **Auto Confirm User** belgisini qo'ying → *Create user*.
4. **Uni admin qiling:** *SQL Editor* → yangi so'rov:
   `insert into public.admins (email) values ('SIZNING@EMAIL.UZ');` → Run.
5. **Begonalar ro'yxatdan o'tmasin:** *Authentication → Sign In / Providers → Email* →
   **Allow new users to sign up** ni o'chiring → Save.
6. **Kalitlar:** *Project Settings → API Keys* (yoki yuqoridagi *Connect* tugmasi):
   **Project URL** va **anon public** (yoki *publishable*) kalitni `config.js` ga yozing.
   ⚠️ `service_role` / `secret` kalitni hech qachon saytga qo'ymang.

Admin panel manzili: `https://xurshidbek003.github.io/itpark-margilon/admin/`

## CRM (guruhlar, o'quvchilar, davomat, avtomatik sertifikatlar)

7. *SQL Editor* → *New query* → `supabase/crm.sql` faylining hammasini joylang → **Run**.
   (`schema.sql` va `sertifikat.sql` dan keyin. Qayta ishga tushirish xavfsiz.)
8. **(Ixtiyoriy) Har kecha avtomatik tekshirish:** *Database → Extensions* → `pg_cron` ni yoqing,
   so'ng *SQL Editor*da:
   `select cron.schedule('itpark-finish-groups', '5 19 * * *', 'select public._finish_due_groups()');`
   Bu qadamsiz ham ishlaydi: admin panelga har kirilganda muddati tugagan guruhlar tekshiriladi.

**Ish tartibi:** Kurs → Guruh (kurs, ustoz, muddat, dars kunlari) → guruhga o'quvchi qo'shish →
"Davomat olish" → tugash sanasidan keyingi kuni guruh avtomatik yakunlanadi va har bir o'quvchiga
sertifikat **"Tasdiqlash kutilmoqda"** holatida yaratiladi → *Sertifikatlar* bo'limida tasdiqlang →
sertifikat faollashadi (QR orqali tekshiriladi, PDF/PNG yuklab olinadi).
