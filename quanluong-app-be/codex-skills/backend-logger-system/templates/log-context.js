function buildRequestLogContext(req) {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id || null,
  };
}

export { buildRequestLogContext };
