const asyncHandler = require("../utils/asyncHandler");
const svc = require("../services/dashboard.service");
const { ok } = require("../helpers/response");

exports.stats = asyncHandler(async (_req, res) => ok(res, await svc.stats()));
exports.revenue = asyncHandler(async (req, res) => ok(res, await svc.revenue(parseInt(req.query.months || "7", 10))));
exports.bookingsTrend = asyncHandler(async (req, res) =>
  ok(res, await svc.bookingsTrend(parseInt(req.query.days || "7", 10)))
);
exports.technicianStats = asyncHandler(async (_req, res) => ok(res, await svc.technicianStats()));
exports.pending = asyncHandler(async (req, res) => ok(res, await svc.pending(parseInt(req.query.limit || "10", 10))));
