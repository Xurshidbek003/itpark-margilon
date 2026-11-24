-- =====================================================================
--  IT Park Marg'ilon — Supabase sxemasi
--  Supabase → SQL Editor → New query → shu faylni to'liq joylab → Run
--  (Qayta ishga tushirish xavfsiz: mavjud ma'lumotlar o'chirilmaydi.)
-- =====================================================================

-- ---------- ADMINLAR ----------
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- ---------- SOZLAMALAR ----------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ---------- KURSLAR ----------
create table if not exists public.courses (
  id text primary key,
  title text not null,
  cat text not null default 'it' check (cat in ('it','lang','exam')),
  icon text default 'code',
  color text default '#10b981',
  soft text default '#e3f7ee',
  level text, duration text, price text, lessons text,
  description text,
  tags text[] default '{}',
  image text,
  sort int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- ---------- USTOZLAR ----------
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo text, role text, exp text, note text,
  course_id text references public.courses(id) on delete set null,
  sort int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- ---------- DAVOMAT ----------
create table if not exists public.attendance (
  code text primary key,
  type text not null default 'student' check (type in ('student','teacher')),
  name text not null,
  course_id text references public.courses(id) on delete set null,
  grp text,
  log smallint[] not null default '{}',   -- 1 keldi, 0 kelmadi, 2 sababli
  updated_at timestamptz default now()
);

-- ---------- ARIZALAR ----------
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  type text not null default 'message' check (type in ('enroll','message','teacher')),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 5 and 30),
  course text, time text,
  message text check (char_length(coalesce(message,'')) <= 2000),
  status text not null default 'new' check (status in ('new','contacted','done','rejected')),
  created_at timestamptz default now()
);

-- ---------- TASHRIFLAR ----------
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  visitor_id text not null check (char_length(visitor_id) <= 64),
  path text check (char_length(coalesce(path,'')) <= 300),
  referrer text check (char_length(coalesce(referrer,'')) <= 300),
  device text check (device in ('mobile','tablet','desktop')),
  created_at timestamptz default now()
);
create index if not exists visits_created_idx on public.visits (created_at);
create index if not exists leads_created_idx on public.leads (created_at);

-- =====================================================================
--  XAVFSIZLIK (Row Level Security)
-- =====================================================================
alter table public.admins     enable row level security;
alter table public.settings   enable row level security;
alter table public.courses    enable row level security;
alter table public.teachers   enable row level security;
alter table public.attendance enable row level security;
alter table public.leads      enable row level security;
alter table public.visits     enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('admins','settings','courses','teachers','attendance','leads','visits')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- hamma o'qiydi, faqat admin yozadi
create policy "public read"  on public.settings for select using (true);
create policy "admin write"  on public.settings for all using (public.is_admin()) with check (public.is_admin());
create policy "public read"  on public.courses  for select using (active or public.is_admin());
create policy "admin write"  on public.courses  for all using (public.is_admin()) with check (public.is_admin());
create policy "public read"  on public.teachers for select using (active or public.is_admin());
create policy "admin write"  on public.teachers for all using (public.is_admin()) with check (public.is_admin());
-- davomat: faqat admin ko'radi (saytda faqat kod orqali RPC bilan)
create policy "admin all"    on public.attendance for all using (public.is_admin()) with check (public.is_admin());
-- arizalar va tashriflar: hamma yubora oladi, faqat admin o'qiydi
create policy "anyone insert" on public.leads  for insert with check (status = 'new');
create policy "admin all"     on public.leads  for all using (public.is_admin()) with check (public.is_admin());
create policy "anyone insert" on public.visits for insert with check (true);
create policy "admin read"    on public.visits for select using (public.is_admin());
create policy "admin delete"  on public.visits for delete using (public.is_admin());
create policy "admin read"    on public.admins for select using (public.is_admin());

-- =====================================================================
--  FUNKSIYALAR
-- =====================================================================
-- Saytdagi davomat tekshiruvi: faqat bitta kod bo'yicha natija qaytaradi
create or replace function public.check_attendance(p_code text, p_type text)
returns table (code text, type text, name text, course_id text, grp text, log smallint[])
language sql stable security definer set search_path = public as $$
  select a.code, a.type, a.name, a.course_id, a.grp, a.log
  from public.attendance a
  where a.code = upper(trim(p_code)) and a.type = p_type
  limit 1;
