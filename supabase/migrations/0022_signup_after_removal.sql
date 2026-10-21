-- A member removed from their only workspace kept a `removed` membership
-- row, which this function took as "already has a workspace". They could
-- sign in but reach nothing -- not even Settings -> Account to delete
-- their own account, as the Privacy Policy promises. Only an *active*
-- membership now counts, so they get a fresh workspace of their own.

create or replace function create_default_workspace_for_user(p_user_id uuid, p_email text)
returns uuid
security definer
set search_path = public
language plpgsql
as $$
declare
  v_workspace_id uuid;
  v_company_id uuid;
begin
  select workspace_id into v_workspace_id
  from workspace_members
  where user_id = p_user_id and status = 'active'
  limit 1;

  if v_workspace_id is not null then
    return v_workspace_id;
  end if;

  insert into profiles (id, email)
  values (p_user_id, p_email)
  on conflict (id) do nothing;

  insert into companies (name) values (p_email || '''s company')
  returning id into v_company_id;

  insert into workspaces (company_id, name) values (v_company_id, 'My workspace')
  returning id into v_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner');

  return v_workspace_id;
end;
$$;
