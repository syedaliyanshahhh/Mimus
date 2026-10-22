# Privacy Policy

**Effective date:** October 22, 2026

This Privacy Policy explains what personal information Mimus collects, why, who it goes to, how long we keep it, and the choices you have. It covers the Mimus web app at https://getmimus.io ("Mimus", "the Service").

## 1. Who we are

Mimus is provided by EVG (USA) Management Inc., doing business as Mimus.io and AI Teammates, a company based in the United States ("we", "us").

- Privacy contact: tech@youraiteammates.com

### Our role

Mimus is a business tool that a company ("your organization") sets up for its team.

- **Account and billing information.** For your Mimus account, workspace and billing details, we are the data controller.
- **Workspace content.** For the email, calendar, Slack and Calendly data that members connect, we process it on behalf of your organization, which acts as the controller. We do so under our agreement with them, including our [Data Processing Agreement](/dpa). If you're a member of an organization's workspace, contact your organization about its handling of that data. You can also contact us directly and we will help.

## 2. Information we collect

### Information you give us

- **Account details:** your email address (you sign in with a one-time email link, not a password) and, optionally, your full name.
- **Organization details:** your company name and workspace name, your role in the workspace (Owner, Manager or Member), and who your manager is (set by a workspace Owner on the Members page).
- **Invitations:** when you invite a teammate, we store their email address, the role you chose and an invitation link token, and we email them the invitation.
- **Terms acceptance:** when you accept the Terms of Service and this Privacy Policy, we record which version you accepted, when, and that you confirmed you're 18 or older.
- **Questions you ask Mimus:** the questions you type into the Ask bar. These are processed to produce an answer but are **not** saved after the answer is returned (see section 4).

### Information from services you connect

Mimus only reads data from services you explicitly connect. Connecting is optional, and you can disconnect at any time. Connecting gives Mimus read-only access. It can send email or create calendar events only if you separately turn that on (see "Scheduling" below). Section 3 covers Google in detail. For every connected service:

- **Email (Gmail or Microsoft Outlook):**
  - What we store: subject line, sender, recipients (To, Cc and Bcc), date, preview snippet, the full message body (plain text and HTML), conversation (thread) ID, whether it was sent or received, and a copy of the message record as returned by the provider's API, including its headers.
  - When you first connect, we import the last 90 days, then keep up with new mail. For Gmail, we skip spam, trash, and the Promotions and Social categories, both in the first import and for mail that arrives later.
  - For Outlook, when a message in your Inbox is deleted or moved out of it, we delete our copy too.
- **Calendar (Google Calendar or Microsoft Outlook calendar):**
  - What we store: event title, description, location, start and end time, status, organizer, attendees and their responses, and a copy of the event record as returned by the provider's API.
  - When you first connect, we import events from the last 90 days onward, including upcoming events (for Microsoft calendars, up to two years ahead). Events deleted in Outlook are deleted from Mimus too.
- **Slack:**
  - What we store: messages from public and private channels **you are a member of**, from the last 90 days onward.
  - We never request access to direct messages or group DMs, and we filter them out again if one ever arrives.
- **Calendly:** your scheduled events and their invitees, from 90 days ago to one year ahead, and the link to your public Calendly booking page (so a scheduling reply can offer it). We never create, change or cancel bookings.
- **People in your data:** to show who a message or meeting involves, we store the names and email addresses of senders, recipients and attendees found in your connected data. These may be people who don't use Mimus.
- **Access tokens:** the tokens each service issues so Mimus can read your data (and, if you allow it, send scheduling replies and book meetings). We encrypt them with AES-256-GCM before storing them, and they are never shown to anyone in the app.

### Scheduling (optional)

If you use Mimus to reply to people who want to meet you, we also store:

- **Your scheduling settings:** your time zone, working days and hours, preferred meeting length, buffer, minimum notice, how many times to offer, which calendar to book into, whether to add a video link, whether to offer your Calendly link, and your **approval level** (see below).
- **Scheduling proposals:** for each reply Mimus drafts, the email it answers, the other person's email address, the subject, the times offered or the Calendly link, the reply text, its status (for example waiting, sent, booked or dismissed), the time you chose and the ID of the resulting calendar event.

