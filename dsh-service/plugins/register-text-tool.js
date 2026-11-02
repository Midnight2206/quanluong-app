import { defineTool } from "@deepseek-ai/dsh-tools";

export function registerTextTool(ctx, spec) {
  ctx.tools.register(defineTool({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }],
    },
    async execute(args) {
      const value = await spec.run(args || {});
      return JSON.stringify(value);
    },
  }));
}
