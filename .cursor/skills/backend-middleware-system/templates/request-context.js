export const attachRequestContext = (req, _res, next) => {
  req.context = {
    requestId: crypto.randomUUID(),
  };

  return next();
};
