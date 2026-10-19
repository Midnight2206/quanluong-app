"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import httpClient from "@/services/httpClient";

const FLUSH_MS = 30000;
const BEAT_MS = 60000;
const IDLE_MS = 60000;

/** Ghi trang đã xem + thời gian hoạt động (tab hiển thị và có tương tác trong 60 giây gần nhất). */
export function UsageTracker() {
  const pathname = usePathname();
  const queue = useRef([]);
  const lastInput = useRef(Date.now());
  const lastBeat = useRef(Date.now());

  useEffect(() => {
    if (pathname) queue.current.push({ kind: "PAGE_VIEW", path: pathname, at: new Date().toISOString() });
  }, [pathname]);

  useEffect(() => {
    const touch = () => {
      lastInput.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "mousemove"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const flush = () => {
      const events = queue.current.splice(0, 50);
      if (!events.length) return;
      httpClient.post("/audit-logs/usage/batch", { events }, { skipTargetUnitHeader: true }).catch(() => {});
    };

    const beat = setInterval(() => {
      const now = Date.now();
      const sec = Math.round((now - lastBeat.current) / 1000);
      lastBeat.current = now;
      if (document.visibilityState === "visible" && now - lastInput.current < IDLE_MS) {
        queue.current.push({ kind: "HEARTBEAT", path: window.location.pathname, sec: Math.min(sec, 120) });
      }
    }, BEAT_MS);
    const timer = setInterval(() => flush(), FLUSH_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => flush());

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(beat);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, []);

  return null;
}
