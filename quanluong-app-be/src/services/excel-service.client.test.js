import assert from "node:assert/strict";
import test from "node:test";

process.env.EXCEL_SERVICE_URL = "http://excel.test/";
process.env.EXCEL_SERVICE_KEY = "k";
process.env.EXCEL_SERVICE_TIMEOUT_MS = "5000";
process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const { config } = await import("../config/config.js");
const { AppError } = await import("../errors/app-error.js");
const { exportWorkbook, isExcelServiceConfigured, parseWorkbook } = await import(
  "./excel-service.client.js"
);

function mockFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

test("isExcelServiceConfigured returns true when URL is set", () => {
  assert.equal(isExcelServiceConfigured(), true);
});

test("parseWorkbook rejects clearly when Excel service URL is empty", async () => {
  const originalUrl = config.excelService.url;
  config.excelService.url = "";
  try {
    await assert.rejects(
      parseWorkbook(Buffer.from("xlsx")),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 503 &&
        /Excel service chưa cấu hình/i.test(error.message),
    );
  } finally {
    config.excelService.url = originalUrl;
  }
});

test("parseWorkbook posts the workbook and returns parsed JSON", async () => {
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://excel.test/v1/parse?sheet=Data");
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

test("parseWorkbook maps upstream 4xx error message to AppError 400", async () => {
  const restore = mockFetch(async () =>
    new Response(JSON.stringify({ error: { code: "INVALID_XLSX", message: "Tệp không hợp lệ" } }), {
      status: 401,
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
    assert.equal(url.toString(), "http://excel.test/v1/export");
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
