function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    const sanitizedObject = {};

    Object.entries(value).forEach(([key, nestedValue]) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return;
      }

      sanitizedObject[key] = sanitizeValue(nestedValue);
    });

    return sanitizedObject;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

function sanitizeInput(req, _res, next) {
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);

  next();
}

export { sanitizeInput };
