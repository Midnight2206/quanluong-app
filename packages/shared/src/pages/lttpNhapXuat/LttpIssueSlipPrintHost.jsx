"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { LttpIssueSlipPrintDocument } from "./LttpIssueSlipPrintDocument";
import {
  buildLttpPrintLayoutFromSettings,
  buildPrintPageCss,
  getLttpIssueSlipLivePrintJob,
  registerLttpIssueSlipPrintHost,
  subscribeLttpIssueSlipLivePrintJob,
  unregisterLttpIssueSlipPrintHost,
} from "./lttpIssueSlipPrint";

/**
 * Host in cố định trên trang Nhập xuất LTTP.
 * - Tab Phiếu xuất: đăng ký `livePrintJob` (luôn có trong DOM) → `window.print()`.
 * - Tab Lịch sử: gọi `printLttpIssueSlipPrintJobs` → host in tạm `overrideJobs`.
 */
export function LttpIssueSlipPrintHost() {
  const [mounted, setMounted] = useState(false);
  const [liveJob, setLiveJob] = useState(null);
  const [overrideJobs, setOverrideJobs] = useState(null);
  const settleRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  const cleanup = useCallback((err) => {
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
    const settle = settleRef.current;
    settleRef.current = null;
    setOverrideJobs(null);
    if (settle) {
      if (err) settle.reject(err);
      else settle.resolve();
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setLiveJob(getLttpIssueSlipLivePrintJob());
    return subscribeLttpIssueSlipLivePrintJob(() => {
      setLiveJob(getLttpIssueSlipLivePrintJob());
    });
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;

    const onAfterPrint = () => cleanup();

    const api = {
      print(nextJobs) {
        if (!Array.isArray(nextJobs) || nextJobs.length === 0) {
          return Promise.reject(new Error("Không có phiếu để in."));
        }
        return new Promise((resolve, reject) => {
          settleRef.current = { resolve, reject };
          window.addEventListener("afterprint", onAfterPrint, { once: true });
          fallbackTimerRef.current = window.setTimeout(() => cleanup(), 120_000);
          flushSync(() => {
            setOverrideJobs(nextJobs);
          });
          requestAnimationFrame(() => {
            try {
              window.print();
            } catch (err) {
              cleanup(err);
            }
          });
        });
      },
    };

    registerLttpIssueSlipPrintHost(api);
    return () => {
      unregisterLttpIssueSlipPrintHost(api);
      cleanup(new Error("Print host đã gỡ."));
    };
  }, [mounted, cleanup]);

  const jobs = overrideJobs ?? (liveJob ? [liveJob] : []);
  if (!mounted || jobs.length === 0) {
    return null;
  }

  const layout = jobs[0]?.layout ?? buildLttpPrintLayoutFromSettings();

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: buildPrintPageCss(layout) }} />
      <div className="lttp-issue-slip-print-root text-black">
        {jobs.map((job, index) => (
          <LttpIssueSlipPrintDocument
            key={`print-job-${index}`}
            slip={job.slip}
            fontFamily={job.layout.fontFamily}
            fontSizePt={job.layout.fontSizePt}
            breakAfter={index < jobs.length - 1}
          />
        ))}
      </div>
    </>,
    document.body,
  );
}
