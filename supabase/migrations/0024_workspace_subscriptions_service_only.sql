-- Billing state is Stripe's to set: only the Stripe webhook, running as the
-- service role, writes workspace_subscriptions. 0007's manage policy let a
-- workspace Owner write the row directly, for example setting a past-due
-- workspace back to 'active' without paying. Members and Owners keep read
-- access (select_workspace_subscriptions).

drop policy manage_workspace_subscriptions on public.workspace_subscriptions;
