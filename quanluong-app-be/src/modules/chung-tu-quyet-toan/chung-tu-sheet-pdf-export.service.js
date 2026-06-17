import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function cmToInch(cm) {
  return Number(cm) / 2.54;
}

function buildGoogleSheetPdfExportUrl(spreadsheetId) {
  const id = encodeURIComponent(String(spreadsheetId ?? "").trim());
  const params = new URLSearchParams({
    format: "pdf",
    size: "A4",
    portrait: "true",
    fitw: "true",
    sheetnames: "false",
    printtitle: "false",
    pagenumbers: "false",
    gridlines: "false",
    fzr: "true",
    left_margin: cmToInch(3).toFixed(4),
    right_margin: cmToInch(1.5).toFixed(4),
    top_margin: cmToInch(2).toFixed(4),
    bottom_margin: cmToInch(2).toFixed(4),
  });
  return `https://docs.google.com/spreadsheets/d/${id}/export?${params.toString()}`;
}

async function exportGoogleSheetPdfBuffer({ oauth2Client, spreadsheetId, fetchImpl = fetch }) {
  const id = String(spreadsheetId ?? "").trim();
  if (!id) {
    throw new AppError({
      message: "Thiếu Google Sheet ID để xuất PDF.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken = tokenResponse?.token;
  if (!accessToken) {
    throw new AppError({
      message: "Không lấy được access token Google để xuất PDF.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  const url = buildGoogleSheetPdfExportUrl(id);
  const res = await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {
      details = "";
    }
    throw new AppError({
      message: "Google Sheets không xuất được PDF.",
      statusCode: res.status === 404 ? 404 : 502,
      code: res.status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.INTERNAL_SERVER_ERROR,
      details: details.slice(0, 500),
    });
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new AppError({
      message: "Google Sheets trả về nội dung không phải PDF.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return buffer;
}

export { buildGoogleSheetPdfExportUrl, exportGoogleSheetPdfBuffer };
