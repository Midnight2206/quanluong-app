export async function fetchDriveFileMeta(drive, fileId, fields) {
  const res = await drive.files.get({
    fileId,
    fields,
    supportsAllDrives: false,
  });
  return res.data;
}

export async function isDescendantOfFolder(drive, fileId, ancestorFolderId) {
  let currentId = String(fileId ?? "");
  const target = String(ancestorFolderId ?? "");
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    if (currentId === target) return true;
    const meta = await fetchDriveFileMeta(drive, currentId, "id, parents, trashed, driveId");
    if (meta.trashed || meta.driveId) return false;
    const parentId = meta.parents?.[0];
    if (!parentId) return false;
    currentId = parentId;
  }
  return false;
}

export async function buildFolderPathFromDrive(drive, folderId, stopAtFolderId) {
  const path = [];
  let currentId = String(folderId ?? "");
  const stopId = String(stopAtFolderId ?? "");
  const seen = new Set();
  while (currentId && currentId !== stopId && !seen.has(currentId)) {
    seen.add(currentId);
    const meta = await fetchDriveFileMeta(drive, currentId, "id, name, parents, trashed, driveId");
    if (meta.trashed || meta.driveId) break;
    if (meta.name) path.unshift(meta.name);
    const parentId = meta.parents?.[0];
    if (!parentId || parentId === stopId) break;
    currentId = parentId;
  }
  return path;
}
