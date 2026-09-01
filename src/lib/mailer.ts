import sgMail from "@sendgrid/mail";

const MAIL_DOMAIN = process.env.MAIL_DOMAIN ?? "mydomain.com";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
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

// Sends mail to addresses outside our own domain via SendGrid. Addresses on
// our own domain never touch this — they're written straight into the
// recipient's mailbox by the API route, since no internet hop is needed.
export async function sendExternalMail(mail: OutboundMail) {
  if (!SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY not set - email not sent to external providers");
    return null;
  }

  const externalTo = mail.to.filter((a) => !isInternalAddress(a));
  const externalCc = (mail.cc ?? []).filter((a) => !isInternalAddress(a));
  const externalBcc = (mail.bcc ?? []).filter((a) => !isInternalAddress(a));

  if (externalTo.length + externalCc.length + externalBcc.length === 0) {
    return null; // everyone was internal, nothing to send over the wire
  }

  try {
    const msg = {
      to: externalTo,
      cc: externalCc.length ? externalCc : undefined,
      bcc: externalBcc.length ? externalBcc : undefined,
      from: mail.fromName ? { email: mail.from, name: mail.fromName } : mail.from,
      subject: mail.subject,
      text: mail.bodyText,
      html: mail.bodyHtml,
      replyToList: mail.inReplyToExternalId ? [{ email: mail.from }] : undefined,
      attachments: mail.attachments?.map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
        type: a.mimeType,
      })),
    };

    const result = await sgMail.send(msg);
    return result;
  } catch (error) {
    console.error("SendGrid error:", error);
    throw error;
  }
}

// Very small heuristic spam filter for v1. This is intentionally simple —
// swap in a real provider (SendGrid's built-in filtering, rspamd, SpamAssassin,
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