Sending and booking are **off until you turn them on** for a specific email account, with "Allow sending and booking" on the Connections page. That asks the provider for these extra permissions:

- **Google:** send email on your behalf (`https://www.googleapis.com/auth/gmail.send`) and view and edit events on your calendars (`https://www.googleapis.com/auth/calendar.events`).
- **Microsoft:** send mail as you (`Mail.Send`) and read and write your calendars (`Calendars.ReadWrite`).

Your **approval level** decides what Mimus may do without asking you each time:

1. **Draft only:** Mimus writes the reply; you copy it and send it yourself. Nothing is sent or booked.
2. **Approve every send and booking** (the default): each reply and booking waits until you approve it.
3. **Offers go out automatically:** a reply that only offers times or your Calendly link is sent straight away; booking a meeting still waits for you.
4. **Fully automatic:** Mimus sends the reply and books the earliest free time without asking.

Scheduling replies are written from a fixed template, not composed freely by AI. They go only to the person who wrote to you, from the account their email arrived in.

### Information collected automatically

- **Cookies and browser storage:**
  - sign-in session cookies, which keep you signed in;
  - short-lived cookies that protect the connect-a-service flow against forgery;
  - `mimus-post-auth-redirect`, a 10-minute cookie that remembers which page to open after you sign in;
  - `mimus-theme`, stored in your browser's local storage, which remembers whether you chose the light or dark theme.

  We use no advertising or analytics cookies.

- **AI usage log:** each time you ask Mimus a question, we record:
  - who asked, in which workspace, and when
  - the kind of request and its priority
  - which AI model answered
  - how many tokens it used and what it cost
  - which items were cited as sources
  - whether it succeeded

  It does **not** contain your question or the answer. Workspace Owners can see this log on the AI usage log page.

- **Service logs:** our hosting provider (Vercel) and database provider (Supabase) keep standard technical logs (such as IP address, request time and error details) for security and troubleshooting. Error details can include identifiers such as a connected account's ID or an email address. We don't log the content of your messages or the questions you ask. These logs are kept for a limited period under each provider's retention settings and then deleted.

### Information we do not collect

We do not collect your location, device identifiers, advertising identifiers, phone contacts, photos, camera or microphone input, or payment card numbers. Card payments are entered directly on Stripe's checkout page and never reach our servers.

## 3. Google user data

This section describes exactly what Mimus does with data it receives from Google APIs when you click **Connect Google** on the Connections page.

### What we request

When you connect a Google account, Mimus requests two **read-only** permissions:

- **Read your Gmail messages and settings** (`https://www.googleapis.com/auth/gmail.readonly`)
- **View your Google Calendar events** (`https://www.googleapis.com/auth/calendar.readonly`)

Only if you click **Allow sending and booking** for that account does Mimus request two more:

- **Send email on your behalf** (`https://www.googleapis.com/auth/gmail.send`)
- **View and edit events on all your calendars** (`https://www.googleapis.com/auth/calendar.events`)

Mimus never requests permission to delete or change your existing email. Signing in to Mimus itself does not use your Google account.

### How we use it

- **Gmail:**
  - We read your Gmail address to identify which account you connected.
  - We import your messages as described in section 2 so that you can search them, and so that Mimus's AI can find relevant messages, summarize them and answer questions you ask.
  - When the AI drafts an email for you, it can use a message you choose to reply to. These general drafts are shown to you only and are never sent.
  - **Sending (only if you allowed it):** Mimus uses `gmail.send` for one thing only: sending a scheduling reply, in the same conversation, to the person who asked to meet. It sends only when you approve it or when your approval level allows it (section 2, "Scheduling"). It never sends any other email.
- **Google Calendar:**
  - We import your events so you can see your schedule in Mimus, and so the AI can answer questions about your meetings.
  - We check when you're busy, across your connected calendars, to suggest times when you're free.
  - **Booking (only if you allowed it):** Mimus uses `calendar.events` for one thing only: creating a meeting you approved, or one your approval level allows, on your calendar with the other person invited. Google then emails them the invitation. Mimus does not change or delete your existing events.

