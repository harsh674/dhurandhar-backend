const Booking = require("../models/Booking");
const Technician = require("../models/Technician");
const { BOOKING_STATUS, PAYMENT_STATUS, TECH_STATUS } = require("../constants");

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

exports.stats = async () => {
  const today = startOfDay();
  const [totalBookings, activeTechs, pending, completed, revenueAgg, todayRevenueAgg] = await Promise.all([
    Booking.countDocuments({}),
    Technician.countDocuments({ isActive: true, currentStatus: { $ne: TECH_STATUS.OFF_DUTY } }),
    Booking.countDocuments({ status: { $in: [BOOKING_STATUS.NEW, BOOKING_STATUS.ASSIGNED] } }),
    Booking.countDocuments({ status: BOOKING_STATUS.COMPLETED }),
    Booking.aggregate([
      { $match: { paymentStatus: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]),
    Booking.aggregate([
      { $match: { paymentStatus: PAYMENT_STATUS.PAID, completedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]),
  ]);

  return {
    totalBookings,
    activeTechnicians: activeTechs,
    pendingJobs: pending,
    completedJobs: completed,
    revenueTotal: revenueAgg[0]?.total || 0,
    revenueToday: todayRevenueAgg[0]?.total || 0,
  };
};

exports.revenue = async (months = 7) => {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const rows = await Booking.aggregate([
    { $match: { completedAt: { $gte: since }, status: BOOKING_STATUS.COMPLETED } },
    {
      $group: {
        _id: { y: { $year: "$completedAt" }, m: { $month: "$completedAt" } },
        revenue: { $sum: "$finalAmount" },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
  ]);
  return rows.map((r) => ({
    month: `${r._id.y}-${String(r._id.m).padStart(2, "0")}`,
    revenue: r.revenue,
  }));
};

exports.bookingsTrend = async (days = 7) => {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  return Booking.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        bookings: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", BOOKING_STATUS.COMPLETED] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

exports.technicianStats = async () => {
  return Technician.aggregate([
    { $match: { isActive: true } },
    { $sort: { completedJobs: -1 } },
    { $limit: 8 },
    { $project: { name: 1, completedJobs: 1, rating: 1, earnings: 1, currentStatus: 1 } },
  ]);
};

exports.pending = async (limit = 10) =>
  Booking.find({ status: { $in: [BOOKING_STATUS.NEW, BOOKING_STATUS.ASSIGNED] } })
    .sort("-createdAt")
    .limit(limit)
    .populate("technician", "name");
