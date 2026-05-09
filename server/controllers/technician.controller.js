const asyncHandler = require("../utils/asyncHandler");
const svc = require("../services/technician.service");
const { ok, created, paginated } = require("../helpers/response");
const { parsePagination } = require("../helpers/pagination");

exports.create = asyncHandler(async (req, res) => created(res, await svc.create(req.body)));
exports.list = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const { items, total, page, limit } = await svc.list(req.query, pg);
  paginated(res, items, { page, limit, total });
});
exports.get = asyncHandler(async (req, res) => ok(res, await svc.get(req.params.id)));
exports.update = asyncHandler(async (req, res) => ok(res, await svc.update(req.params.id, req.body)));
exports.setAvailability = asyncHandler(async (req, res) =>
  ok(res, await svc.setAvailability(req.params.id, !!req.body.isAvailable))
);
exports.earnings = asyncHandler(async (req, res) => ok(res, await svc.earnings(req.params.id)));
exports.completedJobs = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const { items, total, page, limit } = await svc.completedJobs(req.params.id, pg);
  paginated(res, items, { page, limit, total });
});
