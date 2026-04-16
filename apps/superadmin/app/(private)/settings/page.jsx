"use client";

import { ClientRedirect } from "@/hocs/ClientRedirect";

export default function SettingsRedirectPage() {
  return <ClientRedirect href="/profile" replace />;
}
