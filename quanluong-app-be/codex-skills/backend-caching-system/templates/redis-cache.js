import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

async function getJson(key) {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

async function setJson(key, data, ttlSeconds) {
  const payload = JSON.stringify(data);

  if (ttlSeconds) {
    await redis.set(key, payload, "EX", ttlSeconds);
    return;
  }

  await redis.set(key, payload);
}

async function deleteKeys(keys) {
  if (!keys.length) {
    return;
  }

  await redis.del(keys);
}

export { redis, getJson, setJson, deleteKeys };
