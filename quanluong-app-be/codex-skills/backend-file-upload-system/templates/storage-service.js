import path from "node:path";

function buildStoredFilename(originalname) {
  const extension = path.extname(originalname).toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
}

async function storeFile({ file, destination }) {
  const filename = buildStoredFilename(file.originalname);

  return {
    filename,
    destination,
    mimetype: file.mimetype,
    size: file.size,
  };
}

export { storeFile };
