import type { AccountType, Provider } from '@/src/server/connectors/types';

// One OAuth grant can produce several connected_accounts rows (Google and
// Microsoft each create an email row and a calendar row), so the UI names
// each row by what it actually reads rather than by provider alone.
const LABELS: Record<Provider, Partial<Record<AccountType, string>>> = {
  google: { email: 'Google Gmail', calendar: 'Google Calendar' },
  microsoft: { email: 'Outlook Mail', calendar: 'Outlook Calendar' },
  slack: { slack: 'Slack' },
  calendly: { scheduling: 'Calendly' },
};

export function connectionLabel(provider: Provider, accountType: AccountType): string {
  return LABELS[provider][accountType] ?? provider;
}

// The line under the label that tells two connections of the same kind
// apart. Calendly's external_account_id is an API URI (the connector needs
// it for API calls) that means nothing to a person, so a Calendly account
// shows its public booking link instead -- or nothing, for a connection
// made before Mimus read that link.
export function connectionIdentifier(account: {
  provider: Provider;
  external_account_id: string | null;
  scheduling_url: string | null;
}): string | null {
  if (account.provider === 'calendly') {
    return account.scheduling_url?.replace(/^https?:\/\//, '') ?? null;
  }
  return account.external_account_id;
}
