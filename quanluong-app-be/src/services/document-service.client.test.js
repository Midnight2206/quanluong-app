import assert from "node:assert/strict";
import test from "node:test";

process.env.DOCUMENT_SERVICE_URL = "http://document.test/";
process.env.DOCUMENT_SERVICE_KEY = "k";
process.env.DOCUMENT_SERVICE_TIMEOUT_MS = "5000";
process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const { config } = await import("../config/config.js");
const { AppError } = await import("../errors/app-error.js");
const {
  exportWorkbook,
  isDocumentServiceConfigured,
  parseWorkbook,
  planPagination,
} = await import("./document-service.client.js");

function mockFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

test("isDocumentServiceConfigured returns true when URL is set", () => {
  assert.equal(isDocumentServiceConfigured(), true);
});

test("parseWorkbook rejects clearly when Document service URL is empty", async () => {
  const originalUrl = config.documentService.url;
  config.documentService.url = "";
  try {
    await assert.rejects(
      parseWorkbook(Buffer.from("xlsx")),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 503 &&
        /Document service chưa cấu hình/i.test(error.message),
    );
  } finally {
    config.documentService.url = originalUrl;
  }
});

test("parseWorkbook posts the workbook and returns parsed JSON", async () => {
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/parse?sheet=Data");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Service-Key"], "k");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("file").name, "upload.xlsx");
    return new Response(JSON.stringify({ sheet: "Data", rows: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    assert.deepEqual(await parseWorkbook(Buffer.from("xlsx"), { sheet: "Data" }), {
      sheet: "Data",
      rows: [],
    });
  } finally {
    restore();
  }
});

test("parseWorkbook keeps upstream 400 error message in AppError 400", async () => {
  const restore = mockFetch(async () =>
    new Response(JSON.stringify({ error: { code: "INVALID_XLSX", message: "Tệp không hợp lệ" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }),
  );
  try {
    await assert.rejects(
      parseWorkbook(Buffer.from("bad")),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.message === "Tệp không hợp lệ",
    );
  } finally {
    restore();
  }
});

for (const status of [401, 403]) {
  test(`parseWorkbook maps upstream ${status} to a generic AppError 502`, async () => {
    const restore = mockFetch(async () =>
      new Response(JSON.stringify({ error: { message: "Invalid service key" } }), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      await assert.rejects(
        parseWorkbook(Buffer.from("bad")),
        (error) =>
          error instanceof AppError &&
          error.statusCode === 502 &&
          error.message === "Document service xác thực nội bộ thất bại",
      );
    } finally {
      restore();
    }
  });
}

test("parseWorkbook maps upstream 5xx to AppError 502", async () => {
  const restore = mockFetch(async () => new Response("failure", { status: 500 }));
  try {
    await assert.rejects(
      parseWorkbook(Buffer.from("xlsx")),
      (error) => error instanceof AppError && error.statusCode === 502,
    );
  } finally {
    restore();
  }
});

test("parseWorkbook maps network errors to AppError 502", async () => {
  const restore = mockFetch(async () => {
    throw new TypeError("fetch failed");
  });
  try {
    await assert.rejects(
      parseWorkbook(Buffer.from("xlsx")),
      (error) => error instanceof AppError && error.statusCode === 502,
    );
  } finally {
    restore();
  }
});

test("exportWorkbook posts JSON and returns a Buffer", async () => {
  const bytes = Uint8Array.from([80, 75, 3, 4]);
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/export");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Service-Key"], "k");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), { sheet: "Sheet1", rows: [["Mã"], ["A01"]] });
    return new Response(bytes, { status: 200 });
  });
  try {
    const result = await exportWorkbook({ sheet: "Sheet1", rows: [["Mã"], ["A01"]] });
    assert.ok(Buffer.isBuffer(result));
    assert.deepEqual(result, Buffer.from(bytes));
  } finally {
    restore();
  }
});

test("exportWorkbook maps an invalid binary response to AppError 502", async () => {
  const restore = mockFetch(async () => ({
    ok: true,
    arrayBuffer: async () => {
      throw new TypeError("terminated");
    },
  }));
  try {
    await assert.rejects(
      exportWorkbook({ sheet: "Sheet1", rows: [["Mã"]] }),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 502 &&
        error.message === "Document service trả về dữ liệu không hợp lệ",
    );
  } finally {
    restore();
  }
});

test("planPagination posts JSON and returns pagination plan", async () => {
  const body = { n_rows: 10, page_content_height: 800, header_height: 40, carry_row_height: 20, signature_block_height: 60 };
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/pagination/plan");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Service-Key"], "k");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), body);
    return new Response(JSON.stringify({ pages: [{ row_count: 10 }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    assert.deepEqual(await planPagination(body), { pages: [{ row_count: 10 }] });
  } finally {
    restore();
  }
});
