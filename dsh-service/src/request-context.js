import { AsyncLocalStorage } from "node:async_hooks";

export const requestContext = new AsyncLocalStorage();

export function currentActor() {
  return requestContext.getStore() || null;
}
