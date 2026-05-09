const Admin = require("../models/Admin");
const Technician = require("../models/Technician");
const ApiError = require("../utils/ApiError");
const { sign } = require("../utils/jwt");

exports.adminLogin = async ({ email, password }) => {
  const admin = await Admin.findOne({ email }).select("+password");
  if (!admin || !(await admin.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }
  const token = sign({ sub: admin.id, role: "admin" });
  return { token, user: { id: admin.id, name: admin.name, email: admin.email, role: "admin" } };
};

exports.technicianLogin = async ({ phone, password }) => {
  const tech = await Technician.findOne({ phone }).select("+password");
  if (!tech || !(await tech.comparePassword(password))) {
    throw new ApiError(401, "Invalid phone or password");
  }
  const token = sign({ sub: tech.id, role: "technician" });
  return { token, user: { id: tech.id, name: tech.name, phone: tech.phone, role: "technician" } };
};

exports.technicianRegister = async (payload) => {
  const exists = await Technician.findOne({ phone: payload.phone });
  if (exists) throw new ApiError(409, "Phone already registered");
  const tech = await Technician.create(payload);
  const token = sign({ sub: tech.id, role: "technician" });
  return { token, user: { id: tech.id, name: tech.name, phone: tech.phone, role: "technician" } };
};
