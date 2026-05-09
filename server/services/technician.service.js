const Technician = require("../models/Technician");
const Booking = require("../models/Booking");
const ApiError = require("../utils/ApiError");
const { BOOKING_STATUS, TECH_STATUS } = require("../constants");

exports.create = (payload) => Technician.create(payload);

exports.list = async (query, { skip, limit, page }) => {
  const filter = { isActive: true };
  if (query.status) filter.currentStatus = query.status;
  if (query.service) filter.services = query.service;
  if (query.area) filter.areasCovered = query.area;
  if (query.q) filter.$or = [{ name: new RegExp(query.q, "i") }, { phone: new RegExp(query.q, "i") }];

  const [items, total] = await Promise.all([
    Technician.find(filter).populate("services", "serviceName").sort(query.sort || "-rating").skip(skip).limit(limit),
    Technician.countDocuments(filter),
  ]);
  return { items, total, page, limit };
};

exports.get = async (id) => {
  const t = await Technician.findById(id).populate("services");
  if (!t) throw new ApiError(404, "Technician not found");
  return t;
};

exports.update = async (id, payload) => {
  const t = await Technician.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!t) throw new ApiError(404, "Technician not found");
  return t;
};

exports.setAvailability = async (id, isAvailable) => {
  const t = await Technician.findByIdAndUpdate(
    id,
    { isAvailable, currentStatus: isAvailable ? TECH_STATUS.AVAILABLE : TECH_STATUS.OFF_DUTY },
    { new: true }
  );
  if (!t) throw new ApiError(404, "Technician not found");
  return t;
};

exports.earnings = async (id) => {
  const tech = await Technician.findById(id);
  if (!tech) throw new ApiError(404, "Technician not found");
  const agg = await Booking.aggregate([
    { $match: { technician: tech._id, status: BOOKING_STATUS.COMPLETED } },
    {
      $group: {
        _id: null,
        gross: { $sum: "$finalAmount" },
        commission: { $sum: "$commission" },
        jobs: { $sum: 1 },
      },
    },
  ]);
  const a = agg[0] || { gross: 0, commission: 0, jobs: 0 };
  return {
    gross: a.gross,
    net: a.gross - a.commission,
    commission: a.commission,
    jobs: a.jobs,
    commissionDue: tech.commissionDue,
  };
};

exports.completedJobs = async (id, { skip, limit, page }) => {
  const filter = { technician: id, status: BOOKING_STATUS.COMPLETED };
  const [items, total] = await Promise.all([
    Booking.find(filter).sort("-completedAt").skip(skip).limit(limit),
    Booking.countDocuments(filter),
  ]);
  return { items, total, page, limit };
};
