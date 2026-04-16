import { getJson, setJson } from "./redis-cache.js";

async function getOrSetCache({ key, ttlSeconds, loader }) {
  const cachedValue = await getJson(key);

  if (cachedValue) {
    return cachedValue;
  }

  const freshValue = await loader();
  await setJson(key, freshValue, ttlSeconds);

  return freshValue;
}

export { getOrSetCache };
