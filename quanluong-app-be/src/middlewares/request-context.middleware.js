import { randomUUID } from "node:crypto";

function requestContextMiddleware(req, _res, next) {
  req.requestId = req.headers["x-request-id"] || randomUUID();
  next();
}

export { requestContextMiddleware };
