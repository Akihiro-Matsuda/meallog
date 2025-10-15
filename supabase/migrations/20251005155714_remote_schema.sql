create extension if not exists "pg_net" with schema "public" version '0.14.0';

create sequence "public"."audit_log_id_seq";

create sequence "public"."device_subscriptions_id_seq";

create sequence "public"."jobs_id_seq";

create sequence "public"."meal_images_id_seq";

create sequence "public"."meals_id_seq";

create sequence "public"."notifications_log_id_seq";

create sequence "public"."surveys_id_seq";

create table "public"."audit_log" (
    "id" bigint not null default nextval('audit_log_id_seq'::regclass),
    "user_id" uuid,
    "action" text not null,
    "detail" jsonb,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."audit_log" enable row level security;

create table "public"."consents" (
    "user_id" uuid not null,
    "version" text not null default 'v1'::text,
    "agreed_at" timestamp with time zone not null default now(),
    "text_hash" text not null
);


alter table "public"."consents" enable row level security;

create table "public"."device_subscriptions" (
    "id" bigint not null default nextval('device_subscriptions_id_seq'::regclass),
    "user_id" uuid,
    "endpoint" text not null,
    "keys" jsonb not null,
    "created_at" timestamp with time zone default now()
);


alter table "public"."device_subscriptions" enable row level security;

create table "public"."jobs" (
    "id" bigint not null default nextval('jobs_id_seq'::regclass),
    "job_type" text,
    "payload" jsonb,
    "status" text default 'queued'::text,
    "run_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
);


create table "public"."meal_analysis" (
    "meal_id" bigint not null,
    "raw_response" json,
    "tags" text[],
    "nutrients" jsonb,
    "quality_flag" text,
    "status" text not null default 'queued'::text,
    "model" text,
    "summary" text,
    "foods" jsonb,
    "reliability" numeric,
    "prompt_version" text,
    "ran_at" timestamp with time zone,
    "error" text
);


alter table "public"."meal_analysis" enable row level security;

create table "public"."meal_image_analysis" (
    "image_id" bigint not null,
    "meal_id" bigint not null,
    "status" text not null default 'done'::text,
    "model" text,
    "raw_response" json not null,
    "prompt_version" text,
    "ran_at" timestamp with time zone not null,
    "error" text
);


alter table "public"."meal_image_analysis" enable row level security;

create table "public"."meal_images" (
    "id" bigint not null default nextval('meal_images_id_seq'::regclass),
    "meal_id" bigint,
    "storage_path" text not null,
    "preview_path" text
);


alter table "public"."meal_images" enable row level security;

create table "public"."meals" (
    "id" bigint not null default nextval('meals_id_seq'::regclass),
    "user_id" uuid,
    "meal_slot" text,
    "taken_at" timestamp with time zone not null,
    "local_time" text,
    "timezone" text,
    "created_at" timestamp with time zone default now(),
    "captured_at_exif" timestamp with time zone,
    "intake_group_id" uuid,
    "group_locked" boolean not null default false,
    "is_manual" boolean not null default false,
    "is_partial" boolean not null default false
);


alter table "public"."meals" enable row level security;

create table "public"."notifications_log" (
    "id" bigint not null default nextval('notifications_log_id_seq'::regclass),
    "user_id" uuid,
    "slot" text,
    "sent_local_date" date not null,
    "sent_at" timestamp with time zone default now()
);


alter table "public"."notifications_log" enable row level security;

create table "public"."profiles" (
    "user_id" uuid not null,
    "role" text default 'participant'::text,
    "timezone" text not null default 'Asia/Tokyo'::text,
    "breakfast_time" time without time zone,
    "lunch_time" time without time zone,
    "dinner_time" time without time zone,
    "created_at" timestamp with time zone default now(),
    "is_admin" boolean not null default false,
    "deleted_at" timestamp with time zone
);


alter table "public"."profiles" enable row level security;

create table "public"."surveys" (
    "id" bigint not null default nextval('surveys_id_seq'::regclass),
    "user_id" uuid,
    "survey_type" text,
    "answered_at" timestamp with time zone not null,
    "payload" jsonb
);


alter table "public"."surveys" enable row level security;

alter sequence "public"."audit_log_id_seq" owned by "public"."audit_log"."id";

alter sequence "public"."device_subscriptions_id_seq" owned by "public"."device_subscriptions"."id";

alter sequence "public"."jobs_id_seq" owned by "public"."jobs"."id";

alter sequence "public"."meal_images_id_seq" owned by "public"."meal_images"."id";

alter sequence "public"."meals_id_seq" owned by "public"."meals"."id";

alter sequence "public"."notifications_log_id_seq" owned by "public"."notifications_log"."id";

alter sequence "public"."surveys_id_seq" owned by "public"."surveys"."id";

CREATE UNIQUE INDEX audit_log_pkey ON public.audit_log USING btree (id);

CREATE UNIQUE INDEX consents_pkey ON public.consents USING btree (user_id);

CREATE UNIQUE INDEX device_subscriptions_pkey ON public.device_subscriptions USING btree (id);

CREATE INDEX idx_meals_user_taken_at ON public.meals USING btree (user_id, taken_at DESC);

CREATE INDEX idx_surveys_user_answered_at ON public.surveys USING btree (user_id, answered_at DESC);

CREATE UNIQUE INDEX jobs_pkey ON public.jobs USING btree (id);

CREATE UNIQUE INDEX jobs_unique_pending_analyze_by_image ON public.jobs USING btree ((((payload ->> 'image_id'::text))::bigint)) WHERE ((job_type = 'analyze_meal'::text) AND (status = ANY (ARRAY['queued'::text, 'processing'::text])));

CREATE UNIQUE INDEX jobs_unique_pending_analyze_by_meal_without_image ON public.jobs USING btree ((((payload ->> 'meal_id'::text))::bigint)) WHERE ((job_type = 'analyze_meal'::text) AND (NOT (payload ? 'image_id'::text)) AND (status = ANY (ARRAY['queued'::text, 'processing'::text])));

CREATE UNIQUE INDEX jobs_unique_pending_analyze_by_path ON public.jobs USING btree (((payload ->> 'storage_path'::text))) WHERE ((job_type = 'analyze_meal'::text) AND (status = ANY (ARRAY['queued'::text, 'processing'::text])));

CREATE UNIQUE INDEX meal_analysis_pkey ON public.meal_analysis USING btree (meal_id);

CREATE INDEX meal_analysis_ran_at_idx ON public.meal_analysis USING btree (ran_at);

CREATE INDEX meal_image_analysis_meal_id_idx ON public.meal_image_analysis USING btree (meal_id);

CREATE UNIQUE INDEX meal_image_analysis_pkey ON public.meal_image_analysis USING btree (image_id);

CREATE UNIQUE INDEX meal_images_pkey ON public.meal_images USING btree (id);

CREATE INDEX meals_group_idx ON public.meals USING btree (intake_group_id);

CREATE UNIQUE INDEX meals_pkey ON public.meals USING btree (id);

CREATE INDEX meals_user_slot_taken_idx ON public.meals USING btree (user_id, meal_slot, taken_at);

CREATE UNIQUE INDEX notifications_log_pkey ON public.notifications_log USING btree (id);

CREATE UNIQUE INDEX notifications_log_user_id_slot_sent_local_date_key ON public.notifications_log USING btree (user_id, slot, sent_local_date);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (user_id);

CREATE UNIQUE INDEX surveys_pkey ON public.surveys USING btree (id);

alter table "public"."audit_log" add constraint "audit_log_pkey" PRIMARY KEY using index "audit_log_pkey";

alter table "public"."consents" add constraint "consents_pkey" PRIMARY KEY using index "consents_pkey";

alter table "public"."device_subscriptions" add constraint "device_subscriptions_pkey" PRIMARY KEY using index "device_subscriptions_pkey";

alter table "public"."jobs" add constraint "jobs_pkey" PRIMARY KEY using index "jobs_pkey";

alter table "public"."meal_analysis" add constraint "meal_analysis_pkey" PRIMARY KEY using index "meal_analysis_pkey";

alter table "public"."meal_image_analysis" add constraint "meal_image_analysis_pkey" PRIMARY KEY using index "meal_image_analysis_pkey";

alter table "public"."meal_images" add constraint "meal_images_pkey" PRIMARY KEY using index "meal_images_pkey";

alter table "public"."meals" add constraint "meals_pkey" PRIMARY KEY using index "meals_pkey";

alter table "public"."notifications_log" add constraint "notifications_log_pkey" PRIMARY KEY using index "notifications_log_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."surveys" add constraint "surveys_pkey" PRIMARY KEY using index "surveys_pkey";

alter table "public"."audit_log" add constraint "audit_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."audit_log" validate constraint "audit_log_user_id_fkey";

alter table "public"."consents" add constraint "consents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."consents" validate constraint "consents_user_id_fkey";

alter table "public"."device_subscriptions" add constraint "device_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."device_subscriptions" validate constraint "device_subscriptions_user_id_fkey";

alter table "public"."meal_analysis" add constraint "meal_analysis_meal_id_fkey" FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE not valid;

alter table "public"."meal_analysis" validate constraint "meal_analysis_meal_id_fkey";

alter table "public"."meal_image_analysis" add constraint "meal_image_analysis_image_id_fkey" FOREIGN KEY (image_id) REFERENCES meal_images(id) ON DELETE CASCADE not valid;

alter table "public"."meal_image_analysis" validate constraint "meal_image_analysis_image_id_fkey";

alter table "public"."meal_image_analysis" add constraint "meal_image_analysis_meal_id_fkey" FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE not valid;

alter table "public"."meal_image_analysis" validate constraint "meal_image_analysis_meal_id_fkey";

alter table "public"."meal_images" add constraint "meal_images_meal_id_fkey" FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE not valid;

alter table "public"."meal_images" validate constraint "meal_images_meal_id_fkey";

alter table "public"."meals" add constraint "meals_meal_slot_check" CHECK ((meal_slot = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'drink'::text, 'other'::text]))) not valid;

