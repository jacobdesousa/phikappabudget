const { env } = require("../config/env");

let _sesClient = null;
function getSesClient() {
  if (_sesClient) return _sesClient;
  const { SESClient } = require("@aws-sdk/client-ses");
  _sesClient = new SESClient({
    region: process.env.AWS_REGION ?? "us-west-2",
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  return _sesClient;
}

function buildFrom() {
  return `${env.mail.fromName} <${env.mail.from}>`;
}

/**
 * @param {{
 *   to: string|string[], subject: string, html: string, text?: string,
 *   attachments?: Array<{filename: string, content: Buffer, contentType: string}>,
 *   inlineImages?: Array<{cid: string, content: Buffer, contentType: string}>
 * }} opts
 */
async function sendMail({ to, subject, html, text, attachments = [], inlineImages = [] }) {
  const toList = Array.isArray(to) ? to : [to];

  if (env.mail.provider !== "ses") {
    console.log(`[dev-mail] To: ${toList.join(", ")}`);
    console.log(`[dev-mail] Subject: ${subject}`);
    console.log(`[dev-mail] Attachments: ${attachments.map((a) => a.filename).join(", ") || "none"}`);
    console.log(`[dev-mail] Body: ${text ?? "(html only)"}`);
    return;
  }

  const { SendRawEmailCommand } = require("@aws-sdk/client-ses");
  const client = getSesClient();

  const boundary = `----=_PKS_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `${boundary}_alt`;

  const b64 = (str) => Buffer.from(str).toString("base64").match(/.{1,76}/g).join("\r\n");

  const lines = [
    `From: ${buildFrom()}`,
    `To: ${toList.join(", ")}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(text ?? ""),
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(html),
    ``,
    `--${altBoundary}--`,
  ];

  for (const att of attachments) {
    lines.push(
      ``,
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      ``,
      att.content.toString("base64").match(/.{1,76}/g).join("\r\n"),
    );
  }

  lines.push(``, `--${boundary}--`);

  const rawMessage = lines.join("\r\n");

  await client.send(
    new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawMessage) },
    })
  );
}

module.exports = { sendMail };
