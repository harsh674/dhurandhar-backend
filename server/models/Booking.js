const mongoose = require("mongoose");
const { BOOKING_STATUS, PAYMENT_STATUS, URGENCY } = require("../constants");

const mediaSchema = new mongoose.Schema(
  { url: String, publicId: String, type: { type: String, enum: ["image", "video"] } },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(BOOKING_STATUS) },
    at: { type: Date, default: Date.now },
    by: { type: String }, // userId/role string for audit
    note: String,
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // e.g. SQ-10284
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    customerSnapshot: { name: String, phone: String },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: "Technician", index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: String,
    issueType: String,
    description: String,
    urgency: { type: String, enum: Object.values(URGENCY), default: URGENCY.NORMAL },
    address: {
      line1: String,
      city: String,
      pincode: { type: String, index: true },
      geo: { lat: Number, lng: Number },
    },
    media: [mediaSchema],

    // Pricing
    visitCharge: { type: Number, default: 0 },
    estimatedAmount: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.NEW,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    paymentMethod: { type: String, enum: ["cash", "upi", "card", "online"], default: "cash" },

    timeline: [timelineSchema],
    source: { type: String, enum: ["whatsapp", "app", "web", "admin"], default: "whatsapp" },

    assignedAt: Date,
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);

bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ "address.pincode": 1, status: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
