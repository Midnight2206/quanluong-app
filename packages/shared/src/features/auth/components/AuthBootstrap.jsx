"use client";

import { useEffect } from "react";
import { useGetCurrentUserQuery } from "@/features/auth/api/authApi";
import { setAuthChecking, setAuthInitialized, useAuthInitialized } from "@/features/auth/model/authSlice";

export function AuthBootstrap({ children }) {
  const isInitialized = useAuthInitialized();
  const { isLoading, isFetching, isSuccess, isError } = useGetCurrentUserQuery();

  useEffect(() => {
    setAuthChecking();
  }, []);

  useEffect(() => {
    if (isSuccess || isError) {
      setAuthInitialized();
    }
  }, [isError, isSuccess]);

  if (!isInitialized && (isLoading || isFetching)) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-panel">
          <h1 className="mt-3 text-xl font-semibold">Đang tải…</h1>
        </div>
      </div>
    );
  }

  return children;
}
