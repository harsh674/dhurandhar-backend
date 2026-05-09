const ApiError = require("../utils/ApiError");

// Centralised error handler — last middleware
// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
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

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error("[error]", err);
  }

  res.status(status).json({ success: false, message, code: status, details });
};

module.exports.notFound = (req, _res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
