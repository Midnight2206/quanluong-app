import { createScriptedRuntime } from "./scripted-runtime.js";
import { createSdkRuntime } from "./sdk-runtime.js";

export function createRuntime(config) {
  if (config.runtime === "scripted") return createScriptedRuntime();
  return createSdkRuntime(config);
}
