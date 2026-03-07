create or replace function public.reassign_group_on_meal_update()
returns trigger
language plpgsql
as $function$
declare candidate uuid;
begin
  -- group を手動ロックした行は自動再計算しない
  if coalesce(OLD.group_locked, false) or coalesce(NEW.group_locked, false) then
    return NEW;
  end if;

  -- 同一 UPDATE で intake_group_id を明示変更した場合は尊重
  if NEW.intake_group_id is distinct from OLD.intake_group_id then
    return NEW;
  end if;

  -- 写真なし（manual）は常に新規グループ
  if NEW.is_manual then
    NEW.intake_group_id := gen_random_uuid();
    return NEW;
  end if;

  -- taken_at 未設定なら新規
  if NEW.taken_at is null then
    NEW.intake_group_id := gen_random_uuid();
    return NEW;
  end if;

  -- JSTで同一 minute の同ユーザー・同スロット・非ロック meal を探索（自分自身は除外）
  select m.intake_group_id into candidate
    from public.meals m
   where m.id <> NEW.id
     and m.user_id = NEW.user_id
     and m.meal_slot = NEW.meal_slot
     and m.group_locked = false
     and date_trunc('minute', m.taken_at at time zone 'Asia/Tokyo')
         = date_trunc('minute', NEW.taken_at at time zone 'Asia/Tokyo')
   order by m.id desc
   limit 1;

  if candidate is not null then
    NEW.intake_group_id := candidate;
  else
    NEW.intake_group_id := gen_random_uuid();
  end if;

  return NEW;
end
$function$;

drop trigger if exists trg_reassign_group_on_meals_update on public.meals;

create trigger trg_reassign_group_on_meals_update
before update of meal_slot, taken_at, is_manual on public.meals
for each row
execute function public.reassign_group_on_meal_update();
