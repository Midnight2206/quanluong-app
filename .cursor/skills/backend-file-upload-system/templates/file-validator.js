import path from "node:path";

function validateFile(file, { allowedMimeTypes, allowedExtensions, maxSizeBytes }) {
  if (!file) {
    throw new Error("File is required.");
  }

  const extension = path.extname(file.originalname).toLowerCase();

  if (maxSizeBytes && file.size > maxSizeBytes) {
    throw new Error("File is too large.");
  }

  if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
    throw new Error("File type is not allowed.");
  }

  if (allowedExtensions && !allowedExtensions.includes(extension)) {
    throw new Error("File extension is not allowed.");
  }
}

export { validateFile };
