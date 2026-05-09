const asyncHandler = require("../utils/asyncHandler");
const bookingService = require("../services/booking.service");
const { ok, created, paginated } = require("../helpers/response");
const { parsePagination } = require("../helpers/pagination");

exports.create = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const booking = await bookingService.createBooking(req.body, io);
  created(res, booking, "Booking created");
});

exports.list = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const { items, total, page, limit } = await bookingService.listBookings(req.query, pg);
  paginated(res, items, { page, limit, total });
});

exports.get = asyncHandler(async (req, res) => ok(res, await bookingService.getBooking(req.params.id)));

exports.assign = asyncHandler(async (req, res) => {
  const actor = `${req.user.role}:${req.user.id}`;
  ok(res, await bookingService.assignTechnician(req.params.id, req.body.technicianId, actor), "Assigned");
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const actor = `${req.user.role}:${req.user.id}`;
  ok(res, await bookingService.updateStatus(req.params.id, req.body, actor), "Status updated");
});

exports.cancel = asyncHandler(async (req, res) => {
  const actor = `${req.user.role}:${req.user.id}`;
  ok(res, await bookingService.cancel(req.params.id, req.body?.reason, actor), "Cancelled");
});

exports.uploadMedia = asyncHandler(async (req, res) => {
  ok(res, await bookingService.attachMedia(req.params.id, req.files), "Uploaded");
});
