const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");

exports.list = async (query, { skip, limit, page }) => {
  const filter = {};
  if (query.q) filter.$or = [{ name: new RegExp(query.q, "i") }, { phone: new RegExp(query.q, "i") }];
  const [items, total] = await Promise.all([
    Customer.find(filter).sort("-createdAt").skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  return { items, total, page, limit };
};

exports.get = async (id) => {
  const c = await Customer.findById(id).populate({ path: "bookingHistory", options: { sort: "-createdAt", limit: 20 } });
  if (!c) throw new ApiError(404, "Customer not found");
  return c;
};