alter table "public"."meals" validate constraint "meals_meal_slot_check";

alter table "public"."meals" add constraint "meals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."meals" validate constraint "meals_user_id_fkey";

alter table "public"."notifications_log" add constraint "notifications_log_slot_check" CHECK ((slot = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'wake'::text, 'bed'::text]))) not valid;

alter table "public"."notifications_log" validate constraint "notifications_log_slot_check";

alter table "public"."notifications_log" add constraint "notifications_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notifications_log" validate constraint "notifications_log_user_id_fkey";

alter table "public"."notifications_log" add constraint "notifications_log_user_id_slot_sent_local_date_key" UNIQUE using index "notifications_log_user_id_slot_sent_local_date_key";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['participant'::text, 'admin'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_user_id_fkey";

alter table "public"."surveys" add constraint "surveys_survey_type_check" CHECK ((survey_type = ANY (ARRAY['wake'::text, 'bed'::text]))) not valid;

alter table "public"."surveys" validate constraint "surveys_survey_type_check";

alter table "public"."surveys" add constraint "surveys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."surveys" validate constraint "surveys_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.admin_missing_today(tgt_date date DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Tokyo'::text))
 RETURNS TABLE(user_id uuid, jst_date date, missing_slots integer)
 LANGUAGE sql
AS $function$
select user_id, jst_date, missing_slots
from admin_participant_stats(tgt_date, tgt_date)
where missing_slots > 0
order by user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_participant_stats(start_date date, end_date date)
 RETURNS TABLE(user_id uuid, jst_date date, submitted_slots integer, expected_slots integer, missing_slots integer)
 LANGUAGE sql
AS $function$
with days as (
  select d::date as jst_date
  from generate_series(start_date, end_date, interval '1 day') as g(d)
),
expected as (
  -- そのユーザーが一日に期待されるスロット数（朝/昼/夜に設定がある分だけ）
  select
    p.user_id,
    d.jst_date,
    (case when p.breakfast_time is not null then 1 else 0 end
     + case when p.lunch_time     is not null then 1 else 0 end
     + case when p.dinner_time    is not null then 1 else 0 end) as expected_slots
  from profiles p
  join days d on true
  where p.role = 'participant'
),
submitted as (
  -- 既存の集約ビュー（例: meal_slot_day_rollup）から、その日そのユーザーの提出スロット数
  -- ※列名はあなたのビューに合わせて下さい（user_id / jst_date / meal_slot）
  select
    user_id,
    jst_date,
    count(distinct meal_slot)::int as submitted_slots
  from meal_slot_day_rollup
  where jst_date between start_date and end_date
  group by user_id, jst_date
)
select
  e.user_id,
  e.jst_date,
  coalesce(s.submitted_slots, 0) as submitted_slots,
  e.expected_slots,
  greatest(e.expected_slots - coalesce(s.submitted_slots, 0), 0) as missing_slots
from expected e
left join submitted s
  on s.user_id = e.user_id and s.jst_date = e.jst_date
order by e.user_id, e.jst_date;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_group_on_meal()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare candidate uuid;
begin
  -- 既に明示的に指定 or ロック指示が来た場合は何もしない
  if NEW.intake_group_id is not null or NEW.group_locked then
    return NEW;
  end if;

  -- 写真なし（manual）は常に新規グループ（後からUIでマージ可）
  if NEW.is_manual then
    NEW.intake_group_id := gen_random_uuid();
    return NEW;
  end if;

  -- taken_at 未設定なら新規
  if NEW.taken_at is null then
    NEW.intake_group_id := gen_random_uuid();
    return NEW;
  end if;

  -- JSTで同一 minute の同ユーザー・同スロット・非ロックの meal を探す
  select m.intake_group_id into candidate
    from meals m
   where m.user_id = NEW.user_id
     and m.meal_slot = NEW.meal_slot
     and m.group_locked = false
     and date_trunc('minute', m.taken_at at time zone 'Asia/Tokyo')
         = date_trunc('minute', NEW.taken_at at time zone 'Asia/Tokyo')
   order by m.id desc
   limit 1;

  if candidate is not null then
    NEW.intake_group_id := candidate;  -- ①同時刻→自動で同一グループ
  else
    NEW.intake_group_id := gen_random_uuid();  -- ②時刻が違えば別グループ
  end if;

  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.count_job_status_by_range(p_job_type text, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(status text, count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select status, count(*)::bigint
  from jobs
  where job_type = p_job_type
    and created_at >= p_start
    and created_at <  p_end
  group by status
  order by status;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_analysis_on_image()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if exists (
    select 1 from jobs
    where job_type='analyze_meal'
      and status in ('queued','processing')
      and (
        (payload ? 'image_id' and (payload->>'image_id')::bigint = NEW.id)
        or (payload->>'storage_path' = NEW.storage_path)
        or (not (payload ? 'image_id') and (payload->>'meal_id')::bigint = NEW.meal_id)
      )
  ) then
    return NEW;
  end if;

  insert into jobs (job_type, payload, run_at, status)
  values (
    'analyze_meal',
    jsonb_build_object('image_id', NEW.id, 'meal_id', NEW.meal_id, 'storage_path', NEW.storage_path),
    now(),
    'queued'
  );
  return NEW;
end$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_meal_image_analysis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.jobs (job_type, status, run_at, payload, created_at)
  values (
    'analyze_meal',
    'queued',
    now(),  -- ★ここがポイント：必ず即時に拾える時刻を入れる
    jsonb_build_object(
      'meal_id', NEW.meal_id,
      'image_id', NEW.id,
      'storage_path', NEW.storage_path
    ),
    now()
  );
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$function$
;

create or replace view "public"."intake_group_rollup" as  WITH base AS (
         SELECT m.intake_group_id,
            m.user_id,
            m.meal_slot,
            m.taken_at,
            ((a.raw_response ->> 'carbs_g'::text))::numeric AS carbs_g,
            ((a.raw_response ->> 'fat_g'::text))::numeric AS fat_g,
            ((a.raw_response ->> 'protein_g'::text))::numeric AS protein_g,
            ((a.raw_response ->> 'fiber_g'::text))::numeric AS fiber_g,
            ((a.raw_response ->> 'GI'::text))::integer AS gi,
            ((a.raw_response ->> 'alcohol_ml'::text))::integer AS alcohol_ml,
            ((a.raw_response ->> 'image_blur_flag'::text))::integer AS blur,
            (a.raw_response ->> 'cat1'::text) AS c1,
            (a.raw_response ->> 'cat2'::text) AS c2,
            (a.raw_response ->> 'cat3'::text) AS c3,
            (a.raw_response ->> 'cat4'::text) AS c4,
            (a.raw_response ->> 'cat5'::text) AS c5
           FROM (meal_image_analysis a
             JOIN meals m ON ((m.id = a.meal_id)))
          WHERE (a.status = 'done'::text)
        ), cats AS (
         SELECT b_1.intake_group_id,
            b_1.user_id,
            b_1.meal_slot,
            unnest(array_remove(ARRAY[b_1.c1, b_1.c2, b_1.c3, b_1.c4, b_1.c5], ''::text)) AS cat
           FROM base b_1
        ), cats_counts AS (
         SELECT cats.intake_group_id,
            cats.user_id,
            cats.meal_slot,
            cats.cat,
            count(*) AS cnt
           FROM cats
          GROUP BY cats.intake_group_id, cats.user_id, cats.meal_slot, cats.cat
        ), cats_ranked AS (
         SELECT cats_counts.intake_group_id,
            cats_counts.user_id,
            cats_counts.meal_slot,
            cats_counts.cat,
            cats_counts.cnt,
            row_number() OVER (PARTITION BY cats_counts.intake_group_id, cats_counts.user_id, cats_counts.meal_slot ORDER BY cats_counts.cnt DESC, cats_counts.cat) AS rn
           FROM cats_counts
        ), cats_top AS (
         SELECT cats_ranked.intake_group_id,
            cats_ranked.user_id,
            cats_ranked.meal_slot,
            string_agg(cats_ranked.cat, ','::text ORDER BY cats_ranked.rn) AS cats_union_csv
           FROM cats_ranked
          WHERE (cats_ranked.rn <= 5)
          GROUP BY cats_ranked.intake_group_id, cats_ranked.user_id, cats_ranked.meal_slot
        )
 SELECT b.intake_group_id,
    b.user_id,
    b.meal_slot,
    min(b.taken_at) AS group_start,
    max(b.taken_at) AS group_end,
    sum(COALESCE(b.carbs_g, (0)::numeric)) AS carbs_g,
    sum(COALESCE(b.fat_g, (0)::numeric)) AS fat_g,
    sum(COALESCE(b.protein_g, (0)::numeric)) AS protein_g,
    sum(COALESCE(b.fiber_g, (0)::numeric)) AS fiber_g,
    max(b.gi) AS gi,
    sum(COALESCE(b.alcohol_ml, 0)) AS alcohol_ml,
    max(b.blur) AS image_blur_flag,
    t.cats_union_csv
   FROM (base b
     LEFT JOIN cats_top t ON (((t.intake_group_id = b.intake_group_id) AND (t.user_id = b.user_id) AND (t.meal_slot = b.meal_slot))))
  GROUP BY b.intake_group_id, b.user_id, b.meal_slot, t.cats_union_csv;


CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.profiles p
    where p.user_id = uid and p.role = 'admin'
  );
$function$
;

create or replace view "public"."meal_analysis_csv" as  SELECT meal_id,
    (raw_response ->> 'start_time'::text) AS start_time,
    ((raw_response ->> 'carbs_g'::text))::numeric AS carbs_g,
    ((raw_response ->> 'fat_g'::text))::numeric AS fat_g,
    ((raw_response ->> 'protein_g'::text))::numeric AS protein_g,
    ((raw_response ->> 'fiber_g'::text))::numeric AS fiber_g,
    ((raw_response ->> 'GI'::text))::integer AS "GI",
    ((raw_response ->> 'alcohol_ml'::text))::integer AS alcohol_ml,
    ((raw_response ->> 'image_blur_flag'::text))::integer AS image_blur_flag,
    ((raw_response ->> 'category_count'::text))::integer AS category_count,
    ((raw_response ->> 'category_overflow_flag'::text))::integer AS category_overflow_flag,
    (raw_response ->> 'cat1'::text) AS cat1,
    (raw_response ->> 'cat2'::text) AS cat2,
    (raw_response ->> 'cat3'::text) AS cat3,
    (raw_response ->> 'cat4'::text) AS cat4,
    (raw_response ->> 'cat5'::text) AS cat5
   FROM meal_analysis
  WHERE (status = 'done'::text);


create or replace view "public"."meal_image_analysis_csv" as  SELECT image_id,
    meal_id,
    (raw_response ->> 'meal_id'::text) AS meal_id_str,
    (raw_response ->> 'start_time'::text) AS start_time,
    ((raw_response ->> 'carbs_g'::text))::numeric AS carbs_g,
    ((raw_response ->> 'fat_g'::text))::numeric AS fat_g,
    ((raw_response ->> 'protein_g'::text))::numeric AS protein_g,
    ((raw_response ->> 'fiber_g'::text))::numeric AS fiber_g,
    ((raw_response ->> 'GI'::text))::integer AS "GI",
    ((raw_response ->> 'alcohol_ml'::text))::integer AS alcohol_ml,
    ((raw_response ->> 'image_blur_flag'::text))::integer AS image_blur_flag,
    ((raw_response ->> 'category_count'::text))::integer AS category_count,
    ((raw_response ->> 'category_overflow_flag'::text))::integer AS category_overflow_flag,
    (raw_response ->> 'cat1'::text) AS cat1,
    (raw_response ->> 'cat2'::text) AS cat2,
    (raw_response ->> 'cat3'::text) AS cat3,
    (raw_response ->> 'cat4'::text) AS cat4,
    (raw_response ->> 'cat5'::text) AS cat5
   FROM meal_image_analysis
  WHERE (status = 'done'::text);


create or replace view "public"."meal_slot_day_rollup" as  WITH base AS (
         SELECT m.user_id,
            m.meal_slot,
            ((m.taken_at AT TIME ZONE 'Asia/Tokyo'::text))::date AS jst_date,
            m.taken_at,
            ((a.raw_response ->> 'carbs_g'::text))::numeric AS carbs_g,
            ((a.raw_response ->> 'fat_g'::text))::numeric AS fat_g,
            ((a.raw_response ->> 'protein_g'::text))::numeric AS protein_g,
            ((a.raw_response ->> 'fiber_g'::text))::numeric AS fiber_g,
            ((a.raw_response ->> 'GI'::text))::integer AS gi,
            ((a.raw_response ->> 'alcohol_ml'::text))::integer AS alcohol_ml,
            ((a.raw_response ->> 'image_blur_flag'::text))::integer AS blur,
            (a.raw_response ->> 'cat1'::text) AS c1,
            (a.raw_response ->> 'cat2'::text) AS c2,
            (a.raw_response ->> 'cat3'::text) AS c3,
            (a.raw_response ->> 'cat4'::text) AS c4,
            (a.raw_response ->> 'cat5'::text) AS c5
           FROM (meal_image_analysis a
             JOIN meals m ON ((m.id = a.meal_id)))
          WHERE (a.status = 'done'::text)
        ), cats AS (
         SELECT b_1.user_id,
            b_1.meal_slot,
            b_1.jst_date,
            unnest(array_remove(ARRAY[b_1.c1, b_1.c2, b_1.c3, b_1.c4, b_1.c5], ''::text)) AS cat
           FROM base b_1
        ), cats_counts AS (
         SELECT cats.user_id,
            cats.meal_slot,
            cats.jst_date,
            cats.cat,
            count(*) AS cnt
           FROM cats
          GROUP BY cats.user_id, cats.meal_slot, cats.jst_date, cats.cat
        ), cats_ranked AS (
         SELECT cats_counts.user_id,
            cats_counts.meal_slot,
            cats_counts.jst_date,
            cats_counts.cat,
            cats_counts.cnt,
            row_number() OVER (PARTITION BY cats_counts.user_id, cats_counts.meal_slot, cats_counts.jst_date ORDER BY cats_counts.cnt DESC, cats_counts.cat) AS rn
           FROM cats_counts
        ), cats_top AS (
         SELECT cats_ranked.user_id,
            cats_ranked.meal_slot,
            cats_ranked.jst_date,
            string_agg(cats_ranked.cat, ','::text ORDER BY cats_ranked.rn) AS cats_union_csv
           FROM cats_ranked
          WHERE (cats_ranked.rn <= 5)
          GROUP BY cats_ranked.user_id, cats_ranked.meal_slot, cats_ranked.jst_date
        )
 SELECT b.user_id,
    b.meal_slot,
    b.jst_date,
    min(b.taken_at) AS slot_anchor,
    sum(COALESCE(b.carbs_g, (0)::numeric)) AS carbs_g,
    sum(COALESCE(b.fat_g, (0)::numeric)) AS fat_g,
    sum(COALESCE(b.protein_g, (0)::numeric)) AS protein_g,
    sum(COALESCE(b.fiber_g, (0)::numeric)) AS fiber_g,
    max(b.gi) AS gi,
    sum(COALESCE(b.alcohol_ml, 0)) AS alcohol_ml,
    max(b.blur) AS image_blur_flag,
    t.cats_union_csv
   FROM (base b
     LEFT JOIN cats_top t ON (((t.user_id = b.user_id) AND (t.meal_slot = b.meal_slot) AND (t.jst_date = b.jst_date))))
  GROUP BY b.user_id, b.meal_slot, b.jst_date, t.cats_union_csv;


create policy "audit_log.block"
on "public"."audit_log"
as permissive
for all
to public
using (false);


create policy "consents.select.own"
on "public"."consents"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "consents.update.own"
on "public"."consents"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "consents.upsert.own"
on "public"."consents"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "subs_all_self"
on "public"."device_subscriptions"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "subs_select_admin"
on "public"."device_subscriptions"
as permissive
for select
to public
using (is_admin(auth.uid()));


create policy "meal_analysis_admin_read"
on "public"."meal_analysis"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND p.is_admin))));


