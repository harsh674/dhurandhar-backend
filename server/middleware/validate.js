const ApiError = require("../utils/ApiError");

// Joi validate middleware factory — validates req[source] and replaces it with the parsed value.
module.exports = (schema, source = "body") => (req, _res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(new ApiError(400, "Validation failed", error.details.map((d) => d.message)));
  }
  req[source] = value;
  next();
};
