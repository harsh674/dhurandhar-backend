const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    geo: { lat: Number, lng: Number },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    address: addressSchema,
    bookingHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
    totalBookings: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    source: { type: String, enum: ["whatsapp", "app", "web", "admin"], default: "whatsapp" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
