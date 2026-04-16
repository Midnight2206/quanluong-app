import helmet from "helmet";

function createHelmetMiddleware() {
  return helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

export { createHelmetMiddleware };
