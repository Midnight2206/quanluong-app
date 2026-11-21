/**
 * Non-mutating sort. Prefers Array.prototype.toSorted (Baseline widely available).
 * Next 15's compiler floor is chrome 64 / safari 12 and does not polyfill the method,
 * so engines without it keep the copy-then-sort path.
 * @template T
 * @param {ArrayLike<T> | null | undefined} list
 * @param {(a: T, b: T) => number} compare
 * @returns {T[]}
 */
export function toSortedCopy(list, compare) {
  if (typeof list?.toSorted === "function") return list.toSorted(compare);
  return [...list].sort(compare);
}
