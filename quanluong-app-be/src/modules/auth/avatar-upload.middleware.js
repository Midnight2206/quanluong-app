import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const INVALID_TYPE_CODE = "INVALID_AVATAR_TYPE";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(config.media.root, "staging");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = MIME_TO_EXT[file.mimetype] || ".img";
    cb(null, `${req.user.id}-${randomUUID()}${ext}`);
  },
});

const multerAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error("Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF.");
    err.code = INVALID_TYPE_CODE;
    cb(err);
  },
});

/**
 * POST multipart field name: `avatar`
 */
function uploadAvatarMiddleware(req, res, next) {
  multerAvatar.single("avatar")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(
          new AppError({
            message: "Ảnh tối đa 2MB.",
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
        message: err?.message || "Không tải được file.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      }),
    );
  });
}

export { uploadAvatarMiddleware };
