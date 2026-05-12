// Tracks per-customer WhatsApp conversation state for the booking flow.
const mongoose = require("mongoose");

const waSessionSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  step: {
    type: String,
    enum: [
      "IDLE",
      "ASK_SERVICE",
      "ASK_ISSUE",
      "ASK_URGENCY",
      "ASK_LOCATION",
      "ASK_MANUAL_ADDRESS",
      "CONFIRM",
      "VIEW_ACTIVE_BOOKINGS",   // Add this
      "AWAIT_CANCEL_CONFIRM"    // Add this
    ],
    default: "IDLE",
  },
    draft: {
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
      serviceName: String,
      issueType: String,
      urgency: String,
      address: { line1: String, pincode: String },
      media: [{ url: String, type: String }],
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WhatsAppSession", waSessionSchema);
