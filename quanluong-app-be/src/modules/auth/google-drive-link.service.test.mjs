import assert from "node:assert/strict";
import test from "node:test";
import { verifyDriveFolderOrClearLink } from "./google-drive-link.service.js";

function googleNotFoundError() {
  const error = new Error("File not found");
  error.response = {
    status: 404,
    data: {
      error: {
        errors: [{ reason: "notFound" }],
      },
    },
  };
  return error;
}

test("verifyDriveFolderOrClearLink retries 404 three times then clears stale link", async () => {
  let attempts = 0;
  let cleared = false;

  const result = await verifyDriveFolderOrClearLink({
    folderId: "missing-folder",
    getFolder: async () => {
      attempts += 1;
      throw googleNotFoundError();
    },
    clearLink: async () => {
      cleared = true;
    },
    retryDelayMs: 0,
  });

  assert.equal(attempts, 3);
  assert.equal(cleared, true);
  assert.deepEqual(result, { status: "cleared" });
});

test("verifyDriveFolderOrClearLink keeps link when retry eventually finds folder", async () => {
  let attempts = 0;
  let cleared = false;

  const result = await verifyDriveFolderOrClearLink({
    folderId: "existing-folder",
    getFolder: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw googleNotFoundError();
      }
      return { id: "existing-folder", mimeType: "application/vnd.google-apps.folder", trashed: false };
    },
    clearLink: async () => {
      cleared = true;
    },
    retryDelayMs: 0,
  });

  assert.equal(attempts, 3);
  assert.equal(cleared, false);
  assert.deepEqual(result, { status: "linked", folderId: "existing-folder" });
});

test("verifyDriveFolderOrClearLink clears link when folder is trashed", async () => {
  let cleared = false;

  const result = await verifyDriveFolderOrClearLink({
    folderId: "trashed-folder",
    getFolder: async () => ({
      id: "trashed-folder",
      mimeType: "application/vnd.google-apps.folder",
      trashed: true,
    }),
    clearLink: async () => {
      cleared = true;
    },
    retryDelayMs: 0,
  });

  assert.equal(cleared, true);
  assert.deepEqual(result, { status: "cleared" });
});
