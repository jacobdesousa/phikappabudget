const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { env } = require("../config/env");

// S3 mode: use memory storage, controllers upload buffer to S3.
// Local mode (dev / no S3_BUCKET): write to disk as before.
const useS3 = Boolean(env.aws.s3Bucket);

const uploadsRoot = path.join(process.cwd(), "uploads");
const receiptsDir = path.join(uploadsRoot, "receipts");
const bonusDir = path.join(uploadsRoot, "chapter-bonus");

function ensureDirs() {
  fs.mkdirSync(receiptsDir, { recursive: true });
  fs.mkdirSync(bonusDir, { recursive: true });
}

function makeFilename(file) {
  const ext = path.extname(file.originalname || "");
  const id = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${id}${ext}`;
}

const memStorage = multer.memoryStorage();

const diskReceiptStorage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDirs(); cb(null, receiptsDir); },
  filename: (req, file, cb) => cb(null, makeFilename(file)),
});

const diskBonusStorage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDirs(); cb(null, bonusDir); },
  filename: (req, file, cb) => cb(null, makeFilename(file)),
});

function receiptFilter(req, file, cb) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (allowed.has(file.mimetype)) return cb(null, true);
  cb(new Error("Unsupported file type. Upload a JPG, PNG, WEBP, or PDF receipt."));
}

function bonusFilter(req, file, cb) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (allowed.has(file.mimetype)) return cb(null, true);
  cb(new Error("Unsupported file type. Upload a JPG, PNG, or WEBP image."));
}

const uploadReceipt = multer({
  storage: useS3 ? memStorage : diskReceiptStorage,
  fileFilter: receiptFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadBonusPhoto = multer({
  storage: useS3 ? memStorage : diskBonusStorage,
  fileFilter: bonusFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

module.exports = { uploadReceipt, uploadBonusPhoto, useS3, makeFilename };
