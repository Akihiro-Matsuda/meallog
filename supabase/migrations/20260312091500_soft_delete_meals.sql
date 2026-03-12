alter table public.meals
  add column if not exists deleted_at timestamptz;

create index if not exists idx_meals_user_deleted_taken_at
  on public.meals (user_id, deleted_at, taken_at desc);

create or replace function public.delete_my_meal(p_meal_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  update public.meals
     set deleted_at = now()
   where id = p_meal_id
     and user_id = v_uid
     and deleted_at is null;

  if not found then
    return false;
  end if;

  -- 既に投入済みの解析ジョブはキャンセル扱いにする
  update public.jobs
     set status = 'canceled',
         payload = coalesce(payload, '{}'::jsonb)
           || jsonb_build_object('canceled_reason', 'meal_deleted', 'canceled_at', now()::text)
   where job_type = 'analyze_meal'
     and status in ('queued', 'processing')
     and (
       (
         payload ? 'meal_id'
         and (payload->>'meal_id') ~ '^[0-9]+$'
         and (payload->>'meal_id')::bigint = p_meal_id
       )
       or
       (
         payload ? 'image_id'
         and (payload->>'image_id') ~ '^[0-9]+$'
         and (payload->>'image_id')::bigint in (
           select id from public.meal_images where meal_id = p_meal_id
         )
       )
     );

  return true;
end
$function$;

grant execute on function public.delete_my_meal(bigint) to authenticated;
