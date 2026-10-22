# Connector Schedule — [Client name]

> **Internal template, not a public page.** Fill in one copy per client and attach it to that client's agreement and [Data Processing Agreement](/dpa). Delete the blocks for connectors the client doesn't use. The scopes and storage below describe the Service as built; update this template whenever a connector changes (see `legal/pending-design-changes.md`).

- **Client:** [legal name]
- **Client ID:** [unique client ID]
- **Workspace(s):** [workspace name(s)]
- **Schedule date:** [date]
- **Approved for the client by:** [name, title, email]
- **Workspace Owners (can change the visibility of accounts members have shared):** [names]
- **Client confirms it has told its members** who can see shared (Team or Company) accounts: [yes / no, date]

## Gmail (Google)

- **Read scopes:** `https://www.googleapis.com/auth/gmail.readonly`
- **Write scopes (only if "Allow sending and booking" is on):** `https://www.googleapis.com/auth/gmail.send`, used only to send approved scheduling replies.
- **Stored:** subject, sender, recipients (To, Cc, Bcc), date, preview snippet, full body (plain text and HTML), thread ID, direction, and the provider's message record including headers.
- **First import:** last 90 days, skipping spam, trash, Promotions and Social.
- **Kept until:** the account is disconnected or the member deletes their Mimus account.
- **Default visibility:** Private.
- **Accounts in scope:** [member — mailbox — visibility — sending on/off]

## Google Calendar

- **Read scopes:** `https://www.googleapis.com/auth/calendar.readonly`
- **Write scopes (only if "Allow sending and booking" is on):** `https://www.googleapis.com/auth/calendar.events`, used only to create approved meetings.
- **Stored:** title, description, location, start and end, status, organizer, attendees and responses, and the provider's event record.
- **First import:** events from 90 days ago onward, including upcoming events.
- **Kept until:** the account is disconnected or the member deletes their Mimus account.
- **Default visibility:** Private.
- **Accounts in scope:** [member — calendar — visibility — booking on/off]

## Microsoft Outlook mail and calendar

- **Read scopes:** `Mail.Read`, `Calendars.Read`, `offline_access`
- **Write scopes (only if "Allow sending and booking" is on):** `Mail.Send`, `Calendars.ReadWrite`, used only for approved scheduling replies and meetings.
- **Stored:** same fields as Gmail and Google Calendar above.
- **First import:** last 90 days of mail; calendar events from 90 days ago onward.
- **Kept until:** the account is disconnected or the member deletes their Mimus account.
- **Default visibility:** Private.
- **Accounts in scope:** [member — mailbox — visibility — sending on/off]

## Slack

- **User scopes:** `channels:history`, `channels:read`, `groups:history`, `groups:read`
- **Bot scopes:** `channels:read`, `groups:read`
- **Never requested:** direct messages and group DMs (filtered out if one arrives). Mimus never posts.
- **Stored:** messages from public and private channels the connecting member belongs to.
- **First import:** last 90 days onward.
- **Kept until:** the account is disconnected or the member deletes their Mimus account.
- **Default visibility:** Private.
- **Slack workspace(s) in scope:** [Slack workspace — member — visibility]

## Calendly

- **Scopes:** `scheduled_events:read`, `users:read`, `webhooks:write` (the last only to receive booking notifications).
- **Never:** creates, changes or cancels bookings.
- **Stored:** scheduled events and invitees, and the member's public booking-page link.
- **First import:** 90 days ago to one year ahead.
- **Kept until:** the account is disconnected or the member deletes their Mimus account.
- **Default visibility:** Private.
- **Accounts in scope:** [member — Calendly user — visibility]

## Other client-provided systems

Not yet supported. Any additional connector (for example QuickBooks or Google Drive) needs its own block here, an update to the Privacy Policy and DPA, and the client's written approval before it is turned on.

## AI processing

- **Provider:** OpenAI (the only provider in the Service today).
- **Sent per question:** the question and short excerpts (up to 1,500 characters per email, 500 per event description and 1,000 per Slack message; plus free time slots and the drafted reply when proposing meeting times), with storage turned off.
