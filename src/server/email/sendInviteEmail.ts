import { Resend } from 'resend';

// Resend's own sandbox sender. It works without a verified domain but only
// delivers to the Resend account's own registered address, so it's never a
// valid production sender for teammate invites.
const SANDBOX_FROM = 'Mimus <onboarding@resend.dev>';

export async function sendInviteEmail(params: {
  to: string;
  workspaceName: string;
  inviteUrl: string;
}): Promise<void> {
  // Trimmed so a value pasted with a trailing newline/CR (e.g. from a CRLF
  // .env file) neither counts as "set" nor gets sent to Resend as-is.
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (!apiKey) {
    if (isProduction) {
      throw new Error('Invite email not sent: RESEND_API_KEY is not set in production.');
    }
    // No Resend account configured (local/CI/preview) -- the invite row is
    // already created either way, so log the link instead of hard-failing
    // the whole invite flow over a missing optional provider.
    console.info(`[sendInviteEmail] RESEND_API_KEY not set; invite link: ${params.inviteUrl}`);
    return;
  }

  if (!from && isProduction) {
    throw new Error(
      'Invite email not sent: RESEND_FROM_EMAIL must be a sender on a domain verified in Resend.',
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: from || SANDBOX_FROM,
    to: [params.to],
    subject: `You've been invited to ${params.workspaceName} on Mimus`,
    html: `<p>You've been invited to join <strong>${params.workspaceName}</strong> on Mimus.</p>
<p><a href="${params.inviteUrl}">Accept the invite</a></p>`,
  });

  if (error) {
    // Logged server-side because Next.js masks server action error messages
    // in production builds, so the client only ever sees a generic failure.
    console.error(`[sendInviteEmail] Resend rejected invite to ${params.to}:`, error);
    throw new Error(`Invite email not sent: ${error.message}`);
  }
}