$$;
grant execute on function public.check_attendance(text, text) to anon, authenticated;

-- Kunlik statistika (faqat admin uchun)
create or replace function public.stats_daily(p_days int default 30)
returns table (day date, views bigint, visitors bigint, leads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
  with d as (
    select generate_series((now() at time zone 'Asia/Tashkent')::date - (p_days - 1),
                           (now() at time zone 'Asia/Tashkent')::date, interval '1 day')::date as day
  )
  select d.day,
    (select count(*) from public.visits v where (v.created_at at time zone 'Asia/Tashkent')::date = d.day),
    (select count(distinct v.visitor_id) from public.visits v where (v.created_at at time zone 'Asia/Tashkent')::date = d.day),
    (select count(*) from public.leads l where (l.created_at at time zone 'Asia/Tashkent')::date = d.day)
  from d order by d.day;
end $$;
grant execute on function public.stats_daily(int) to authenticated;

-- Manbalar va qurilmalar (faqat admin)
create or replace function public.stats_breakdown(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select jsonb_build_object(
    'devices', (select coalesce(jsonb_object_agg(device, c), '{}') from (
        select coalesce(device,'desktop') device, count(*) c from public.visits
        where created_at > now() - make_interval(days => p_days) group by 1) t),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('source', src, 'count', c) order by c desc), '[]') from (
        select coalesce(nullif(split_part(split_part(referrer, '://', 2), '/', 1), ''), 'To''g''ridan-to''g''ri') src, count(*) c
        from public.visits where created_at > now() - make_interval(days => p_days)
        group by 1 order by 2 desc limit 8) t),
    'total_views', (select count(*) from public.visits),
    'total_visitors', (select count(distinct visitor_id) from public.visits),
    'leads_new', (select count(*) from public.leads where status = 'new')
  ) into res;
  return res;
end $$;
grant execute on function public.stats_breakdown(int) to authenticated;

