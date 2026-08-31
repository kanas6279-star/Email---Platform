# Postbox — v1 email platform

A self-hosted email platform (Gmail/Outlook-style) built with Next.js (App
Router), Postgres/Prisma, and Postmark for actual internet mail delivery.

## What's included in v1

- Sign up / log in (hashed passwords, session cookies, rate-limited)
- A real address on your domain (`username@yourdomain.com`)
- Inbox, Sent, Drafts, Trash, Spam, Archive, Starred
- Compose with To/Cc/Bcc, autosaving drafts, file attachments
- Send to other platform users (delivered directly) and to external
  providers — Gmail, Outlook, Yahoo, etc. — via Postmark
- Receiving mail from the outside world via an inbound webhook
- Reply, reply-all, forward, archive, delete (soft → Trash → permanent),
  star, mark read/unread, mark as spam / not spam
- Search across sender, recipient, subject, body, and date
- Basic heuristic spam scoring
- Responsive layout (desktop, tablet, phone)

## Not in v1 yet (see "Roadmap" below)

- Email verification and password reset flows (stubbed — accounts are
  auto-verified on signup right now)
- Two-factor authentication (schema has room for it; no UI/flow yet)
- S3/object storage for attachments (currently local disk — fine for dev,
  not for a multi-server production deployment)
- Labels (only folders for now)
- Real-time push notifications for new mail (current UI polls on
  navigation/refresh; add WebSockets/SSE for live push)

---

## 1. Prerequisites

- Node.js 20+
- A Postgres database (local via Docker, or a hosted one — Neon, Supabase,
  RDS, Railway, etc. all work)
- A domain name you control (for real email addresses and DNS records)
- A Postmark account (or swap in SES/Mailgun — see "Swapping mail providers"
  below) for actual internet delivery

## 2. Local setup

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL, JWT_SECRET, MAIL_DOMAIN, POSTMARK_SERVER_TOKEN, etc.

npx prisma db push   # creates tables from prisma/schema.prisma
npm run dev           # http://localhost:3000
```

Generate a strong `JWT_SECRET` with:

```bash
openssl rand -base64 48
```

## 3. Postmark setup (outbound + inbound)

1. Create a Postmark server, grab its **Server API Token** → `POSTMARK_SERVER_TOKEN`.
2. Under **Sender Signatures / Domains**, add your domain and follow
   Postmark's instructions to verify it (this generates the DKIM record
   for you — see DNS section below).
3. Under the server's **Settings → Inbound**, set the **Inbound Webhook URL**
   to:
   `https://yourapp.com/api/webhooks/inbound?secret=YOUR_POSTMARK_INBOUND_WEBHOOK_SECRET`
   (use the same value you put in `POSTMARK_INBOUND_WEBHOOK_SECRET`).
4. Postmark gives you an inbound MX target (something like
   `inbound.postmarkapp.com`) — that's what your domain's MX record should
   point to (see below).

## 4. DNS records (on your domain)

These make mail addressed to `@yourdomain.com` actually reach this app, and
make mail you send actually land in inboxes instead of spam folders.

| Record | Purpose | Example |
|---|---|---|
| **MX** | Routes incoming mail for your domain to Postmark's inbound servers | `yourdomain.com. MX 10 inbound.postmarkapp.com.` |
| **SPF (TXT)** | Declares which servers are allowed to send mail as your domain | `yourdomain.com. TXT "v=spf1 include:spf.mtasv.net ~all"` |
| **DKIM (TXT)** | Cryptographically signs outgoing mail; Postmark generates the exact record when you verify your domain | `pm._domainkey.yourdomain.com. TXT "k=rsa; p=..."` |
| **DMARC (TXT)** | Tells receiving servers what to do with mail that fails SPF/DKIM, and where to send reports | `_dmarc.yourdomain.com. TXT "v=DMARC1; p=quarantine; rua=mailto:you@yourdomain.com"` |

Exact values depend on your provider — always copy them from your Postmark
(or SES/Mailgun) dashboard rather than the examples above. Deliverability
takes time to build even with correct DNS: start with `p=none` on DMARC to
monitor, then move to `quarantine`/`reject` once you're confident.

## 5. Attachment storage

Local disk (`ATTACHMENT_STORAGE=local`) is fine for development but doesn't
work across multiple server instances and isn't durable. For production,
set `ATTACHMENT_STORAGE=s3` and implement the two functions in
`src/lib/storage.ts` with an S3 client, e.g.:

```ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({ region: process.env.S3_REGION });

export async function saveAttachment(buffer: Buffer, originalFilename: string) {
  const storageKey = `${randomUUID()}-${originalFilename}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET, Key: storageKey, Body: buffer,
  }));
  return storageKey;
}
```

Also plug in a real antivirus scan (e.g. ClamAV via a Lambda/sidecar) in the
upload route before persisting — the current code only blocks a fixed list
of dangerous file extensions, which is a floor, not a full defense.

## 6. Swapping mail providers

All outbound/inbound logic lives in two files:
`src/lib/mailer.ts` (sending) and `src/app/api/webhooks/inbound/route.ts`
(receiving). To use SES or Mailgun instead of Postmark, replace the
`sendExternalMail` implementation and adjust the inbound route to match
that provider's webhook payload shape.

## 7. Running your own SMTP/IMAP server instead of a managed provider

This is a legitimate path if you want full control, but it's a much bigger
lift: you'd run Postfix (SMTP) and Dovecot (IMAP) yourself, manage TLS
certs, warm up a dedicated IP's sending reputation over weeks, and handle
abuse/spam mitigation yourself. Most teams start with a managed provider
(as this scaffold does) and only migrate to self-hosted MTA once volume and
control requirements justify the operational cost.

## 8. Project structure

```
prisma/schema.prisma        Database schema
src/lib/                    auth, db client, mailer, storage, rate limiting
src/app/api/                REST API: auth, messages, attachments, webhooks
src/app/(auth)/             login, signup pages
src/app/(mail)/             inbox/sent/drafts/... pages, message detail
src/components/             Sidebar, TopBar, ComposeModal, MessageList
src/context/MailContext.tsx Shared compose-modal + refresh state
src/middleware.ts           Route protection
```

## Roadmap (beyond v1)

1. Email verification + password reset (send via the same mailer)
2. TOTP-based 2FA (schema already has `twoFactorSecret`/`twoFactorOn`)
3. Labels (many-to-many) alongside folders
4. S3 attachment storage + antivirus scanning in the upload path
5. WebSocket/SSE push for "new mail" notifications instead of polling
6. Move from in-memory rate limiting to Redis for multi-instance deployments
7. IMAP/SMTP access to this platform's mailboxes if you want people to use
   third-party mail clients (Thunderbird, Apple Mail) against it, not just
   this web UI
