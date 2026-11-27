-- =====================================================================
--  CRM: o'quvchilar, guruhlar, davomat va avtomatik sertifikatlar
--  schema.sql va sertifikat.sql dan KEYIN ishga tushiriladi.
--  Qayta ishga tushirish xavfsiz — mavjud ma'lumotlar o'chirilmaydi.
-- =====================================================================

-- ---------- O'QUVCHILAR ----------
create sequence if not exists public.student_code_seq start 2001;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('MG-' || nextval('public.student_code_seq')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text check (char_length(coalesce(phone, '')) <= 30),
  parent_phone text check (char_length(coalesce(parent_phone, '')) <= 30),
  birth_date date,
  note text check (char_length(coalesce(note, '')) <= 1000),
  lead_id bigint references public.leads(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists students_created_idx on public.students (created_at desc);

-- ---------- GURUHLAR ----------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  course_id text references public.courses(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  start_date date not null,
  end_date date not null,
  days smallint[] not null default '{1,3,5}',   -- 1 = dushanba ... 7 = yakshanba
  time text,                                    -- masalan: 14:00 — 16:00
  room text,
  status text not null default 'active' check (status in ('active', 'finished')),
  finished_at timestamptz,
  created_at timestamptz default now(),
  constraint groups_dates_chk check (end_date >= start_date)
);
create index if not exists groups_status_idx on public.groups (status, end_date);

-- ---------- GURUH A'ZOLARI ----------
create table if not exists public.group_students (
  group_id uuid not null references public.groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  joined_at date not null default (now() at time zone 'Asia/Tashkent')::date,
  primary key (group_id, student_id)
);
create index if not exists group_students_student_idx on public.group_students (student_id);

-- ---------- DAVOMAT BELGILARI ----------
-- status: 1 keldi, 0 kelmadi, 2 sababli
create table if not exists public.marks (
  group_id uuid not null,
  student_id uuid not null,
  day date not null,
  status smallint not null check (status in (0, 1, 2)),
  updated_at timestamptz default now(),
  primary key (group_id, student_id, day),
  foreign key (group_id, student_id) references public.group_students (group_id, student_id) on delete cascade
);

-- ---------- SERTIFIKATLARGA YANGI USTUNLAR ----------
-- status: pending — tasdiqlash kutilmoqda (QR orqali tekshirib bo'lmaydi), active — amalda
alter table public.certificates add column if not exists status text not null default 'active';
alter table public.certificates add column if not exists student_id uuid references public.students(id) on delete set null;
alter table public.certificates add column if not exists group_id uuid references public.groups(id) on delete set null;
alter table public.certificates add column if not exists attendance_pct smallint;
alter table public.certificates add column if not exists approved_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'certificates_status_chk') then
    alter table public.certificates add constraint certificates_status_chk check (status in ('pending', 'active'));
  end if;
end $$;
create unique index if not exists certificates_group_student_uq on public.certificates (group_id, student_id);

-- =====================================================================
--  XAVFSIZLIK — yangi jadvallarni faqat admin ko'radi va o'zgartiradi
-- =====================================================================
alter table public.students       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_students enable row level security;
alter table public.marks          enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('students', 'groups', 'group_students', 'marks')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy "admin all" on public.students       for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.groups         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.group_students for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.marks          for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
--  SERTIFIKATLARNI AVTOMATIK YARATISH
-- =====================================================================
-- Guruhdagi har bir o'quvchiga "tasdiqlash kutilmoqda" holatida sertifikat yaratadi
-- (bor bo'lsa — qayta yaratmaydi). Nechta yaratilganini qaytaradi.
create or replace function public._issue_group_certificates(p_group uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.certificates (full_name, course, issued_at, status, student_id, group_id, attendance_pct)
  select s.full_name, coalesce(c.title, g.name), g.end_date, 'pending', s.id, g.id,
    (select case when count(*) = 0 then null
            else round(100.0 * count(*) filter (where m.status <> 0) / count(*)) end
       from public.marks m where m.group_id = g.id and m.student_id = s.id)
  from public.groups g
  join public.group_students gs on gs.group_id = g.id
  join public.students s on s.id = gs.student_id
  left join public.courses c on c.id = g.course_id
  where g.id = p_group
  on conflict (group_id, student_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Muddati tugagan barcha faol guruhlarni yakunlaydi va sertifikat yaratadi
create or replace function public._finish_due_groups()
returns int language plpgsql security definer set search_path = public as $$
declare g record; total int := 0;
begin
  for g in select id from public.groups
           where status = 'active' and end_date < (now() at time zone 'Asia/Tashkent')::date
           for update
  loop
    update public.groups set status = 'finished', finished_at = now() where id = g.id;
    total := total + public._issue_group_certificates(g.id);
  end loop;
  return total;
end $$;

-- Ichki funksiyalarni tashqaridan chaqirib bo'lmasin
revoke execute on function public._issue_group_certificates(uuid) from public, anon, authenticated;
revoke execute on function public._finish_due_groups() from public, anon, authenticated;

-- Admin panel uchun (har kirishda chaqiriladi)
create or replace function public.finish_due_groups()
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return public._finish_due_groups();
end $$;
grant execute on function public.finish_due_groups() to authenticated;

-- Guruhni muddatidan oldin qo'lda yakunlash
create or replace function public.finish_group(p_group uuid)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.groups set status = 'finished', finished_at = coalesce(finished_at, now()) where id = p_group;
  return public._issue_group_certificates(p_group);
end $$;
grant execute on function public.finish_group(uuid) to authenticated;

-- Yakunlangan guruhga keyin qo'shilgan o'quvchilar uchun yetishmayotgan sertifikatlarni yaratish
create or replace function public.issue_group_certificates(p_group uuid)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return public._issue_group_certificates(p_group);
end $$;
grant execute on function public.issue_group_certificates(uuid) to authenticated;

-- =====================================================================
--  SAYTDAGI TEKSHIRUVLAR
-- =====================================================================
-- Davomat: avval CRM o'quvchilaridan (oxirgi/faol guruhi bo'yicha), topilmasa eski jadvaldan
create or replace function public.check_attendance(p_code text, p_type text)
returns table (code text, type text, name text, course_id text, grp text, log smallint[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_type = 'student' then
    return query
      select s.code, 'student'::text, s.full_name, g.course_id, g.name,
        coalesce((select array_agg(m.status order by m.day) from public.marks m
                  where m.group_id = g.id and m.student_id = s.id), '{}'::smallint[])
      from public.students s
      join public.group_students gs on gs.student_id = s.id
      join public.groups g on g.id = gs.group_id
      where s.code = upper(trim(p_code))
      order by (g.status = 'active') desc, g.start_date desc
      limit 1;
    if found then return; end if;
  end if;
  return query
    select a.code, a.type, a.name, a.course_id, a.grp, a.log
    from public.attendance a
    where a.code = upper(trim(p_code)) and a.type = p_type
    limit 1;
end $$;
grant execute on function public.check_attendance(text, text) to anon, authenticated;

-- Sertifikat: tasdiqlanmagan (pending) sertifikatlar QR orqali ko'rinmaydi
create or replace function public.get_certificate(p_number text)
returns table (number text, full_name text, course text, issued_at date, revoked boolean)
language sql stable security definer set search_path = public as $$
  select c.number, c.full_name, c.course, c.issued_at, c.revoked
  from public.certificates c
  where c.number = trim(p_number) and c.status = 'active'
  limit 1;
$$;
grant execute on function public.get_certificate(text) to anon, authenticated;

-- =====================================================================
--  (Ixtiyoriy) Har kecha avtomatik tekshirish — admin panelga hech kim
--  kirmasa ham sertifikatlar o'z vaqtida yaratiladi.
--  Supabase → Database → Extensions → "pg_cron" ni yoqing, so'ng izohni
--  (--) olib tashlab ishga tushiring:
-- =====================================================================
-- select cron.schedule('itpark-finish-groups', '5 19 * * *', 'select public._finish_due_groups()');
-- (19:05 UTC = Toshkent vaqti bilan 00:05)
