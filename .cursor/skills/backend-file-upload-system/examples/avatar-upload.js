import { upload } from "../templates/upload-middleware.js";
import { validateFile } from "../templates/file-validator.js";
import { storeFile } from "../templates/storage-service.js";

const avatarUpload = [
  upload.single("avatar"),
  async (req, res, next) => {
    try {
      validateFile(req.file, {
        allowedMimeTypes: ["image/jpeg", "image/png"],
        allowedExtensions: [".jpg", ".jpeg", ".png"],
        maxSizeBytes: 2 * 1024 * 1024,
      });

      const storedFile = await storeFile({
        file: req.file,
        destination: "uploads/avatars",
      });

      res.json({ data: storedFile });
    } catch (error) {
      next(error);
    }
  },
];

export { avatarUpload };
