// Shared HTML email layout. Code nodes can't import files, so `npm run sync:n8n`
// copies this block into every node that renders an email; the unit tests fail
// if a copy drifts. Edit it here, never inside the workflow JSON.
const EMAIL_COLORS = {
  border: "#e2dbd1",
  card: "#fffefb",
  muted: "#6c6158",
  onPrimary: "#fdfaf3",
  page: "#fcf9f2",
  panel: "#f4efe7",
  primary: "#206040",
  text: "#2b2018",
};
const EMAIL_TONES = {
  bad: ["#fbe0df", "#9b1c1b"],
  good: ["#e4f1e6", "#123c27"],
  info: [EMAIL_COLORS.panel, EMAIL_COLORS.muted],
  warn: ["#fbe2d2", "#79371e"],
};
const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const HTTP_URL = /^https?:\/\//iu;

function escapeHtml(value) {
  const entities = {
    "'": "&#39;",
    '"': "&quot;",
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  };
  return String(value ?? "").replace(/[&<>"']/gu, (char) => entities[char]);
}

// "2026-11-02" -> "Mon 2 Nov 2026". Loan dates are UTC calendar days.
function formatDay(isoDay) {
  const date = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(isoDay);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
  })
    .format(date)
    .replace(",", "");
}

/** The plain-text twin of renderEmail, from the same paragraphs and button. */
function renderText({ paragraphs, cta }) {
  const link = cta?.url ? [`${cta.label}: ${cta.url}`] : [];
  return [...paragraphs, ...link, "- LendLoop"].join("\n\n");
}

/**
 * Renders a branded, table-based email (inline styles only, so it holds up in
 * Gmail and Outlook). Every value is escaped; links must be http(s).
 * badge: { label, tone: 'good' | 'warn' | 'bad' | 'info' }
 * details: [[label, value], ...]; cta: { label, url } (optional)
 */
function renderEmail({
  preheader,
  badge,
  heading,
  paragraphs,
  details,
  cta,
  footnote,
}) {
  const c = EMAIL_COLORS;
  const [badgeBg, badgeText] = EMAIL_TONES[badge.tone];
  const safeUrl = HTTP_URL.test(cta?.url || "") ? cta.url : null;

  const badgeHtml = `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${badgeBg};color:${badgeText};font:600 12px/1.4 ${SANS};letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(badge.label)}</div>`;
  const body = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 14px;font:16px/1.6 ${SANS};color:${c.text};">${escapeHtml(text)}</p>`
    )
    .join("");
  const rows = details
    .map(([label, value], i) => {
      const cell = `padding:10px 16px;${i ? `border-top:1px solid ${c.border};` : ""}`;
      return `<tr>
      <td style="${cell}font:13px/1.4 ${SANS};color:${c.muted};width:96px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="${cell}font:600 14px/1.4 ${SANS};color:${c.text};word-break:break-word;">${escapeHtml(value)}</td>
    </tr>`;
    })
    .join("");
  const detailsHtml = rows
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;background:${c.panel};border:1px solid ${c.border};border-radius:10px;border-collapse:separate;table-layout:fixed;">${rows}</table>`
    : "";
  const ctaHtml = safeUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 6px;"><tr>
        <td style="border-radius:8px;background:${c.primary};">
          <a href="${escapeHtml(safeUrl)}" style="display:inline-block;padding:12px 22px;font:600 15px/1 ${SANS};color:${c.onPrimary};text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)} &rarr;</a>
        </td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${c.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.page};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 4px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:32px;height:32px;border-radius:8px;background:${c.primary};color:${c.onPrimary};font:700 17px/32px ${SANS};text-align:center;">&#8635;</td>
        <td style="padding-left:10px;font:600 21px/1 ${SERIF};color:${c.text};">LendLoop</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${c.card};border:1px solid ${c.border};border-radius:14px;padding:30px 28px 26px;">
      ${badgeHtml}
      <h1 style="margin:14px 0 16px;font:600 25px/1.25 ${SERIF};color:${c.text};">${escapeHtml(heading)}</h1>
      ${body}${detailsHtml}${ctaHtml}
    </td></tr>
    <tr><td style="padding:18px 6px 0;font:13px/1.6 ${SANS};color:${c.muted};text-align:center;">
      <div style="font:italic 14px/1.6 ${SERIF};color:${c.text};">Borrow what you need. Lend what you don&rsquo;t.</div>
      <div>${escapeHtml(footnote || "You’re getting this because you lend or borrow tools on LendLoop.")}</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
