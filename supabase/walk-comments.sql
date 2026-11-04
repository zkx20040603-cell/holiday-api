-- 新建独立地点评论表，不修改原 guestbook。
begin;
create table public.walk_comments (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 place_id text not null check (place_id ~ '^((node|way|relation)/[1-9][0-9]{0,14}|park/[a-f0-9]{24})$'),
 name text not null check (char_length(name) between 1 and 20),
 message text not null check (char_length(message) between 1 and 200)
);
create index walk_comments_place_time on public.walk_comments(place_id, created_at desc);
alter table public.walk_comments enable row level security;
revoke all on public.walk_comments from anon, authenticated;
grant select on public.walk_comments to anon, authenticated;
grant select, insert on public.walk_comments to service_role;
create policy "public_read_walk_comments" on public.walk_comments for select to anon, authenticated using (true);
commit;
