-- 개발용 프로젝트에서 한 번 실행. 기존 테이블은 변경하거나 삭제하지 않음.
begin;
create table public.guestbook (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 20),
  message text not null check (char_length(message) between 1 and 200)
);
create index guestbook_created_at_idx on public.guestbook (created_at desc);
alter table public.guestbook enable row level security;
revoke all on public.guestbook from anon, authenticated;
grant select on public.guestbook to anon, authenticated;
grant select, insert on public.guestbook to service_role;
create policy "누구나 읽기" on public.guestbook
  for select to anon, authenticated using (true);
commit;
-- 공개 역할에는 INSERT 정책이나 쓰기 권한을 주지 않음.
