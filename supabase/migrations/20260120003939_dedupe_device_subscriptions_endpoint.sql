with ranked as (
  select
    id,
    row_number() over (partition by endpoint order by created_at desc, id desc) as rn
  from public.device_subscriptions
)
delete from public.device_subscriptions
where id in (select id from ranked where rn > 1);

create unique index if not exists device_subscriptions_endpoint_key
  on public.device_subscriptions (endpoint);
