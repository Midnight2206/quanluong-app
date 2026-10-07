import http from "node:http";
import { WATCHED_CONTAINERS } from "./system-infra.classify.js";

function dockerGet(pathname, socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath, path: pathname, method: "GET", timeout: 2000 },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            reject(new Error(`docker ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("docker timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function listWatchedContainers(get = dockerGet) {
  const wanted = new Set(WATCHED_CONTAINERS);
  const list = await get("/containers/json?all=1");
  const hits = [];
  for (const item of list || []) {
    const name = (item.Names || [])
      .map((value) => String(value).replace(/^\//, ""))
      .find((value) => wanted.has(value));
    if (name && item.Id) hits.push({ name, id: item.Id });
  }
  const rows = await Promise.all(
    hits.map(async (hit) => {
      const body = await get(`/containers/${hit.id}/json`);
      return [
        hit.name,
        {
          status: body?.State?.Status ?? "",
          health: body?.State?.Health?.Status ?? null,
        },
      ];
    }),
  );
  return new Map(rows);
}

export { dockerGet, listWatchedContainers };
