import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  proposeIssueSlipLines,
  proposeLedgerRecords,
  readLedgerDay,
  readMenuDay,
} from "./client.js";

export const name = "quanluong-tools";
export const inject = ["tools"];

function selectedFeatures() {
  const raw = process.env.QUANLUONG_TOOL_FEATURES || "ledger,menu,issue-slip";
  return new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
}

function settings() {
  return {
    backendUrl: process.env.LEDGER_TOOL_BACKEND_URL || "",
    token: process.env.DSH_SERVICE_TOKEN || "",
  };
}

function jsonTool({ name, description, parameters, run }) {
  return defineTool({
    name,
    description,
    parameters,
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }],
    },
    async execute(args, exec) {
      const value = await run({ ...settings(), ...args, signal: exec?.signal });
      return JSON.stringify(value);
    },
  });
}

const grant = { type: "string", required: true, description: "Grant id from the system prompt. Do not invent one." };
const date = { type: "string", required: true, description: "Day as YYYY-MM-DD" };

export function apply(ctx) {
  const features = selectedFeatures();
  if (features.has("ledger")) {
    ctx.tools.register(jsonTool({
      name: "read_ledger_day",
      description: "Read one kitchen-ledger day. Numbers are already computed by the server. This does not write.",
      parameters: { grantId: grant, date },
      run: readLedgerDay,
    }));
    ctx.tools.register(jsonTool({
      name: "propose_ledger_records",
      description: "Turn record JSON into a draft. The server places lines. Nothing is saved. The user must confirm in the app.",
      parameters: {
        grantId: grant,
        date,
        recordsJson: { type: "string", required: true, description: "JSON text of {records:[...]}." },
      },
      run: async (args) => {
        const parsed = JSON.parse(args.recordsJson);
        const records = Array.isArray(parsed) ? parsed : parsed.records;
        return proposeLedgerRecords({ ...args, records });
      },
    }));
  }
  if (features.has("menu")) {
    ctx.tools.register(jsonTool({
      name: "read_menu_day",
      description: "Read one menu day. Does not change the menu.",
      parameters: { grantId: grant, date },
      run: readMenuDay,
    }));
  }
  if (features.has("issue-slip")) {
    ctx.tools.register(jsonTool({
      name: "propose_issue_slip_lines",
      description: "Return a draft of issue-slip lines. Does not create a slip.",
      parameters: {
        grantId: grant,
        linesJson: { type: "string", required: true, description: "JSON array of {name, qty, uom}." },
      },
      run: async (args) => proposeIssueSlipLines({ ...args, lines: JSON.parse(args.linesJson) }),
    }));
  }
}