-- =====================================================================
--  RASMLAR UCHUN STORAGE
-- =====================================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media public read" on storage.objects;
drop policy if exists "media admin insert" on storage.objects;
drop policy if exists "media admin update" on storage.objects;
drop policy if exists "media admin delete" on storage.objects;
create policy "media public read"  on storage.objects for select using (bucket_id = 'media');
create policy "media admin insert" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
create policy "media admin update" on storage.objects for update using (bucket_id = 'media' and public.is_admin());
create policy "media admin delete" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- =====================================================================
--  BOSHLANG'ICH MA'LUMOTLAR (faqat bo'sh bo'lsa qo'shiladi)
-- =====================================================================
insert into public.settings (key, value) values
  ('site', '{"phone":"+998 90 123 45 67","address":"Marg''ilon shahri, Mustaqillik ko''chasi, 24-uy","hours":"Dushanba — Shanba, 09:00 — 19:00","googleForm":"https://forms.google.com/","telegram":"https://t.me/","instagram":"https://instagram.com/"}'),
  ('stats', '[{"value":1200,"suffix":"+","label":"bitiruvchilar"},{"value":25,"suffix":"+","label":"tajribali ustozlar"},{"value":6,"suffix":"","label":"yo''nalishlar"},{"value":94,"suffix":"%","label":"imtihondan o''tish ko''rsatkichi"}]')
on conflict (key) do nothing;

insert into public.courses (id, title, cat, icon, color, soft, level, duration, price, lessons, description, tags, image, sort) values
  ('it','IT & Dasturlash','it','code','#10b981','#e3f7ee','Boshlang''ichdan','8 oy','450 000','Haftada 3 marta · 2 soat','Python, veb-dasturlash (HTML, CSS, JavaScript) va real loyihalar. Portfolio bilan yakunlanadi.','{Python,Frontend,Git,Loyihalar}','images/kurslar/it.jpg',1),
  ('en','Ingliz tili','lang','globe','#3b82f6','#e6f0fe','Beginner — IELTS','6–12 oy','350 000','Haftada 3 marta · 1.5 soat','General English va IELTS tayyorlov. Speaking club va har oylik mock test.','{IELTS,"Speaking club","Mock test"}','images/kurslar/ingliz.jpg',2),
  ('math','Matematika','exam','sigma','#f59e0b','#fff3dc','5–11 sinf, abituriyent','9 oy','300 000','Haftada 3 marta · 2 soat','Maktab dasturi, olimpiada masalalari va DTM testlariga tizimli tayyorgarlik.','{DTM,Olimpiada,Maktab}','images/kurslar/matematika.jpg',3),
  ('ko','Koreys tili','lang','hangul','#ec4899','#fde8f2','TOPIK I — II','8 oy','380 000','Haftada 3 marta · 1.5 soat','Hangul alifbosidan TOPIK imtihonigacha. Koreyaga o''qish va ish uchun tayyorlov.','{TOPIK,Hangul,Grammatika}','images/kurslar/koreys.jpg',4),
  ('de','Nemis tili','lang','chat','#8b5cf6','#efe9fd','A1 — B2','9 oy','380 000','Haftada 3 marta · 1.5 soat','Goethe va telc sertifikatlariga tayyorlov. Ausbildung dasturlari bo''yicha maslahat.','{Goethe,Ausbildung,A1–B2}','images/kurslar/nemis.jpg',5),
  ('cert','Milliy sertifikat','exam','award','#14b8a6','#def6f3','Ona tili, tarix, matematika','4–6 oy','320 000','Haftada 3 marta · 2 soat','Milliy sertifikat imtihonining yangi formatiga moslashtirilgan intensiv kurs.','{"A+ daraja",Intensiv,Test}','images/kurslar/sertifikat.jpg',6)
on conflict (id) do nothing;

insert into public.teachers (name, photo, role, exp, note, course_id, sort)
select * from (values
  ('Azizbek Karimov','images/ustozlar/azizbek.jpg','Python & Backend','6 yil','Ex-EPAM dasturchi','it',1),
  ('Madina Yusupova','images/ustozlar/madina.jpg','Ingliz tili · IELTS','5 yil','IELTS 8.0','en',2),
  ('Jasur Tursunov','images/ustozlar/jasur.jpg','Matematika','9 yil','Olimpiada murabbiyi','math',3),
  ('Ji-woo Park','images/ustozlar/jiwoo.jpg','Koreys tili','4 yil','Ona tili — koreys','ko',4),
  ('Nodira Rahimova','images/ustozlar/nodira.jpg','Nemis tili','7 yil','Goethe C1','de',5),
  ('Sardor Aliyev','images/ustozlar/sardor.jpg','Frontend · JavaScript','4 yil','React mutaxassisi','it',6)
) v(name, photo, role, exp, note, course_id, sort)
where not exists (select 1 from public.teachers);

insert into public.attendance (code, type, name, course_id, grp, log) values
  ('MG-1001','student','Diyora Xasanova','it','IT-24 (ertalab)','{1,1,1,0,1,1,1,1,2,1,1,1,1,0,1,1}'),
  ('MG-1002','student','Bekzod Ergashev','en','EN-B1 (kechki)','{1,1,0,1,1,1,0,1,1,1,1,1}'),
  ('MG-1003','student','Shahzoda Mirzayeva','ko','KO-2 (ertalab)','{1,1,1,1,1,1,1,1,1,1,2,1}'),
  ('MG-1004','student','Ulug''bek Nazarov','math','MATH-11 (tushlik)','{1,0,0,1,1,0,1,1,0,1,1,1,0,1}'),
  ('UST-101','teacher','Azizbek Karimov','it','IT-24, IT-25','{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1}'),
  ('UST-102','teacher','Madina Yusupova','en','EN-B1, EN-IELTS','{1,1,1,1,1,1,1,1,1,1,1,1,1,1}')
on conflict (code) do nothing;

-- =====================================================================
--  ADMIN QO'SHISH — pastdagi email'ni Authentication → Users da yaratgan
--  admin email'ingizga almashtirib, izohni (--) olib tashlab ishga tushiring.
-- =====================================================================
-- insert into public.admins (email) values ('admin@example.com') on conflict do nothing;
