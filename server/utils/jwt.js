const jwt = require("jsonwebtoken");
const env = require("../config/env");

const sign = (payload, opts = {}) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn, ...opts });

const verify = (token) => jwt.verify(token, env.jwtSecret);

module.exports = { sign, verify };
