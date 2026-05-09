const asyncHandler = require("../utils/asyncHandler");
const svc = require("../services/customer.service");
const { ok, paginated } = require("../helpers/response");
const { parsePagination } = require("../helpers/pagination");

exports.list = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const { items, total, page, limit } = await svc.list(req.query, pg);
  paginated(res, items, { page, limit, total });
});
exports.get = asyncHandler(async (req, res) => ok(res, await svc.get(req.params.id)));
