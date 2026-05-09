const ApiError = require("../utils/ApiError");

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {

  console.error("========== ERROR START ==========");
  console.error("URL:", req.originalUrl);
  console.error("METHOD:", req.method);
  console.error("ERROR:", err);
  console.error("STACK:", err.stack);
  console.error("========== ERROR END ==========");

  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details;

  if (err.name === "ValidationError") {
    status = 400;
    details = Object.values(err.errors).map((e) => e.message);
    message = "Validation failed";
  } else if (err.code === 11000) {
    status = 409;
    message = "Duplicate value";
    details = err.keyValue;
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  res.status(status).json({
    success: false,
    message,
    code: status,
    details,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
};

module.exports.notFound = (req, _res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
