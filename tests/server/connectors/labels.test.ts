import { connectionIdentifier, connectionLabel } from '@/src/server/connectors/labels';
import { describe, expect, it } from 'vitest';

describe('connectionLabel', () => {
  it.each([
    ['google', 'email', 'Google Gmail'],
    ['google', 'calendar', 'Google Calendar'],
    ['microsoft', 'email', 'Outlook Mail'],
    ['microsoft', 'calendar', 'Outlook Calendar'],
    ['slack', 'slack', 'Slack'],
    ['calendly', 'scheduling', 'Calendly'],
  ] as const)('labels %s/%s as %s', (provider, accountType, label) => {
    expect(connectionLabel(provider, accountType)).toBe(label);
  });
});

describe('connectionIdentifier', () => {
  it('shows the address for an email or calendar account', () => {
    expect(
      connectionIdentifier({
        provider: 'microsoft',
        external_account_id: 'sam@example.com',
        scheduling_url: null,
      }),
    ).toBe('sam@example.com');
  });

  it('shows a Calendly account’s booking link, not its API user URI', () => {
    expect(
      connectionIdentifier({
        provider: 'calendly',
        external_account_id: 'https://api.calendly.com/users/af17cec9',
        scheduling_url: 'https://calendly.com/tech-team',
      }),
    ).toBe('calendly.com/tech-team');
  });

  it('shows nothing for a Calendly account whose booking link was never read', () => {
    expect(
      connectionIdentifier({
        provider: 'calendly',
        external_account_id: 'https://api.calendly.com/users/af17cec9',
        scheduling_url: null,
      }),
    ).toBeNull();
  });
});
