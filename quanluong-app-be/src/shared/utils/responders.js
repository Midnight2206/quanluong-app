function respondSuccess(res, { statusCode = 200, message = "Success", data = null, meta } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

function respondCreated(res, { message = "Created successfully", data = null, meta } = {}) {
  return respondSuccess(res, {
    statusCode: 201,
    message,
    data,
    meta,
  });
}

export { respondCreated, respondSuccess };
