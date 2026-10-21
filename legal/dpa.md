# Data Processing Agreement

**Effective date:** [TODO: publish date]

> **Draft — have this reviewed by a qualified lawyer before publishing.** Every `[TODO: …]` must be filled in or removed first.

This Data Processing Agreement ("DPA") forms part of the agreement between EVG (USA) Management Inc., doing business as Mimus.io and AI Teammates ("Mimus", "we", "us"), and the organization that uses Mimus ("Customer", "you"). That agreement is our [Terms of Service](/terms), or a separate signed agreement if there is one. This DPA applies to personal data we process on your behalf when providing Mimus at https://getmimus.io (the "Service").

If this DPA conflicts with the Terms of Service, this DPA prevails for the processing of Customer Personal Data.

## 1. Definitions

- **Customer Personal Data:** personal data in the content your members connect to Mimus (email, calendar, Slack and Calendly data, as listed in the [Privacy Policy](/privacy)) and that we process for you.
- **Data Protection Laws:** all laws that apply to that processing, including, where they apply, the California Consumer Privacy Act as amended by the CPRA ("CCPA"), the EU GDPR and the UK GDPR.
- **Subprocessor:** a third party we engage to process Customer Personal Data.
- "Controller", "processor", "data subject", "personal data breach" and "processing" have the meanings given in the GDPR. "Business", "service provider" and "sell" or "share" have the meanings given in the CCPA.

## 2. Roles

- You are the controller (and, under the CCPA, the business) for Customer Personal Data.
- We are your processor (and, under the CCPA, your service provider).
- For Mimus account, workspace and billing details we are an independent controller, as described in the [Privacy Policy](/privacy). This DPA doesn't cover that data.

## 3. Your instructions

- We process Customer Personal Data only to provide the Service, as configured by you and your members, and on your other documented instructions. Your use of the Service's settings (connecting and disconnecting accounts, visibility, scheduling approval levels, deleting accounts) counts as an instruction.
- We will tell you if we believe an instruction breaks Data Protection Laws.
- **Workspace visibility.** A member's connected account is Private (visible only to that member) until the member, if they are an Owner or Manager, shares it at Team or Company visibility. Once it is shared, your workspace Owners can change its visibility further. Nobody else can widen a Private account. You are responsible for having a lawful basis for any sharing your workspace sets up and for telling the affected members first.
- You are responsible for the lawfulness of the data your members connect, and for any notices to and consents from them and from the people in their data.

## 4. CCPA service provider terms

We will not:

- sell or share Customer Personal Data;
- retain, use or disclose it for any purpose other than providing the Service to you, or outside our direct business relationship with you;
- combine it with personal data we receive from anyone else, except as the CCPA permits.

We will comply with the CCPA's obligations for service providers and tell you if we can no longer meet them.

## 5. Nature and scope of processing

- **Subject matter and purpose:** importing, storing, searching and displaying your connected data, answering your members' questions with AI, and (only where a member turns it on) sending scheduling replies and booking meetings.
- **Data subjects:** your members, and the people who appear in their connected data (senders, recipients, attendees and Slack channel members).
- **Types of data:** names, email addresses, email content and headers, calendar events, Slack channel messages and Calendly bookings, as listed in section 2 of the [Privacy Policy](/privacy). We don't intentionally process special categories of data, but they may appear in the content your members connect.
- **Duration:** for as long as the data stays connected, as described in section 8 below.
- A per-connector schedule, agreed with each Customer, records which services you connect and their settings.

## 6. Confidentiality and staff access

- Everyone we authorize to process Customer Personal Data is bound by confidentiality.
- Our staff have no standing access to production data. Production access is break-glass only: each time it must be approved, it is limited to a set period, and it is logged.
- Development and testing use synthetic data and sandbox accounts, not Customer Personal Data.

## 7. Security

We maintain technical and organizational measures appropriate to the risk, including:

- encryption in transit (TLS) and at rest by our database provider;
- additional AES-256-GCM encryption of the access tokens for connected services;
- access rules enforced by row-level security inside the database, so a member's private data can't be returned to anyone else, including our AI;
- break-glass-only staff access (section 6);
- AI requests sent with provider-side storage turned off, and only the excerpts needed to answer a question.

