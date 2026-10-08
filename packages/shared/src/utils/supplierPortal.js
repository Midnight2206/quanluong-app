import { getSupplierOriginEnv } from "./runtimeEnv.js";

function trimOrigin(value) {
  return String(value).replace(/\/+$/, "");
}

function isLocalhostHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isLocalhostOrigin(origin) {
  try {
    return isLocalhostHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function preferEnvOrigin(raw) {
  if (!raw) {
    return undefined;
  }
  if (typeof window === "undefined") {
    return trimOrigin(raw);
  }
  if (isLocalhostOrigin(raw) && !isLocalhostHost(window.location.hostname)) {
    return undefined;
  }
  return trimOrigin(raw);
}

export function supplierOriginFromLocation({ protocol, hostname, port }) {
  if (port === "8080" || port === "8081") {
    return `${protocol}//${hostname}:8082`;
  }
  if (port === "3000" || port === "3001") {
    return `${protocol}//${hostname}:3002`;
  }
  return "http://localhost:3002";
}

export function getSupplierAppOrigin() {
  const fromEnv = preferEnvOrigin(getSupplierOriginEnv());
  if (fromEnv) {
    return fromEnv;
  }
  if (typeof window === "undefined") {
    return "http://localhost:3002";
  }
  return supplierOriginFromLocation(window.location);
}
