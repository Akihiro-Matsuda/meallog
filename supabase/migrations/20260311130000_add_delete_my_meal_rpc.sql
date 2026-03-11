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

  delete from public.meals
   where id = p_meal_id
     and user_id = v_uid;

  return found;
end
$function$;

grant execute on function public.delete_my_meal(bigint) to authenticated;