[TODO: describe the Google-required security assessment (CASA) once completed]

## 8. Deletion

- When a member disconnects a service, we stop the service's change notifications, revoke our access where the service allows it, and immediately delete the data imported from it and the connection record. Microsoft offers no per-app revocation, so the member removes Mimus from their Microsoft account's app permissions; the Mimus Slack app stays installed in a Slack workspace until a Slack admin removes it.
- When an Owner removes a member from your workspace, we disconnect the services that member connected in your workspace and delete their imported data in the same way.
- When a member deletes their account, or your agreement ends and your workspace is deleted, we delete the Customer Personal Data as described in section 9 of the [Privacy Policy](/privacy).
- Deleted data may remain in our database provider's encrypted backups until they expire. [TODO: confirm backup retention period for the production plan]

## 9. Subprocessors

You authorize us to use the subprocessors listed below. Each is bound by written terms that protect Customer Personal Data at least as well as this DPA.

- **Supabase, Inc.**
  - Purpose: database and sign-in, including sending sign-in emails.
  - Data: all Customer Personal Data.
  - Location: United States (US East).
- **Vercel Inc.**
  - Purpose: hosts the web app and runs scheduled jobs.
  - Data: Customer Personal Data in transit, and technical request logs.
  - Location: United States.
- **OpenAI, L.L.C.**
  - Purpose: generates AI answers.
  - Data: a member's question and short excerpts of relevant data (up to 1,500 characters per email, 500 per event description and 1,000 per Slack message), and, when a member asks Mimus to propose meeting times, the free time slots found and the drafted reply. Sent with storage turned off; not used for training.
  - Location: United States. [TODO: confirm whether Zero Data Retention is enabled]
- **Resend, Inc.**
  - Purpose: delivers teammate invitation emails.
  - Data: the recipient's email address and the email contents.
  - Location: United States.
- **Stripe, Inc.**
  - Purpose: subscription billing.
  - Data: your organization's billing contact details. (Billing data is not Customer Personal Data, but we list Stripe for completeness.)
  - Location: United States.

We will tell you at least [TODO: 30] days before adding or replacing a subprocessor, by email or in the app. You may object on reasonable data-protection grounds within that period. If we can't resolve the objection, you may end the affected part of the Service.

The services your members connect (Google, Microsoft, Slack and Calendly) are not our subprocessors. We read data from them on your members' instructions.

## 10. Help with data subject requests and compliance

- The Service lets you and your members disconnect services, make accounts private and delete accounts. Where you can't fulfil a data subject's request yourself, we will help you, taking into account the nature of the processing.
- If a data subject contacts us directly about Customer Personal Data, we will refer them to you unless the law requires otherwise.
- We will give reasonable help with data protection impact assessments and consultations with authorities about the Service.

## 11. Personal data breaches

We will notify you without undue delay, and in any case within [TODO: hours, e.g. 72] hours, after we become aware of a personal data breach affecting Customer Personal Data. We will tell you what we know, take reasonable steps to contain it, and update you as we learn more.

## 12. Audits

On reasonable written request, no more than once a year, we will give you the information you need to show compliance with this DPA. That may include security documentation and summaries of third-party assessments. Where the law requires an inspection, we will allow it on reasonable notice, during business hours, and subject to confidentiality.

## 13. International transfers

We and our subprocessors process Customer Personal Data in the United States. Where the GDPR or UK GDPR applies to a transfer, the parties rely on an adequacy decision (including the EU-U.S. Data Privacy Framework where the recipient is certified) or the European Commission's Standard Contractual Clauses (module two, controller to processor), with the UK Addendum for UK data. Those clauses are incorporated by reference. [TODO: confirm SCC module selections and annex details with counsel]

## 14. Liability, term and law

- Each party's liability under this DPA is subject to the limits in the Terms of Service, except where Data Protection Laws don't allow it.
- This DPA lasts as long as we process Customer Personal Data for you.
- This DPA is governed by the laws of the State of California, USA, except where the Standard Contractual Clauses require otherwise.

## 15. Contact

EVG (USA) Management Inc. (DBA Mimus.io and AI Teammates), [TODO: address], tech@youraiteammates.com.
