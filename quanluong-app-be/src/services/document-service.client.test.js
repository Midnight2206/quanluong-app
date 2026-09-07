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
const { ERROR_CODES } = await import("../errors/error-codes.js");
const {
  createDocumentFolder,
  exportWorkbook,
  getDocumentFolder,
  getTemplateFields,
  isDocumentServiceConfigured,
  listTemplates,
  parseWorkbook,
  planPagination,
  previewTemplatePdf,
  previewTemplatePdfResponse,
  publishTemplate,
  renderDocumentPdf,
  renderToDocumentFolder,
  retireTemplate,
  uploadTemplate,
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

test("listTemplates returns upstream JSON array", async () => {
  const restore = mockFetch(async (url) => {
    assert.equal(url.toString(), "http://document.test/v1/templates");
    return new Response(JSON.stringify([{ id: 1, name: "a", version: "1" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    assert.deepEqual(await listTemplates(), [{ id: 1, name: "a", version: "1" }]);
  } finally {
    restore();
  }
});

test("renderDocumentPdf returns a Buffer", async () => {
  const bytes = Uint8Array.from([37, 80, 68, 70]);
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/templates/3/documents");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), {
      fields: { don_vi: "A" },
      rows: [{ stt: "1" }],
      signatures: {},
      signature_dates: {},
    });
    return new Response(bytes, { status: 200 });
  });
  try {
    const result = await renderDocumentPdf(3, { fields: { don_vi: "A" }, rows: [{ stt: "1" }] });
    assert.ok(Buffer.isBuffer(result));
    assert.deepEqual(result, Buffer.from(bytes));
  } finally {
    restore();
  }
});

test("renderDocumentPdf maps upstream 409 to AppError 409 with CONFLICT", async () => {
  const restore = mockFetch(async () =>
    new Response(
      JSON.stringify({ error: { code: "TEMPLATE_NOT_PUBLISHED", message: "Template chưa được publish" } }),
      {
        status: 409,
        headers: { "content-type": "application/json" },
      },
    ),
  );
  try {
    await assert.rejects(
      renderDocumentPdf(3, { fields: { don_vi: "A" } }),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === ERROR_CODES.CONFLICT &&
        error.message === "Template chưa được publish",
    );
  } finally {
    restore();
  }
});

test("previewTemplatePdf returns a Buffer", async () => {
  const bytes = Uint8Array.from([37, 80, 68, 70]);
  const restore = mockFetch(async (url) => {
    assert.equal(url.toString(), "http://document.test/v1/templates/3/preview");
    return new Response(bytes, { status: 200 });
  });
  try {
    const result = await previewTemplatePdf(3);
    assert.ok(Buffer.isBuffer(result));
    assert.deepEqual(result, Buffer.from(bytes));
  } finally {
    restore();
  }
});

test("previewTemplatePdfResponse returns the upstream Response", async () => {
  const bytes = Uint8Array.from([37, 80, 68, 70]);
  const restore = mockFetch(async (url) => {
    assert.equal(url.toString(), "http://document.test/v1/templates/3/preview");
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="preview-3.pdf"',
      },
    });
  });
  try {
    const result = await previewTemplatePdfResponse(3);
    assert.ok(result instanceof Response);
    assert.equal(result.headers.get("content-type"), "application/pdf");
    assert.equal(result.headers.get("content-disposition"), 'inline; filename="preview-3.pdf"');
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), Buffer.from(bytes));
  } finally {
    restore();
  }
});

test("publishTemplate posts and returns upstream JSON", async () => {
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/templates/3/publish");
    assert.equal(options.method, "POST");
    return new Response(JSON.stringify({ id: 3, status: "published" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    assert.deepEqual(await publishTemplate(3), { id: 3, status: "published" });
  } finally {
    restore();
  }
});

test("retireTemplate posts and returns upstream JSON", async () => {
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/templates/3/retire");
    assert.equal(options.method, "POST");
    return new Response(JSON.stringify({ id: 3, status: "retired" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    assert.deepEqual(await retireTemplate(3), { id: 3, status: "retired" });
  } finally {
    restore();
  }
});

test("getTemplateFields maps upstream 404 to AppError 404", async () => {
  const restore = mockFetch(async () =>
    new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Không tìm thấy mẫu" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    }),
  );
  try {
    await assert.rejects(
      getTemplateFields(99),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 404 &&
        error.message === "Không tìm thấy mẫu",
    );
  } finally {
    restore();
  }
});

test("uploadTemplate posts multipart form", async () => {
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/templates");
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("name"), "bien_ban");
    assert.equal(options.body.get("version"), "1");
    return new Response(JSON.stringify({ id: 2, name: "bien_ban", version: "1", file_path: null }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    assert.deepEqual(await uploadTemplate({ buffer: Buffer.from("xlsx"), name: "bien_ban", version: "1" }), {
      id: 2,
      name: "bien_ban",
      version: "1",
      file_path: null,
    });
  } finally {
    restore();
  }
});

test("createDocumentFolder posts JSON and returns folder metadata", async () => {
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/folders");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Service-Key"], "k");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), { name: "batch-2026-06" });
    return new Response(
      JSON.stringify({ id: 7, name: "batch-2026-06", created_at: "2026-06-01T00:00:00Z" }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  });
  try {
    assert.deepEqual(await createDocumentFolder({ name: "batch-2026-06" }), {
      id: 7,
      name: "batch-2026-06",
      created_at: "2026-06-01T00:00:00Z",
    });
  } finally {
    restore();
  }
});

test("renderToDocumentFolder posts snake_case payload and returns file metadata", async () => {
  const restore = mockFetch(async (url, options) => {
    assert.equal(url.toString(), "http://document.test/v1/folders/7/documents");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), {
      template_id: 3,
      file_name: "2026-06-01.pdf",
      sort_key: "2026-06-01",
      fields: { ngay_thang_nam: "Ngày 01 tháng 06 năm 2026" },
      rows: [{ stt: "1", ten_hang: "Gạo" }],
      signatures: { ke_toan: "Nguyễn A" },
      signature_dates: { ke_toan: "01/06/2026" },
      signature_block: { columns: 2 },
    });
    return new Response(JSON.stringify({ file_id: 11, file_name: "2026-06-01.pdf" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    assert.deepEqual(
      await renderToDocumentFolder(7, {
        templateId: 3,
        fileName: "2026-06-01.pdf",
        sortKey: "2026-06-01",
        fields: { ngay_thang_nam: "Ngày 01 tháng 06 năm 2026" },
        rows: [{ stt: "1", ten_hang: "Gạo" }],
        signatures: { ke_toan: "Nguyễn A" },
        signatureDates: { ke_toan: "01/06/2026" },
        signatureBlock: { columns: 2 },
      }),
      { file_id: 11, file_name: "2026-06-01.pdf" },
    );
  } finally {
    restore();
  }
});

test("getDocumentFolder maps upstream 404 to AppError 404", async () => {
  const restore = mockFetch(async () =>
    new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Không tìm thấy folder" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    }),
  );
  try {
    await assert.rejects(
      getDocumentFolder(99),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 404 &&
        error.message === "Không tìm thấy folder",
    );
  } finally {
    restore();
  }
});