create policy "meal_analysis_select_admin"
on "public"."meal_analysis"
as permissive
for select
to public
using (is_admin(auth.uid()));


create policy "meal_analysis_select_owner"
on "public"."meal_analysis"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM meals m
  WHERE ((m.id = meal_analysis.meal_id) AND (m.user_id = auth.uid())))));


create policy "meal_image_analysis_admin_read"
on "public"."meal_image_analysis"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.is_admin = true)))));


create policy "meal_images_owner_via_meal"
on "public"."meal_images"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM meals m
  WHERE ((m.id = meal_images.meal_id) AND (m.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM meals m
  WHERE ((m.id = meal_images.meal_id) AND (m.user_id = auth.uid())))));


create policy "meal_images_select_admin"
on "public"."meal_images"
as permissive
for select
to public
using (is_admin(auth.uid()));


create policy "meals_all_self"
on "public"."meals"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "meals_select_admin"
on "public"."meals"
as permissive
for select
to public
using (is_admin(auth.uid()));


create policy "notifications_select_admin"
on "public"."notifications_log"
as permissive
for select
to public
using (is_admin(auth.uid()));


create policy "notifications_select_self"
on "public"."notifications_log"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "profiles_insert_self"
on "public"."profiles"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "profiles_select_admin"
on "public"."profiles"
as permissive
for select
to public
using (is_admin(auth.uid()));


create policy "profiles_select_self"
on "public"."profiles"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "profiles_update_self"
on "public"."profiles"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "surveys_all_self"
on "public"."surveys"
as permissive
for all
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "surveys_select_admin"
on "public"."surveys"
as permissive
for select
to public
using (is_admin(auth.uid()));


CREATE TRIGGER trg_enqueue_analysis AFTER INSERT ON public.meal_images FOR EACH ROW EXECUTE FUNCTION enqueue_meal_image_analysis();

CREATE TRIGGER trg_assign_group_on_meals BEFORE INSERT ON public.meals FOR EACH ROW EXECUTE FUNCTION assign_group_on_meal();


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


  create policy "meal_images_delete_owner"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'meal-images'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));



  create policy "meal_images_insert_own_path"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'meal-images'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));



  create policy "meal_images_select_admin"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'meal-images'::text) AND is_admin(auth.uid())));



  create policy "meal_images_select_owner"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'meal-images'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));



  create policy "meal_images_update_owner"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'meal-images'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)))
with check (((bucket_id = 'meal-images'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));



