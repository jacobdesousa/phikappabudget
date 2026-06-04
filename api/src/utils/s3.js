const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { env } = require("../config/env");

let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  _s3 = new S3Client({
    region: env.aws.region,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
      : undefined,
  });
  return _s3;
}

const S3_PREFIX = "pks-uploads";

// key: e.g. "receipts/filename.jpg" or "chapter-bonus/filename.jpg"
async function uploadToS3({ key, buffer, contentType }) {
  await getS3().send(new PutObjectCommand({
    Bucket: env.aws.s3Bucket,
    Key: `${S3_PREFIX}/${key}`,
    Body: buffer,
    ContentType: contentType,
  }));
  return `/uploads/${key}`;
}

async function streamFromS3(key, res) {
  const cmd = new GetObjectCommand({ Bucket: env.aws.s3Bucket, Key: `${S3_PREFIX}/${key}` });
  const data = await getS3().send(cmd);
  res.set("Content-Type", data.ContentType ?? "application/octet-stream");
  if (data.ContentLength) res.set("Content-Length", String(data.ContentLength));
  res.set("Cache-Control", "private, max-age=3600");
  data.Body.pipe(res);
}

module.exports = { uploadToS3, streamFromS3 };
