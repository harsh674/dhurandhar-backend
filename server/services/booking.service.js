const Booking = require("../models/Booking");
const Customer = require("../models/Customer");
const Service = require("../models/Service");
const Technician = require("../models/Technician");
const axios=require("axios");

const ApiError = require("../utils/ApiError");
const {
  BOOKING_STATUS,
  BOOKING_TRANSITIONS,
  TECH_STATUS,
  COMMISSION_RATE,
  PAYMENT_STATUS,
} = require("../constants");

const genCode = () => "SQ-" + Math.floor(10000 + Math.random() * 89999);

async function upsertCustomer({ phone, name }, source = "admin") {
  let customer = await Customer.findOne({ phone });
  if (!customer) customer = await Customer.create({ phone, name, source });
  else if (name && !customer.name) {
    customer.name = name;
    await customer.save();
  }
  return customer;
}

async function sendSms(customerPhone, message) {
    const masterApiKey = process.env.HTTP_SMS_API_KEY; 
    
    const payload = {
        from: process.env.SERVIQ_PHONE_NUMBER, // Your ServiQ WhatsApp number 
        to: `+${customerPhone}`,        
        content: message
    };
    console.log("SMS Payload:", payload);
    try {
        const response = await axios.post('https://api.httpsms.com/v1/messages/send', payload, {
            headers: {
                'x-api-key': masterApiKey, // Must be the master token
                'Content-Type': 'application/json'
            }
        });

        console.log('SMS sent successfully!');
        console.log('Message ID:', response.data.data.id);
        console.log('Status:', response.data.data.status);
    } catch (error) {
        console.error('Error sending SMS:', error.response ? error.response.data : error.message);
    }
}



exports.createBooking = async (payload, io) => {
  const service = await Service.findById(payload.serviceId);
  if (!service || !service.isActive) throw new ApiError(404, "Service not found");

  const customer = await upsertCustomer(payload.customer, payload.source);

  const booking = await Booking.create({
    code: genCode(),
    customer: customer.id,
    customerSnapshot: { name: customer.name, phone: customer.phone },
    service: service.id,
    serviceName: service.serviceName,
    issueType: payload.issueType,
    description: payload.description,
    urgency: payload.urgency,
    address: payload.address,
    visitCharge: service.visitCharge,
    estimatedAmount: service.visitCharge,
    status: BOOKING_STATUS.NEW,
    paymentStatus: PAYMENT_STATUS.PENDING,
    source: payload.source,
    timeline: [{ status: BOOKING_STATUS.NEW, by: payload.source, note: "Booking created" }],
  });

  customer.bookingHistory.push(booking.id);
  customer.totalBookings += 1;
  await customer.save();

  if (io) io.emit("booking:new", { id: booking.id, code: booking.code, status: booking.status });
  return booking;
};

exports.listBookings = async (query, { skip, limit, page }) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.urgency) filter.urgency = query.urgency;
  if (query.technicianId) filter.technician = query.technicianId;
  if (query.pincode) filter["address.pincode"] = query.pincode;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }
  if (query.q) {
    filter.$or = [
      { code: new RegExp(query.q, "i") },
      { "customerSnapshot.name": new RegExp(query.q, "i") },
      { "customerSnapshot.phone": new RegExp(query.q, "i") },
      { serviceName: new RegExp(query.q, "i") },
    ];
  }

  const sort = query.sort || "-createdAt";
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate("technician", "name phone rating currentStatus")
      .populate("service", "serviceName icon")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);
  return { items, total, page, limit };
};

exports.getBooking = async (id) => {
  const booking = await Booking.findById(id)
    .populate("technician", "name phone rating currentStatus")
    .populate("customer")
    .populate("service");
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

exports.assignTechnician = async (bookingId, technicianId, actor) => {
  const [booking, tech] = await Promise.all([
    Booking.findById(bookingId),
    Technician.findById(technicianId),
  ]);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (!tech) throw new ApiError(404, "Technician not found");
  if (!tech.isAvailable) throw new ApiError(409, "Technician is not available");
  if (![BOOKING_STATUS.NEW, BOOKING_STATUS.ASSIGNED].includes(booking.status)) {
    throw new ApiError(409, `Cannot assign in status ${booking.status}`);
  }

  booking.technician = tech.id;
  booking.status = BOOKING_STATUS.ASSIGNED;
  booking.assignedAt = new Date();
  booking.timeline.push({
    status: BOOKING_STATUS.ASSIGNED,
    by: actor,
    note: `Assigned to ${tech.name}`,
  });
  console.log("SMS Details",tech.name, tech.phone, booking.customerSnapshot.phone);
  sendSms(tech.phone, `Hi ${tech.name} you have been assigned with Booking ID ${booking.code}. Please contact ${booking.customerSnapshot.phone}.`);
  await booking.save();
  return booking;
};

exports.updateStatus = async (bookingId, { status, note, finalAmount }, actor) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  // Only enforce transitions for technicians
  const isAdmin = actor.startsWith("admin:");

  if (!isAdmin) {
    const allowed = BOOKING_TRANSITIONS[booking.status] || [];

    if (!allowed.includes(status)) {
      throw new ApiError(
        409,
        `Illegal transition ${booking.status} → ${status}`
      );
    }
  }

  booking.status = status;

  booking.timeline.push({
    status,
    by: actor,
    note,
  });

  const now = new Date();

  if (status === BOOKING_STATUS.ACCEPTED) booking.acceptedAt = now;

  if (status === BOOKING_STATUS.STARTED) booking.startedAt = now;

  if (status === BOOKING_STATUS.CANCELLED) {
    booking.cancelledAt = now;
    booking.cancelReason = note;
  }

  if (status === BOOKING_STATUS.COMPLETED) {
    booking.completedAt = now;

    if (typeof finalAmount === "number") {
      booking.finalAmount = finalAmount;
    }

    if (!booking.finalAmount) {
      booking.finalAmount = booking.estimatedAmount;
    }

    booking.commission = +(
      booking.finalAmount * COMMISSION_RATE
    ).toFixed(2);

    if (booking.technician) {
      await Technician.findByIdAndUpdate(booking.technician, {
        $inc: {
          completedJobs: 1,
          earnings: booking.finalAmount - booking.commission,
          commissionDue: booking.commission,
        },
        $set: {
          currentStatus: TECH_STATUS.AVAILABLE,
        },
      });
    }

    await Customer.findByIdAndUpdate(booking.customer, {
      $inc: {
        totalSpend: booking.finalAmount,
      },
    });
  }

  await booking.save();

  return booking;
};

exports.attachMedia = async (bookingId, files) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");
  const media = (files || []).map((f) => ({
    url: f.path || f.secure_url || f.location,
    publicId: f.filename || f.public_id,
    type: f.mimetype && f.mimetype.startsWith("video") ? "video" : "image",
  }));
  booking.media.push(...media);
  await booking.save();
  return booking;
};

exports.cancel = async (bookingId, reason, actor) =>
  exports.updateStatus(bookingId, { status: BOOKING_STATUS.CANCELLED, note: reason }, actor);
