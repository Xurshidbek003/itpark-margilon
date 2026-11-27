-- =====================================================================
--  Sertifikatlar (schema.sql dan keyin ishga tushiriladi; qayta ishga
--  tushirish xavfsiz — mavjud ma'lumotlar o'chirilmaydi)
-- =====================================================================
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  course text not null check (char_length(course) between 1 and 160),
  issued_at date not null default (now() at time zone 'Asia/Tashkent')::date,
  revoked boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists certificates_created_idx on public.certificates (created_at desc);

alter table public.certificates enable row level security;
drop policy if exists "admin all" on public.certificates;
create policy "admin all" on public.certificates for all using (public.is_admin()) with check (public.is_admin());

-- QR orqali tekshirish: faqat bitta raqam bo'yicha natija (ro'yxat ochiq emas)
create or replace function public.get_certificate(p_number text)
returns table (number text, full_name text, course text, issued_at date, revoked boolean)
language sql stable security definer set search_path = public as $$
  select c.number, c.full_name, c.course, c.issued_at, c.revoked
  from public.certificates c
  where c.number = trim(p_number)
  limit 1;
$$;
grant execute on function public.get_certificate(text) to anon, authenticated;

-- Shablon sozlamalari (logotiplar va imzo/muhr rasmlarini admin panelda yuklang)
insert into public.settings (key, value) values ('certificate', '{
  "heading": "CERTIFICATE",
  "done": "kursini muvaffaqiyatli yakunladi",
  "logos": ["", "", ""],
  "signer": {"name": "Abduganiev Sherdil", "title": "Director of \"IT Park Farg''ona\" LLC", "image": ""}
}')
on conflict (key) do nothing;
