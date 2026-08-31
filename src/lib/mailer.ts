import * as postmark from "postmark";

const MAIL_DOMAIN = process.env.MAIL_DOMAIN ?? "mydomain.com";

let client: postmark.ServerClient | null = null;
function getClient() {
  if (!client) {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) {
      throw new Error("POSTMARK_SERVER_TOKEN is not set");
    }
    client = new postmark.ServerClient(token);
  }
  return client;
}

export function isInternalAddress(address: string) {
  return address.toLowerCase().endsWith(`@${MAIL_DOMAIN.toLowerCase()}`);
}

export function usernameFromAddress(address: string) {
  return address.split("@")[0].toLowerCase();
}

interface OutboundMail {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachments?: { filename: string; contentBase64: string; mimeType: string }[];
  inReplyToExternalId?: string;
}

// Sends mail to addresses outside our own domain via Postmark. Addresses on
// our own domain never touch this — they're written straight into the
// recipient's mailbox by the API route, since no internet hop is needed.
export async function sendExternalMail(mail: OutboundMail) {
  const externalTo = mail.to.filter((a) => !isInternalAddress(a));
  const externalCc = (mail.cc ?? []).filter((a) => !isInternalAddress(a));
  const externalBcc = (mail.bcc ?? []).filter((a) => !isInternalAddress(a));

  if (externalTo.length + externalCc.length + externalBcc.length === 0) {
    return null; // everyone was internal, nothing to send over the wire
  }

  const result = await getClient().sendEmail({
    From: mail.fromName ? `${mail.fromName} <${mail.from}>` : mail.from,
    To: externalTo.join(", "),
    Cc: externalCc.length ? externalCc.join(", ") : undefined,
    Bcc: externalBcc.length ? externalBcc.join(", ") : undefined,
    Subject: mail.subject,
    TextBody: mail.bodyText,
    HtmlBody: mail.bodyHtml,
    MessageStream: "outbound",
    Headers: mail.inReplyToExternalId
      ? [{ Name: "In-Reply-To", Value: mail.inReplyToExternalId }]
      : undefined,
    Attachments: mail.attachments?.map((a) => ({
      Name: a.filename,
      Content: a.contentBase64,
      ContentType: a.mimeType,
      ContentID: "",
    })),
  });

  return result;
}

// Very small heuristic spam filter for v1. This is intentionally simple —
// swap in a real provider (Postmark's built-in filtering, rspamd, SpamAssassin,
// or a managed API) before relying on this in production.
const SPAM_KEYWORDS = [
  "viagra",
  "lottery winner",
  "wire transfer",
  "click here now",
  "act now",
  "free money",
  "you have won",
  "crypto giveaway",
];

export function scoreSpam(input: { subject: string; bodyText: string; fromAddress: string }) {
  let score = 0;
  const reasons: string[] = [];
  const haystack = `${input.subject}\n${input.bodyText}`.toLowerCase();

  for (const kw of SPAM_KEYWORDS) {
    if (haystack.includes(kw)) {
      score += 25;
      reasons.push(`Contains phrase "${kw}"`);
    }
  }

  const exclamations = (input.subject.match(/!/g) ?? []).length;
  if (exclamations >= 3) {
    score += 15;
    reasons.push("Excessive punctuation in subject");
  }

  if (input.subject === input.subject.toUpperCase() && input.subject.length > 6) {
    score += 10;
    reasons.push("Subject is all caps");
  }

  const linkCount = (input.bodyText.match(/https?:\/\//g) ?? []).length;
  if (linkCount >= 5) {
    score += 20;
    reasons.push("Unusually many links");
  }

  return { score: Math.min(score, 100), reasons };
}

export const SPAM_THRESHOLD = 40;
export { MAIL_DOMAIN };
