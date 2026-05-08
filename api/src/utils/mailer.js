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
      : undefined, // falls back to IAM role on EC2/EB
  });
  return _sesClient;
}

/**
 * @param {{ to: string|string[], subject: string, html: string, text?: string }} opts
 */
async function sendMail({ to, subject, html, text }) {
  const toList = Array.isArray(to) ? to : [to];

  if (env.mail.provider !== "ses") {
    console.log(`[dev-mail] To: ${toList.join(", ")}`);
    console.log(`[dev-mail] Subject: ${subject}`);
    console.log(`[dev-mail] Body: ${text ?? html}`);
    return;
  }

  const { SendEmailCommand } = require("@aws-sdk/client-ses");
  const client = getSesClient();

  await client.send(
    new SendEmailCommand({
      Source: `${env.mail.fromName} <${env.mail.from}>`,
      Destination: { ToAddresses: toList },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: html, Charset: "UTF-8" },
          ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
        },
      },
    })
  );
}

module.exports = { sendMail };
