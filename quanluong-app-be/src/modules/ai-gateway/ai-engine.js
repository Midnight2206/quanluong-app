export function readAiEngine(env = process.env) {
  const raw = String(env.AI_ENGINE || env.LEDGER_AI_ENGINE || "direct").trim().toLowerCase();
  return raw === "dsh" ? "dsh" : "direct";
}
