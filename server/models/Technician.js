const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { TECH_STATUS } = require("../constants");

const technicianSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
    areasCovered: [{ type: String, index: true }], // pincodes / locality names
    experienceYears: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    completedJobs: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    currentStatus: { type: String, enum: Object.values(TECH_STATUS), default: TECH_STATUS.AVAILABLE },
    aadhaar: {
      number: { type: String, select: false },
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
    },
    profileImage: String,
    earnings: { type: Number, default: 0 },
    commissionDue: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

technicianSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

technicianSchema.methods.comparePassword = function (pw) {
  return bcrypt.compare(pw, this.password);
};

module.exports = mongoose.model("Technician", technicianSchema);
