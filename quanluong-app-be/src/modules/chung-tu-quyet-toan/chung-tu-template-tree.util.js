import { CHUNG_TU_CATEGORY_LIST } from "./chung-tu-category.constants.js";

const CATEGORY_FOLDER_NAME_TO_KEY = new Map(
  CHUNG_TU_CATEGORY_LIST.map((item) => [item.folderName, item.key]),
);

export function buildTemplateFullDisplayName(folderPath, templateName, { separator = " / " } = {}) {
  const folders = (Array.isArray(folderPath) ? folderPath : [])
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  const leaf = String(templateName ?? "").trim();
  const parts = leaf ? [...folders, leaf] : folders;
  return parts.join(separator);
}

export function resolveCategoryKeyFromFolderPath(folderPath) {
  const folders = Array.isArray(folderPath) ? folderPath : [];
  for (const name of folders) {
    const key = CATEGORY_FOLDER_NAME_TO_KEY.get(String(name ?? "").trim());
    if (key) return key;
  }
  return null;
}

export function sortDriveEntriesByName(items) {
  return [...items].sort((a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), "vi", { sensitivity: "base" }),
  );
}
