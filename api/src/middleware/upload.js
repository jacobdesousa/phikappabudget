const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const uploadsRoot = path.join(process.cwd(), "uploads");
const receiptsDir = path.join(uploadsRoot, "receipts");
const bonusDir = path.join(uploadsRoot, "chapter-bonus");

function ensureDirs() {
  fs.mkdirSync(receiptsDir, { recursive: true });
  fs.mkdirSync(bonusDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirs();
    cb(null, receiptsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const id = crypto.randomBytes(8).toString("hex");
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  // Accept common receipt formats (images + pdf).
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);
  if (allowed.has(file.mimetype)) return cb(null, true);
  return cb(new Error("Unsupported file type. Upload a JPG, PNG, WEBP, or PDF receipt."));
}

const uploadReceipt = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

function bonusFileFilter(req, file, cb) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (allowed.has(file.mimetype)) return cb(null, true);
  return cb(new Error("Unsupported file type. Upload a JPG, PNG, or WEBP image."));
}

const bonusStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirs();
    cb(null, bonusDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const id = crypto.randomBytes(8).toString("hex");
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

const uploadBonusPhoto = multer({
  storage: bonusStorage,
  fileFilter: bonusFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

module.exports = { uploadReceipt, uploadBonusPhoto };


