import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Resend is a paid external API, so it's mocked at the SDK boundary only.
const send = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send } };
  }),
}));

const { Resend } = await import('resend');
const { sendInviteEmail } = await import('@/src/server/email/sendInviteEmail');

const params = {
  to: 'teammate@example.com',
  workspaceName: 'Acme',
  inviteUrl: 'https://app.example.com/invite/abc',
};

describe('sendInviteEmail', () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ data: { id: 'email_1' }, error: null });
    vi.mocked(Resend).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('logs the link instead of sending when no key is set outside production', async () => {
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('RESEND_API_KEY', '');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    await sendInviteEmail(params);

    expect(send).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining(params.inviteUrl));
    info.mockRestore();
  });

  it('fails loudly in production when the key is missing or only whitespace', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '\r');
    vi.stubEnv('RESEND_FROM_EMAIL', 'Mimus <invites@example.com>');

    await expect(sendInviteEmail(params)).rejects.toThrow(/RESEND_API_KEY/);
    expect(send).not.toHaveBeenCalled();
  });

  it('fails loudly in production when no verified sender is configured', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('RESEND_FROM_EMAIL', '');

    await expect(sendInviteEmail(params)).rejects.toThrow(/RESEND_FROM_EMAIL/);
    expect(send).not.toHaveBeenCalled();
  });

  it('trims stray whitespace (e.g. CRLF from a pasted .env) off the key and sender', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', ' re_test\r');
    vi.stubEnv('RESEND_FROM_EMAIL', 'Mimus <invites@example.com>\r');

    await sendInviteEmail(params);

    expect(Resend).toHaveBeenCalledWith('re_test');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Mimus <invites@example.com>', to: [params.to] }),
    );
  });

  it("surfaces Resend's rejection reason instead of an opaque error object", async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('RESEND_FROM_EMAIL', 'Mimus <invites@example.com>');
    send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'The example.com domain is not verified.' },
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendInviteEmail(params)).rejects.toThrow(/domain is not verified/);
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
