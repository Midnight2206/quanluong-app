import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

/** Copy skill bundles into $DSH_HOME/skills so a profile that mounts
 * dsh-skill-filesystem can discover them. The quanluong-skills plugin also
 * exposes the same files through a tool, which does not depend on that mount.
 */
export async function publishSkills(skillsDir, home) {
  const target = path.join(home, "skills");
  await mkdir(target, { recursive: true });
  await cp(skillsDir, target, { recursive: true });
  return target;
}
