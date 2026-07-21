"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import { normalizeStickyLevel, StickyRegistry } from "./stickyRegistry.js";

function isActiveStickyElement(element) {
  if (!element.isConnected || element.hidden || element.getClientRects().length === 0) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function UnifiedPageScrollRoot({ children, className }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }

    const registry = new StickyRegistry();
    const resizeObservers = new Map();

    const applyOffsets = () => {
      for (const element of registry.entries()) {
        const level = normalizeStickyLevel(element.dataset.stickyLevel);
        registry.update(element, {
          level,
          height: element.offsetHeight,
          active: level != null && isActiveStickyElement(element),
        });
      }
      for (const element of registry.entries()) {
        const level = normalizeStickyLevel(element.dataset.stickyLevel);
        element.style.setProperty(
          "--unified-sticky-top",
          `${registry.offsetFor(level)}px`,
        );
      }
    };

    const register = (element) => {
      const level = normalizeStickyLevel(element.dataset.stickyLevel);
      if (level == null) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Invalid data-sticky-level; expected a non-negative integer.", element);
        }
        return;
      }
      registry.register(element, {
        level,
        height: element.offsetHeight,
        active: isActiveStickyElement(element),
      });
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(applyOffsets);
        observer.observe(element);
        resizeObservers.set(element, observer);
      }
    };

    const reconcile = () => {
      const current = new Set(root.querySelectorAll("[data-sticky-level]"));
      for (const element of registry.entries()) {
        if (!current.has(element)) {
          resizeObservers.get(element)?.disconnect();
          resizeObservers.delete(element);
          registry.unregister(element);
        }
      }
      for (const element of current) {
        if (!resizeObservers.has(element) && !registry.entries().includes(element)) {
          register(element);
        }
      }
      applyOffsets();
    };

    reconcile();

    const mutationObserver = new MutationObserver(reconcile);
    mutationObserver.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "data-sticky-level"],
    });
    window.addEventListener("resize", applyOffsets);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("resize", applyOffsets);
      for (const observer of resizeObservers.values()) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-unified-page-scroll
      className={cn("w-full min-w-0", className)}
    >
      {children}
    </div>
  );
}

export function UnifiedStickyStack({ children, className, level = 0 }) {
  return (
    <div
      data-sticky-level={level}
      className={cn("unified-sticky-surface", className)}
    >
      {children}
    </div>
  );
}

export function UnifiedStickyRegion({ children, className, level = 1 }) {
  return (
    <div
      data-sticky-level={level}
      className={cn("unified-sticky-surface", className)}
    >
      {children}
    </div>
  );
}

export function withUnifiedPageScroll(Component, { className } = {}) {
  function UnifiedPageScroll(props) {
    return (
      <UnifiedPageScrollRoot className={className}>
        <Component {...props} />
      </UnifiedPageScrollRoot>
    );
  }

  UnifiedPageScroll.displayName = `withUnifiedPageScroll(${Component.displayName || Component.name || "Component"})`;

  return UnifiedPageScroll;
}
