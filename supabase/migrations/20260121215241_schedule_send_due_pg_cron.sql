create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  jid int;
begin
  select jobid into jid from cron.job where jobname = 'send-due-every-5-min';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

select cron.schedule(
  'send-due-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://meallog-blond.vercel.app/api/push/send-due',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);
