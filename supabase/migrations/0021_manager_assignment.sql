-- Manager assignment (who a member reports to) drives Team visibility, so
-- only a workspace Owner may change it. update_workspace_members_managed
-- (0011) lets a Manager update Member rows to change their role, and its
-- WITH CHECK can't compare old and new values, so without this trigger a
-- Manager could pull any Member under themselves and gain Team visibility
-- of that Member's connected accounts.
--
-- Only applies to signed-in sessions: the service role and migrations have
-- no auth.uid() and are unaffected. The same-workspace rule stays with
-- 0004's trigger.

create function enforce_manager_assignment()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.manager_id is not distinct from old.manager_id then
    return new;
  end if;

  if auth.uid() is not null
     and get_workspace_role(new.workspace_id, auth.uid()) is distinct from 'owner' then
    raise exception 'only workspace Owners can assign managers';
  end if;

  if new.manager_id is not null and not exists (
    select 1 from workspace_members
    where id = new.manager_id
      and status = 'active'
      and role in ('owner', 'manager')
  ) then
    raise exception 'manager_id must reference an active Owner or Manager';
  end if;

  return new;
end;
$$;

revoke all on function enforce_manager_assignment() from public;

create trigger workspace_members_manager_assignment
  before update of manager_id on public.workspace_members
  for each row
  execute function enforce_manager_assignment();
