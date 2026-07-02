export type GmailAttachment = {
  filename: string;
  content: Buffer;
};

export type GmailMessageParams = {
  fromEmail: string;
  fromName: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: GmailAttachment[];
};

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value: string): string {
  const safe = sanitizeHeader(value);
  if (/^[\x20-\x7E]*$/.test(safe)) return safe;
  return `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

function encodeQuotedParam(value: string): string {
  return sanitizeHeader(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildBase64Part(content: string | Buffer): string {
  const raw = typeof content === "string"
    ? Buffer.from(content, "utf8").toString("base64")
    : content.toString("base64");
  return wrapBase64(raw);
}

function buildGmailMimeMessage({
  fromEmail,
  fromName,
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  attachments = [],
}: GmailMessageParams): string {
  const mixedBoundary = `mixed_${crypto.randomUUID()}`;
  const alternativeBoundary = `alt_${crypto.randomUUID()}`;
  const hasAttachments = attachments.length > 0;
  const headers = [
    `From: ${encodeHeader(fromName)} <${sanitizeHeader(fromEmail)}>`,
    `To: ${sanitizeHeader(to)}`,
    cc ? `Cc: ${sanitizeHeader(cc)}` : null,
    bcc ? `Bcc: ${sanitizeHeader(bcc)}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
  ].filter((header): header is string => header !== null);

  const alternativeParts = [
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    buildBase64Part(text),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    buildBase64Part(html),
    `--${alternativeBoundary}--`,
  ].join("\r\n");

  if (!hasAttachments) {
    return [...headers, "", alternativeParts].join("\r\n");
  }

  const attachmentParts = attachments.map((attachment) => {
    const filename = encodeQuotedParam(attachment.filename);
    return [
      `--${mixedBoundary}`,
      `Content-Type: application/octet-stream; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      buildBase64Part(attachment.content),
    ].join("\r\n");
  });

  return [
    ...headers,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    alternativeParts,
    ...attachmentParts,
    `--${mixedBoundary}--`,
  ].join("\r\n");
}

export async function getGmailAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const body = await response.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? "Impossible d'obtenir un jeton Gmail valide.");
  }

  return body.access_token;
}

export async function sendGmailMessage(
  accessToken: string,
  message: GmailMessageParams
): Promise<void> {
  const mimeMessage = buildGmailMimeMessage(message);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(mimeMessage) }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Erreur Gmail API (${response.status})`);
  }
}
