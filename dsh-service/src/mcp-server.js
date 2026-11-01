import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  proposeIssueSlipLines,
  proposeLedgerRecords,
  readLedgerDay,
  readMenuDay,
} from "../plugins/quanluong-tools/client.js";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function selectedFeatures() {
  const raw = process.env.QUANLUONG_TOOL_FEATURES || "ledger,menu,issue-slip";
  return new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
}

function settings(extra) {
  return {
    backendUrl: process.env.LEDGER_TOOL_BACKEND_URL || "",
    token: process.env.DSH_SERVICE_TOKEN || "",
    ...extra,
  };
}

function text(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

const grantId = z.string().min(1).describe("Grant id from the system prompt. Do not invent one.");
const date = z.string().min(1).describe("Day as YYYY-MM-DD");

/** Read and draft tools only. The backend grant still decides who may call them. */
export function createQuanLuongMcpServer() {
  const server = new McpServer({ name: "quanluong", version: "1.0.0" }, {
    instructions: "Quan Luong tools are read-only or draft-only. Official figures come from the server. Do not commit, save, or apply.",
  });
  const features = selectedFeatures();
  if (features.has("ledger")) {
    server.registerTool("read_ledger_day", {
      description: "Read one kitchen-ledger day, including server checks. Does not write.",
      inputSchema: z.object({ grantId, date }).strict(),
      annotations: readOnly,
    }, async (args) => text(await readLedgerDay(settings(args))));
    server.registerTool("propose_ledger_records", {
      description: "Turn record JSON into a draft. Nothing is saved. The user confirms in the app.",
      inputSchema: z.object({
        grantId,
        date,
        recordsJson: z.string().min(2).describe("JSON text of {records:[...]}."),
      }).strict(),
      annotations: readOnly,
    }, async (args) => {
      const parsed = JSON.parse(args.recordsJson);
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      return text(await proposeLedgerRecords(settings({ ...args, records })));
    });
  }
  if (features.has("menu")) {
    server.registerTool("read_menu_day", {
      description: "Read one menu day. Does not change the menu.",
      inputSchema: z.object({ grantId, date }).strict(),
      annotations: readOnly,
    }, async (args) => text(await readMenuDay(settings(args))));
  }
  if (features.has("issue-slip")) {
    server.registerTool("propose_issue_slip_lines", {
      description: "Return a draft of issue-slip lines. Does not create a slip.",
      inputSchema: z.object({
        grantId,
        linesJson: z.string().min(2).describe("JSON array of {name, qty, uom}."),
      }).strict(),
      annotations: readOnly,
    }, async (args) => {
      const lines = JSON.parse(args.linesJson);
      return text(await proposeIssueSlipLines(settings({ ...args, lines })));
    });
  }
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const server = createQuanLuongMcpServer();
  await server.connect(new StdioServerTransport());
}
