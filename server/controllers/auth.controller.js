const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");
const { ok, created } = require("../helpers/response");

exports.adminLogin = asyncHandler(async (req, res) => ok(res, await authService.adminLogin(req.body), "Logged in"));
exports.technicianLogin = asyncHandler(async (req, res) =>
  ok(res, await authService.technicianLogin(req.body), "Logged in")
);
exports.technicianRegister = asyncHandler(async (req, res) =>
  created(res, await authService.technicianRegister(req.body), "Registered")
);
exports.me = asyncHandler(async (req, res) =>
  ok(res, { id: req.user.id, role: req.user.role, profile: req.user.doc })
);
