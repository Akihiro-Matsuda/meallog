alter table public.profiles
  add column if not exists wakeup_time time,
  add column if not exists bed_time time;
