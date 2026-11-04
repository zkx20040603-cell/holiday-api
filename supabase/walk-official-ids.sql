begin;
alter table public.walk_comments drop constraint walk_comments_place_id_check;
alter table public.walk_comments add constraint walk_comments_place_id_check check (place_id ~ '^((node|way|relation)/[1-9][0-9]{0,14}|park/[a-f0-9]{24})$');
commit;
