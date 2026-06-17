import test from "node:test";
import assert from "node:assert/strict";

import { exportGoogleSheetPdfBuffer } from "./chung-tu-sheet-pdf-export.service.js";

test("exportGoogleSheetPdfBuffer exports the whole spreadsheet as PDF", async () => {
  let requestedUrl = "";
  const oauth2Client = {
    async getAccessToken() {
      return { token: "access-token" };
    },
  };
  const fetchImpl = async (url, options) => {
    requestedUrl = String(url);
    assert.equal(options.headers.Authorization, "Bearer access-token");
    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-type" ? "application/pdf" : null;
        },
      },
      async arrayBuffer() {
        return Uint8Array.from(Buffer.from("%PDF-1.4\nnative-sheet")).buffer;
      },
    };
  };

  const buffer = await exportGoogleSheetPdfBuffer({
    oauth2Client,
    spreadsheetId: "sheet_123",
    fetchImpl,
  });

  assert.equal(buffer.subarray(0, 4).toString("utf8"), "%PDF");
  assert.equal(requestedUrl.startsWith("https://docs.google.com/spreadsheets/d/sheet_123/export?"), true);
  assert.equal(requestedUrl.includes("format=pdf"), true);
  assert.equal(requestedUrl.includes("fzr=true"), true);
  assert.equal(requestedUrl.includes("left_margin=1.1811"), true);
  assert.equal(requestedUrl.includes("right_margin=0.5906"), true);
  assert.equal(requestedUrl.includes("top_margin=0.7874"), true);
  assert.equal(requestedUrl.includes("bottom_margin=0.7874"), true);
  assert.equal(requestedUrl.includes("gid="), false);
});
