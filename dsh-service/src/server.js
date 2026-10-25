import { createServer as createHttpServer } from "node:http";
import { bearerOk } from "./auth.js";
import { createAuditLog } from "./audit.js";
import path from "node:path";
import { SessionStore } from "./sessions.js";

const BODY_LIMIT = 8_000_000;

function send(res, status, body, headers = {}) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(raw),
    ...headers,
  });
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error("Body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("JSON body required"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function systemText(body) {
  const lines = [body.system || ""];
  if (body.grantId) {
    lines.push(`Tool grant id: ${body.grantId}. Pass this exact grantId to every Quan Luong tool. Do not invent another id.`);
  }
  lines.push("Before drafting, call load_quanluong_skill for the matching rules. Finish with the JSON object the user asked for.");
  return lines.filter(Boolean).join("\n\n");
}

function wantsSse(req) {
  return String(req.headers.accept || "").includes("text/event-stream");
}

function sendSse(res, payload) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "close",
  });
  res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
  res.write("event: done\ndata: {}\n\n");
  res.end();
}

export function createServer({ config, runtime, sessions = new SessionStore(), audit } = {}) {
  const writeAudit = audit || createAuditLog(path.join(config.home, "audit.log"));
  const server = createHttpServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://dsh.internal");
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        const status = await runtime.status();
        send(res, 200, { status: "ok", ...status });
        return;
      }
      if (!bearerOk(req.headers.authorization, config.token)) {
        send(res, 401, { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" });
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/profiles") {
        send(res, 200, {
          ok: true,
          data: {
            profile: config.profile,
            splitProfiles: config.splitProfiles,
            surfaces: ["web", "superadmin", "supplier"],
          },
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/sessions") {
        const body = await readBody(req);
        const row = sessions.open(body);
        send(res, 201, row);
        return;
      }
      const message = /^\/v1\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
      if (req.method === "POST" && message) {
        const body = await readBody(req);
        const row = sessions.assertOwner(sessions.get(decodeURIComponent(message[1])), body);
        if (config.runtime !== "scripted" && body.mockContent) {
          send(res, 400, { ok: false, error: "mockContent is only for the scripted runtime" });
          return;
        }
        const started = Date.now();
        const result = await runtime.complete({
          sessionId: row.id,
          accountId: row.accountId,
          unitId: row.unitId,
          surface: row.surface,
          system: systemText(body),
          text: String(body.text || ""),
          image: body.image || null,
          model: body.model || config.model,
          temperature: body.temperature,
          feature: body.feature || "",
          grantId: body.grantId || "",
          mockContent: body.mockContent,
        });
        const payload = {
          messageId: `msg-${Date.now()}`,
          role: "assistant",
          content: result.content,
          model: result.model,
          provider: result.provider,
          engine: "dsh",
          sessionId: row.id,
        };
        await writeAudit({
          kind: "gateway",
          status: "ok",
          feature: body.feature || "",
          accountId: row.accountId,
          unitId: row.unitId,
          surface: row.surface,
          model: result.model,
          ms: Date.now() - started,
        }).catch((error) => {
          console.error(`[dsh-audit] ${error?.message || error}`);
        });
        if (wantsSse(req)) sendSse(res, payload);
        else send(res, 200, payload);
        return;
      }
      send(res, 404, { ok: false, error: "Not found" });
    } catch (error) {
      const status = error.status || (error.code === "DSH_UNAVAILABLE" ? 503 : 500);
      send(res, status, {
        ok: false,
        error: error.message || "DSH error",
        code: error.code || (status === 503 ? "DSH_UNAVAILABLE" : "INTERNAL"),
      });
    }
  });
  return server;
}
