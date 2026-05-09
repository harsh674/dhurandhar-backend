const Joi = require("joi");
const { URGENCY, BOOKING_STATUS } = require("../constants");

exports.adminLogin = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

exports.technicianLogin = Joi.object({
  phone: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

exports.technicianRegister = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+?\d{10,15}$/).required(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).required(),
  services: Joi.array().items(Joi.string().hex().length(24)).default([]),
  areasCovered: Joi.array().items(Joi.string()).default([]),
  experienceYears: Joi.number().min(0).max(60).default(0),
});

exports.createBooking = Joi.object({
  customer: Joi.object({
    name: Joi.string().max(100).optional(),
    phone: Joi.string().pattern(/^\+?\d{10,15}$/).required(),
  }).required(),
  serviceId: Joi.string().hex().length(24).required(),
  issueType: Joi.string().max(120).optional(),
  description: Joi.string().max(1000).optional(),
  urgency: Joi.string().valid(...Object.values(URGENCY)).default(URGENCY.NORMAL),
  address: Joi.object({
    line1: Joi.string().max(200).required(),
    city: Joi.string().max(80).optional(),
    pincode: Joi.string().pattern(/^\d{4,8}$/).required(),
    geo: Joi.object({ lat: Joi.number(), lng: Joi.number() }).optional(),
  }).required(),
  source: Joi.string().valid("whatsapp", "app", "web", "admin").default("admin"),
});

exports.updateStatus = Joi.object({
  status: Joi.string().valid(...Object.values(BOOKING_STATUS)).required(),
  note: Joi.string().max(300).optional(),
  finalAmount: Joi.number().min(0).optional(),
});

exports.assignTechnician = Joi.object({
  technicianId: Joi.string().hex().length(24).required(),
});

exports.createService = Joi.object({
  serviceName: Joi.string().min(2).max(80).required(),
  icon: Joi.string().max(80).optional(),
  visitCharge: Joi.number().min(0).required(),
  estimatedTime: Joi.string().max(40).optional(),
  issueTypes: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      basePrice: Joi.number().min(0).default(0),
      estimatedMinutes: Joi.number().min(0).default(30),
    })
  ).default([]),
});
