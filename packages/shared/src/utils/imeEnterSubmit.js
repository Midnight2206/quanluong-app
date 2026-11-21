/**
 * Custom Enter-to-submit for inputs and textareas.
 * "compose" is an IME confirm (Vietnamese Telex/VNI, CJK): preventDefault, do not submit.
 * Safari can deliver compositionend before that keydown, so isComposing is already false
 * while keyCode is still 229.
 * @param {{ key?: string, shiftKey?: boolean, isComposing?: boolean, keyCode?: number }} event
 * @param {{ shiftInsertsNewline?: boolean }} [options]
 * @returns {"ignore" | "compose" | "submit"}
 */
export function imeEnterAction(event, { shiftInsertsNewline = false } = {}) {
  if (event.key !== "Enter") return "ignore";
  if (shiftInsertsNewline && event.shiftKey) return "ignore";
  if (event.isComposing || event.keyCode === 229) return "compose";
  return "submit";
}
