// Local-disk storage for case documents via multer.
//
// NOTE: this stores files on the server's local disk under /uploads.
// That's fine for local dev and single-instance deploys, but most
// PaaS hosts (Railway/Render free tiers etc.) have an EPHEMERAL
// filesystem — uploaded files will be wiped on every redeploy/restart.
// For production, swap `storage` below for a cloud-storage adapter
// (Supabase Storage, S3, etc.) and set `fileUrl` to the returned public
// URL instead of the local /uploads path.

const path = require("path");
const fs = require("fs");
const os = require("os");                    // ← naya import add kar
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(os.tmpdir(), "uploads", "cases");   // ← ye line change kar

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const unique = crypto.randomBytes(16).toString("hex");
        const ext = path.extname(file.originalname).slice(0, 20);
        cb(null, `${Date.now()}-${unique}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error("Unsupported file type"));
    },
});

module.exports = { upload, UPLOAD_DIR };
