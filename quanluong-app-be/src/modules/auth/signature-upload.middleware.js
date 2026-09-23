import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { SIGNATURE_HARD_MAX_BYTES } from "./signature-processing.constants.js";

const INVALID_TYPE_CODE = "INVALID_SIGNATURE_TYPE";

const ALLOWED_MIME = new Set(["image/png"]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(config.media.root, "staging");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, _file, cb) {
    cb(null, `sig-${req.user.id}-${randomUUID()}.png`);
  },
});

const multerSignature = multer({
  storage,
  limits: { fileSize: SIGNATURE_HARD_MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error("Chỉ chấp nhận ảnh chữ ký PNG.");
    err.code = INVALID_TYPE_CODE;
    cb(err);
  },
});

/**
 * POST multipart field name: `signature`
 * Chain: multer (PNG, ≤2MB) → controller → processAndValidateSignaturePng (alpha + crop) → persist.
 */
function uploadSignatureMiddleware(req, res, next) {
  multerSignature.single("signature")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(
          new AppError({
            message: "Ảnh chữ ký tối đa 2MB (khuyến nghị dưới 500KB).",
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
          }),
        );
        return;
      }
    }
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err?.code === INVALID_TYPE_CODE) {
      next(
        new AppError({
          message: err.message,
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        }),
      );
      return;
    }
    next(
      new AppError({
        message: err?.message || "Không tải được file chữ ký.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      }),
    );
  });
}

export { uploadSignatureMiddleware };