We use Google user data only to provide and improve these user-facing features. "Improve" here means fixing problems you or Mimus run into. It does not mean training AI models.

### How we share it

- **With people in your organization's workspace, based on its visibility setting.** Each connected account is **Private** by default: only you can see its data. Not even the workspace's Owners can see a Private account, and nobody but you can change it. It can be changed on the Connections page to:
  - **Team:** your manager, teammates who report to the same manager, and the workspace's Owners can also see it. Who reports to whom is set by a workspace Owner on the Members page.
  - **Company:** the workspace's Owners can also see it, plus specific people on that account's sharing list. Mimus doesn't yet have a screen for managing sharing lists, so today Company means you and the workspace's Owners.

  Who can make this change:
  - You can always set your own account back to Private, even while your workspace's subscription is past due or canceled.
  - Only the Owner and Manager roles can widen their own accounts to Team or Company. A Member's accounts stay Private.
  - A workspace Owner can change the visibility of an account they can already see (one set to Team or Company), including widening it from Team to Company or setting it back to Private. They don't need your approval to do so.

  Your organization decides whether to widen visibility, and it is responsible for telling its employees before it does. If you're unsure who in your organization can see your connected data, ask your workspace Owner, or check the visibility shown for each account on the Connections page.

- **With the person you're scheduling with.** A scheduling reply and a meeting invitation go from your own account to the person who asked to meet. They see what any email or invitation from you would show: your name and address, the offered times or your Calendly link, and the meeting details.
- **With our AI provider, to answer your question.** When you ask Mimus a question, short excerpts of relevant data go to OpenAI to generate the answer: up to 1,500 characters of each email, 500 characters of each event description and 1,000 characters of each Slack message. When you ask Mimus to propose meeting times, OpenAI also receives the free time slots it found and the drafted reply. See section 5.
- **With our infrastructure providers,** who store and process data on our behalf under contract (section 5).

We do not share Google user data with anyone else, except where required by law (section 5).

### Our commitments

- We **do not sell** Google user data.
- We **do not use** Google user data for advertising, including personalized, retargeted or interest-based ads.
- We **do not use** Google user data to train, develop or improve generalized or non-personalized AI or machine-learning models, and we do not allow our AI provider to do so.
- We **do not allow humans to read** Google user data, except:
  - with your explicit permission for specific messages, such as when you ask us for support;
  - when needed for security purposes, such as investigating abuse;
  - to comply with applicable law;
  - in aggregated, anonymized form for internal operations.

Access to the production database is limited to a small number of authorized staff, who use it only for the purposes listed above. Our development and test environments use synthetic data and sandbox accounts, not your data.

### Limited Use

Mimus's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

### Storage, retention and removal

- **Storage:** Google data is stored in our database (section 7). Access tokens are encrypted with AES-256-GCM.
- **Retention:** we keep imported data while your Google account stays connected.
- **When you click Disconnect:**
  - We stop Gmail's change notifications for that account and revoke Mimus's access with Google.
  - We immediately delete the imported messages, events, contacts and stored tokens for that account, and the connection record itself, including the account's email address.
