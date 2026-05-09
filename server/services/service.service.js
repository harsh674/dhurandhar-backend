const Service = require("../models/Service");
const ApiError = require("../utils/ApiError");

exports.list = () => Service.find({ isActive: true }).sort("serviceName");
exports.create = (payload) => Service.create(payload);
exports.update = async (id, payload) => {
  const s = await Service.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!s) throw new ApiError(404, "Service not found");
  return s;
};
exports.remove = async (id) => {
  const s = await Service.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!s) throw new ApiError(404, "Service not found");
  return s;
};
