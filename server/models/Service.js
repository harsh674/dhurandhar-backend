const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, index: true },
    icon: String,
    visitCharge: { type: Number, required: true, default: 99 },
    issueTypes: [{ name: String, basePrice: Number, estimatedMinutes: Number }],
    estimatedTime: { type: String, default: "30-60 min" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

serviceSchema.pre("validate", function (next) {
  if (!this.slug && this.serviceName) {
    this.slug = this.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  next();
});

module.exports = mongoose.model("Service", serviceSchema);
