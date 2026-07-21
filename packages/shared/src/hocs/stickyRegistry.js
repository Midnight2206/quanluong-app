export function normalizeStickyLevel(value) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 0 ? level : null;
}

export class StickyRegistry {
  #entries = new Map();

  register(instance, entry) {
    const level = normalizeStickyLevel(entry?.level);
    if (instance == null || level == null) {
      return false;
    }
    this.#entries.set(instance, {
      level,
      height: Math.max(0, Number(entry?.height) || 0),
      active: entry?.active !== false,
    });
    return true;
  }

  update(instance, patch) {
    const current = this.#entries.get(instance);
    if (!current) {
      return false;
    }
    const nextLevel =
      patch?.level == null ? current.level : normalizeStickyLevel(patch.level);
    if (nextLevel == null) {
      this.#entries.delete(instance);
      return false;
    }
    this.#entries.set(instance, {
      level: nextLevel,
      height:
        patch?.height == null
          ? current.height
          : Math.max(0, Number(patch.height) || 0),
      active: patch?.active == null ? current.active : Boolean(patch.active),
    });
    return true;
  }

  unregister(instance) {
    return this.#entries.delete(instance);
  }

  levelHeights() {
    const heights = new Map();
    for (const { level, height, active } of this.#entries.values()) {
      if (!active) {
        continue;
      }
      heights.set(level, Math.max(heights.get(level) ?? 0, height));
    }
    return heights;
  }

  offsetFor(levelValue) {
    const level = normalizeStickyLevel(levelValue);
    if (level == null) {
      return 0;
    }
    let offset = 0;
    for (const [entryLevel, height] of this.levelHeights()) {
      if (entryLevel < level) {
        offset += height;
      }
    }
    return offset;
  }

  entries() {
    return [...this.#entries.keys()];
  }
}
