const rateLimit = require("express-rate-limit");

exports.globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many auth attempts, try again later" },
});
