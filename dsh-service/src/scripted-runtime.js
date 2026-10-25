export function createScriptedRuntime(script = {}) {
  return {
    kind: "scripted",
    async status() {
      return { dsh: "ready", runtime: "scripted" };
    },
    async complete(request) {
      if (script.fail) {
        const error = new Error(script.fail);
        error.code = "DSH_UNAVAILABLE";
        error.status = 503;
        throw error;
      }
      const content = script.reply ? await script.reply(request) : (request.mockContent || "{\"records\":[]}");
      return {
        content,
        model: request.model || "mock-openrouter",
        provider: "openrouter",
      };
    },
    async close() {},
  };
}
