import { SIGNATURE_CONFIG } from "./signature-config";

export type SignatureUserData = {
  fullName:      string;
  jobTitle?:     string | null;
  entity?:       string | null;
  phone?:        string | null;
  photoUrl?:     string | null;
  linkedinUrl?:  string | null;
  instagramUrl?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── renderSignatureHtml ───────────────────────────────────────────────────────
// Isomorphic — server (nodemailer) and client (preview), same output.
// Structure is fixed on the validated HTML target. Only variables are substituted.
// border-radius on photo: rendered in Gmail/Apple Mail, square in Outlook (acceptable).

export function renderSignatureHtml(
  data: SignatureUserData,
  config = SIGNATURE_CONFIG
): string {
  const { fullName, jobTitle, entity, phone, photoUrl, linkedinUrl, instagramUrl } = data;

  const hasSocial = !!(linkedinUrl || instagramUrl);
  const colspan   = hasSocial ? "3" : "2";

  // ── Photo cell ────────────────────────────────────────────────────────────
  const photoCell = `<td valign="top" style="padding-right:20px;">
    ${photoUrl
      ? `<img src="${photoUrl}" width="110" height="110" alt="${esc(fullName)}" style="display:block;border-radius:50%;object-fit:cover;background:#1B2A6B;border:0;" />`
      : `<div style="width:110px;height:110px;border-radius:50%;background:#1B2A6B;"></div>`
    }
  </td>`;

  // ── Text cell ─────────────────────────────────────────────────────────────
  const textCell = `<td valign="top" style="padding-right:18px;">
    <div style="font-size:19px;font-weight:700;color:#1B2A6B;">${esc(fullName)}</div>
    ${jobTitle ? `<div style="font-size:14px;color:#3a3f4b;margin-top:2px;">${esc(jobTitle)}</div>` : ""}
    ${entity   ? `<div style="font-size:14px;color:#3a3f4b;">${esc(entity)}</div>` : ""}
    <div style="font-size:14px;color:#3a3f4b;line-height:1.6;margin-top:12px;">
      ${phone ? `${esc(phone)}<br/>` : ""}
      ${config.address}<br/>
      <a href="${config.website}" style="color:#1B2A6B;text-decoration:underline;">${config.websiteLabel}</a>
    </div>
  </td>`;

  // ── Social icons cell (only when at least one URL is filled) ──────────────
  const socialCell = hasSocial
    ? `<td valign="top" width="56" style="border-left:3px solid #4F6BED;padding-left:18px;">
        ${linkedinUrl
          ? `<a href="${esc(linkedinUrl)}"><img src="${config.linkedinIconUrl}" width="28" height="28" alt="LinkedIn" style="display:block;border:0;" /></a>`
          : ""}
        ${instagramUrl
          ? `<a href="${esc(instagramUrl)}"><img src="${config.instagramIconUrl}" width="28" height="28" alt="Instagram" style="display:block;border:0;${linkedinUrl ? "margin-top:10px;" : ""}" /></a>`
          : ""}
      </td>`
    : "";

  // ── CTA row (omitted when buttonLabel or buttonUrl is empty) ──────────────
  const ctaRow = config.buttonLabel && config.buttonUrl
    ? `<tr>
        <td colspan="${colspan}" style="padding-top:16px;">
          <a href="${config.buttonUrl}" style="display:inline-block;background:#E8526A;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 26px;border-radius:24px;font-family:Poppins,Arial,sans-serif;">${config.buttonLabel}</a>
        </td>
      </tr>`
    : "";

  // ── Disclaimer row (omitted when footerText is empty) ─────────────────────
  const disclaimerRow = config.footerText
    ? `<tr>
        <td colspan="${colspan}" style="padding-top:14px;font-size:12px;font-style:italic;color:#5C8A4A;">${config.footerText}</td>
      </tr>`
    : "";

  return `<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
<!--<![endif]-->
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="560" style="border-collapse:collapse;font-family:Poppins,Arial,sans-serif;width:560px;">
  <tr>
    ${photoCell}
    ${textCell}
    ${socialCell}
  </tr>
  ${ctaRow}
  ${disclaimerRow}
</table>`;
}
