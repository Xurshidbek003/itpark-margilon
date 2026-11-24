// Supabase ulanishi. Supabase → Project Settings → API (yoki "Connect") bo'limidan oling.
// "anon public" kalit ochiq kalit — uni saytga qo'yish xavfsiz (huquqlar bazadagi RLS qoidalari bilan cheklangan).
// HECH QACHON "service_role" (secret) kalitini bu yerga qo'ymang!
window.APP_CONFIG = {
  supabaseUrl: "",   // masalan: https://abcdxyz.supabase.co
  supabaseKey: "",   // anon public key (eyJ... bilan boshlanadi) yoki sb_publishable_...
};
