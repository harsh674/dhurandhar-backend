const asyncHandler = require("../utils/asyncHandler");
const svc = require("../services/service.service");
const { ok, created } = require("../helpers/response");

exports.list = asyncHandler(async (_req, res) => ok(res, await svc.list()));
exports.create = asyncHandler(async (req, res) => created(res, await svc.create(req.body)));
exports.update = asyncHandler(async (req, res) => ok(res, await svc.update(req.params.id, req.body)));
exports.remove = asyncHandler(async (req, res) => ok(res, await svc.remove(req.params.id)));
