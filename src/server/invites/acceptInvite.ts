import { createServiceClient } from '@/src/db/service';

// `email` is the signed-in user's own address from their verified session.
// An invite link only works for the address it was sent to, so a forwarded
// or leaked link can't add someone else to the workspace.
export async function acceptInvite(params: {
  token: string;
  userId: string;
  email: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const { data: invite, error } = await supabase
    .from('invites')
    .select('id, workspace_id, email, role, status, expires_at')
    .eq('token', params.token)
    .single();

  if (error || !invite) {
    throw new Error('Invite not found');
  }
  if (invite.status !== 'pending') {
    throw new Error('Invite is no longer pending');
  }
  if (new Date(invite.expires_at) <= new Date()) {
    throw new Error('Invite has expired');
  }
  if (invite.email.trim().toLowerCase() !== params.email.trim().toLowerCase()) {
    throw new Error(
      'This invite was sent to a different email address. Sign in with that address to accept it.',
    );
  }

  // Already a member (e.g. invited twice): keep their current role --
  // changing it is an owner action, not something an invite link does. A
  // removed member being invited back rejoins with the invited role.
  const { data: existing, error: existingError } = await supabase
    .from('workspace_members')
    .select('id, status')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', params.userId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.status === 'removed') {
    const { error: rejoinError } = await supabase
      .from('workspace_members')
      .update({ status: 'active', role: invite.role, manager_id: null })
      .eq('id', existing.id);
    if (rejoinError) throw rejoinError;
  } else if (!existing) {
    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: invite.workspace_id,
      user_id: params.userId,
      role: invite.role,
    });
    if (memberError) throw memberError;
  }

  const { error: updateError } = await supabase
    .from('invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id);
  if (updateError) throw updateError;
}