- **Revoking from Google:** you can also revoke access at any time from your [Google Account permissions page](https://myaccount.google.com/permissions). Mimus will no longer be able to read new data. To remove the data already imported, click Disconnect in Mimus or delete your account.

## 4. How and why we use information

We use your information only for the purposes below. The legal basis applies where laws like the GDPR or UK GDPR require one.

- **To provide the Service.** This covers creating your account, running your workspace, importing connected data, search, AI answers and invitations. Legal basis: performance of our contract with you or your organization.
- **To schedule meetings for you,** if you turn it on: finding free time, drafting replies, and sending and booking according to your approval level. Legal basis: performance of contract.
- **To answer your questions with AI.** Legal basis: performance of contract.
  1. Your question goes to OpenAI.
  2. OpenAI may ask Mimus to search your data.
  3. Mimus runs that search using **your own permissions**, so the AI can only see data you can see.
  4. Mimus sends OpenAI the matching excerpts.
  5. OpenAI writes the answer and Mimus shows it to you with links to its sources.
- **To keep the Service secure and working.** This covers preventing abuse, investigating problems, enforcing AI spending limits and recording the AI usage log. Legal basis: our legitimate interest in running a secure service.
- **To bill your organization.** Legal basis: performance of contract and our legal obligations.
- **To send service emails,** such as sign-in links and invitations. Legal basis: performance of contract. We do not send marketing email.

We do not use your information for advertising and we do not sell it.

## 5. Who we share information with

We use these service providers ("processors"). Each receives only what it needs to provide its service to us, under contract:

- **Supabase** stores our database and runs sign-in, including sending the one-time sign-in emails. It holds all the information described in this policy. Data is stored in the United States (US East).
- **OpenAI** generates AI answers. It receives your question and the excerpts described in section 3.
  - We send requests with storage turned off (`store: false`), and OpenAI does not use API data to train its models.
  - OpenAI may retain API inputs and outputs for up to 30 days to monitor for abuse, then deletes them.
- **Resend** delivers invitation emails. It receives the recipient's email address and the email contents.
- **Stripe** processes subscription payments. It receives your organization's billing details. Card details go directly to Stripe.
- **Vercel** hosts the web app. It processes requests and technical logs in the United States.

The current list of these providers, with what each receives and where, is in the subprocessor list of our [Data Processing Agreement](/dpa).

**Services you connect** (Google, Microsoft, Slack and Calendly) are not our processors. We only read data from them with your permission. If you allow sending and booking, we also use your Google or Microsoft account to send the scheduling replies and create the meetings described in section 2. We never send a service your data from other services, except that a scheduling reply can include your Calendly link.

**Other disclosures:**

- **Legal requirements:** we may disclose information if required by law, or to protect the rights, safety or security of our users or others. Where the law allows, we will tell you first.
- **Business transfer:** if Mimus is acquired or merged, information may transfer to the new owner under the same commitments in this policy. This includes the Google user data commitments in section 3. We will notify you before that happens.

## 6. How long we keep information

- **Connected-service data** (messages, events, contacts, tokens, and the connection record with the account's email address and permissions): kept while the service stays connected. Deleted immediately when you disconnect it or delete your account.
- **Scheduling proposals:** kept while the email they answer is stored. Deleted with it when you disconnect that account, and when you delete your account.
- **Scheduling settings and approval level:** kept until you delete your account.
- **Emails and invitations Mimus sent for you:** these live in your own email and calendar account, and in the other person's, like any email you send. Deleting them there is up to you; Mimus doesn't delete them.
- **Account, profile and workspace data:** kept until you delete your account (section 9). If you're the only member of a workspace, deleting your account also deletes that workspace and everything in it.
- **AI usage log:** kept for your workspace's records while the workspace exists. When you delete your account, your entries are kept but are no longer linked to you.
- **Invitations:** kept while the workspace exists, so its Owners can see who was invited and when.
- **Terms acceptance records:** kept until you delete your account.
- **Billing records:** kept as long as tax and accounting law requires, generally up to seven years. This includes the customer record Stripe keeps for your organization (its name and billing details), which stays at Stripe after the workspace is deleted.
- **Backups:** deleted data may remain in our database provider's encrypted backups until they expire. Backups are taken daily and kept for up to 7 days.

If a workspace Owner removes you from a workspace, the services you connected in that workspace are disconnected and their imported data deleted, as if you had clicked Disconnect. You keep your Mimus account: the next time you sign in you get a workspace of your own, and you can delete your account from Settings → Account.

## 7. Security

- Data is encrypted in transit (TLS) and at rest by our database provider.
- Access tokens for connected services are additionally encrypted by Mimus with AES-256-GCM before storage.
- Who can see what is enforced by row-level security rules inside the database itself, not only by app code. A workspace member's private data can't be returned to anyone else, even by our AI.
- Access to the production database is limited to a small number of authorized staff, who use it only for the purposes listed in section 3. Development and testing use synthetic data and sandbox accounts.

No system is perfectly secure. If we learn of a breach affecting your information, we will notify you and the relevant authorities as the law requires.

## 8. Your rights and choices

Depending on where you live, you have rights over your personal information:

- access and receive a copy of it
- correct it
- delete it
- restrict or object to how we use it
- data portability
- withdraw consent at any time
- complain to a data protection authority

**Choices available in the app now:**

- **Disconnect** any connected service on the Connections page. This removes its imported data immediately, and works even while your workspace's subscription is past due or canceled.
- **Make a connected account Private** at any time on the Connections page. The visibility rules are in section 3.
- **Revoke Google access** at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- **Revoke Microsoft access:** Microsoft doesn't let an app revoke only its own access, so Disconnect deletes everything on our side but can't withdraw the permission you granted. To withdraw it, remove Mimus from your Microsoft account's app permissions: [account.live.com/consent/Manage](https://account.live.com/consent/Manage) for a personal account, or [myapplications.microsoft.com](https://myapplications.microsoft.com) for a work or school account.
- **Delete your account** (section 9).

**To make any other request,** email tech@youraiteammates.com. We will respond within 30 days (one month under the GDPR). We may need to verify your identity first.

If you're in the EU or UK, you can complain to your local data protection authority.

### California residents (CCPA/CPRA)

- In the last 12 months we have collected these categories of personal information for the purposes in section 4:
  - identifiers (name, email)
  - the contents of email and messages you connect
  - commercial information (subscription)
  - internet activity (service logs)
- **We do not sell or share personal information** for cross-context behavioral advertising.
- We do not use sensitive personal information to infer characteristics about you.
- You have the right to know, delete and correct your information, and to not be discriminated against for exercising these rights.

## 9. Deleting your account

**In the app:** go to **Settings → Account** and choose **Delete account**. When you confirm:

1. Every service you connected is disconnected, and Mimus's access to it is revoked where the service allows it. For Microsoft, which doesn't, remove Mimus from your Microsoft account's app permissions (section 8). For Slack, your own access is revoked; the Mimus app itself stays installed in your Slack workspace until a Slack admin removes it.
2. All data imported from those services is deleted: messages, events, contacts and tokens.
3. Your profile and workspace memberships are deleted.
4. Any workspace where you're the only member is deleted with all its content.
5. Your sign-in account is deleted.

**Some things block deletion until you sort them out:**

- If you're the only Owner of a workspace that has other members, remove them first, or contact us to transfer ownership. This keeps the team from being left without an Owner.
- If a workspace you'd delete has an active paid subscription, cancel it first with **Manage or cancel subscription** on the Billing page.

**Without signing in:** see [Deleting your Mimus account](/account-deletion), or email tech@youraiteammates.com from your account's email address and we will delete it within 30 days.

## 10. International transfers

We are based in the United States, and we and our service providers store and process data in the United States, so your information may be processed outside your country. Where the GDPR or UK GDPR applies, we rely on adequacy decisions (including the EU-U.S. Data Privacy Framework where a provider is certified) or the European Commission's Standard Contractual Clauses (and the UK Addendum) with our providers.

## 11. Children

Mimus is a business tool for people aged 18 and over. When you first sign in, you confirm that you're 18 or older. It is not directed at children, and we do not knowingly collect personal information from children under 13 (or under 16 in the EU/UK). If you believe a child has given us personal information, contact tech@youraiteammates.com and we will delete it.

## 12. Changes to this policy

If we make material changes, we will update the effective date above and notify account holders by email or in the app before the changes take effect. In the app, you'll be asked to review and accept the updated version the next time you use Mimus. If we ever want to use Google user data in a new way, we will update this policy and ask for your consent first.

## 13. Contact

Questions or requests about this policy: tech@youraiteammates.com, EVG (USA) Management Inc. (DBA Mimus.io and AI Teammates).
