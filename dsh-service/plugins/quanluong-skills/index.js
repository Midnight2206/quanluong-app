import { defineTool } from "@deepseek-ai/dsh-tools";
import { listSkills, loadSkill } from "./catalog.js";

export const name = "quanluong-skills";
export const inject = ["tools"];

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: "load_quanluong_skill",
    description: "Load the full text of one Quan Luong business-rule skill before drafting records.",
    parameters: {
      name: { type: "string", required: true, description: "Skill name, for example ledger-rules" },
    },
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }],
    },
    async execute(args) {
      const skill = await loadSkill(args.name);
      if (!skill) return `No skill named ${args.name}.`;
      const catalog = await listSkills();
      const names = catalog.map((item) => item.name).join(", ");
      return `<skill_content name="${skill.name}">\n${skill.body}\n</skill_content>\nOther skills: ${names}`;
    },
  }));
}
