const ApiError = require("../utils/ApiError");
const { verify } = require("../utils/jwt");
const Admin = require("../models/Admin");
const Technician = require("../models/Technician");

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "Authentication required");

    const payload = verify(token);
    let user = null;
    if (payload.role === "admin") user = await Admin.findById(payload.sub);
    else if (payload.role === "technician") user = await Technician.findById(payload.sub);
    if (!user || user.isActive === false) throw new ApiError(401, "Invalid session");

    req.user = { id: user.id, role: payload.role, doc: user };
    next();
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(401, "Invalid or expired token"));
  }
}

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, "Forbidden — insufficient role"));
  }
  next();
};

module.exports = { authenticate, requireRole };
