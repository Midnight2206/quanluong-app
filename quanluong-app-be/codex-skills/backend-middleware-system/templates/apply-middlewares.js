export const applyMiddlewares = ({
  attachRequestContext,
  cookieParser,
  authenticateRequest,
  validateRequest,
  controller,
}) => {
  return [
    attachRequestContext,
    cookieParser,
    authenticateRequest,
    validateRequest,
    controller,
  ];
};
