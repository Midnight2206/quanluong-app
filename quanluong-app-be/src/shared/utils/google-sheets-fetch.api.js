import {
  googleFetchJson,
  serializeGoogleQueryParams,
} from "./google-api-fetch.util.js";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Sheets v4 client qua fetch (tránh lỗi gaxios Premature close trong Docker).
 * API surface tương thích googleapis: `{ data }`.
 */
export function createSheetsClient(oauth2Client) {
  return {
    spreadsheets: {
      async get(params = {}) {
        const { spreadsheetId, ...rest } = params;
        const query = serializeGoogleQueryParams(rest, { excludeKeys: ["spreadsheetId"] });
        const data = await googleFetchJson(
          oauth2Client,
          `${SHEETS_BASE}/${encodeURIComponent(String(spreadsheetId))}`,
          { query, apiLabel: "Google Sheets API" },
        );
        return { data };
      },
      async batchUpdate(params = {}) {
        const { spreadsheetId, requestBody } = params;
        const data = await googleFetchJson(
          oauth2Client,
          `${SHEETS_BASE}/${encodeURIComponent(String(spreadsheetId))}:batchUpdate`,
          {
            method: "POST",
            body: requestBody ?? {},
            apiLabel: "Google Sheets API",
          },
        );
        return { data };
      },
      values: {
        async batchUpdate(params = {}) {
          const { spreadsheetId, requestBody } = params;
          const query = new URLSearchParams();
          const option = requestBody?.valueInputOption;
          if (option) query.set("valueInputOption", String(option));
          const data = await googleFetchJson(
            oauth2Client,
            `${SHEETS_BASE}/${encodeURIComponent(String(spreadsheetId))}/values:batchUpdate`,
            {
              method: "POST",
              query,
              body: requestBody ?? {},
              apiLabel: "Google Sheets API",
            },
          );
          return { data };
        },
      },
    },
  };
}
