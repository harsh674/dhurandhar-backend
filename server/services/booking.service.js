const Booking = require("../models/Booking");
const Customer = require("../models/Customer");
const Service = require("../models/Service");
const Technician = require("../models/Technician");
const wa = require("./whatsapp.service");
const { sendNewBookingMail } = require("./mail.service");
const axios = require("axios");

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

  // Create new customer
  if (!customer) {
    customer = await Customer.create({
      phone,
      name: name?.trim(),
      source,
    });

    return customer;
  }

  // Update name if provided and different
  if (
    name &&
    name.trim() &&
    customer.name !== name.trim()
  ) {
    customer.name = name.trim();

    await customer.save();
  }

  return customer;
}

async function sendSms(customerPhone, message) {
  const masterApiKey = process.env.HTTP_SMS_API_KEY;

  const payload =   {
    "to": `+91${customerPhone}`,
    "message": message
};

  try {
    const response = await axios.post(
      "https://www.traccar.org/sms/",
      payload,
      {
        headers: {
          "Authorization": masterApiKey, // Must be the master token
          "Content-Type": "application/json",
        },
      },
    );

    console.log("SMS sent successfully!");
    console.log("Message ID:", response);
  } catch (error) {
    console.error(
      "Error sending SMS:",
      error.response ? error.response.data : error.message,
    );
  }
}

exports.createBooking = async (payload, io) => {
  const service = await Service.findById(payload.serviceId);
  if (!service || !service.isActive)
    throw new ApiError(404, "Service not found");

  const customer = await upsertCustomer(payload.customer, payload.source);

  // Normalize address: preserve provided fields and ensure latitude/longitude and geo are set when available
  const addr = Object.assign({}, payload.address || {});
  const lat = addr.latitude ?? addr.lat ?? (addr.geo && addr.geo.lat);
  const lng = addr.longitude ?? addr.lng ?? (addr.geo && addr.geo.lng);
  if (lat != null && lng != null) {
    addr.latitude = Number(lat);
    addr.longitude = Number(lng);
    addr.geo = { lat: Number(lat), lng: Number(lng) };
  }

  const booking = await Booking.create({
    code: genCode(),
    customer: customer.id,
    customerSnapshot: { name: customer.name, phone: customer.phone },
    service: service.id,
    serviceName: service.serviceName,
    issueType: payload.issueType,
    description: payload.description,
    urgency: payload.urgency,
    address: addr,
    // Scrap Pickup Fields
scrapType: payload.scrapType,
scrapPhoto: payload.scrapPhoto,
estimatedWeight: payload.estimatedWeight,
recurringPickup: payload.recurringPickup || false,
    visitCharge: service.visitCharge,
    estimatedAmount: service.visitCharge,
    status: BOOKING_STATUS.NEW,
    paymentStatus: PAYMENT_STATUS.PENDING,
    source: payload.source,
    timeline: [
      {
        status: BOOKING_STATUS.NEW,
        by: payload.source,
        note: "Booking created",
      },
    ],
  });

  customer.bookingHistory.push(booking.id);
  customer.totalBookings += 1;
  await customer.save();
  sendNewBookingMail({
  customerName:
  customer.name ||
  booking?.customerSnapshot?.phone ||
  customer.phone,
  phone: customer.phone,
  serviceType: service.serviceName,
  address:
    addr.line1 ||
    `${addr.city || ""} ${addr.pincode || ""}` ||
    "N/A",
  issueDescription:
  payload.description ||
  payload.issueType ||
  "No issue description",
});

  if (io)
    io.emit("booking:new", {
      id: booking.id,
      code: booking.code,
      status: booking.status,
    });
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
  // Build location string: prefer explicit lat/lng, fall back to address text
  const lat = booking.address?.latitude ?? booking.address?.geo?.lat;
  const lng = booking.address?.longitude ?? booking.address?.geo?.lng;
  const address =
    booking.address?.line1 === "WHATS_APP_LOCATION" && lat != null && lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `${booking.address?.line1 || ""}${booking.address?.pincode ? `, ${booking.address.pincode}` : ""}`;
  console.log("SMS Details", tech.name, tech.phone, booking);
  sendSms(
    tech.phone,
    `Hi ${tech.name} you have been assigned with Booking ID ${booking.code}. Please contact ${booking.customerSnapshot.phone}. Service: ${booking.serviceName}, Issue: ${booking.issueType}, Urgency: ${booking.urgency}, Location: ${address}`,
  );
  await booking.save();

  // Notify customer on WhatsApp that technician has been assigned
  try {
  const customerPhone = (
    booking.customerSnapshot?.phone || ""
  ).replace(/^\+/, "");

  const techContact = tech.phone || "\u2014";

  const isScrapPickup =
    booking.serviceName?.toLowerCase() === "scrap pickup";

  const customerMsg =
    isScrapPickup
      ? `♻️ *Pickup Partner Assigned Successfully!*

Hi ${
          booking.customerSnapshot?.name || "Customer"
        }, your scrap pickup request has now been assigned.

🆔 *Booking ID:* ${booking.code}

👤 *Pickup Partner:* ${tech.name}

📞 *Contact:* ${techContact}

♻️ *Service:* ${booking.serviceName}

🧾 *Scrap Details:* ${booking.issueType}

📍 *Pickup Location:* 
${address}

⏳ The pickup partner will contact you shortly for scrap collection.

Thank you for using *ServiQ Scrap Pickup* 🙌`
      : `👨‍🔧 *Technician Assigned Successfully!*

Hi ${
          booking.customerSnapshot?.name || "Customer"
        }, your booking has now been assigned to a technician.

🆔 *Booking ID:* ${booking.code}

👤 *Technician:* ${tech.name}

📞 *Contact:* ${techContact}

🛠 *Service:* ${booking.serviceName}

📋 *Issue:* ${booking.issueType}

📍 *Location:* 
${address}

⏳ The technician will contact you shortly to coordinate your service visit.

Thank you for choosing *ServiQ* 🙌`;

  console.log(
    "[booking] sending WhatsApp notification to customer",
    {
      customerPhone,
      customerMsg,
    }
  );
    await wa.sendText(customerPhone, customerMsg);
  } catch (err) {
    console.error('[booking] failed to send WhatsApp notification to customer', err);
  }

  return booking;
};

exports.updateStatus = async (
  bookingId,
  {
    status,
    note,
    finalAmount,

    // Scrap Pickup
    actualWeight,
    amountPaid,
  },
  actor,
) => {
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
        `Illegal transition ${booking.status} → ${status}`,
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
   // Scrap Pickup Completion Data
if (typeof actualWeight === "number") {
  booking.actualWeight = actualWeight;
}

if (typeof amountPaid === "number") {
  booking.amountPaid = amountPaid;
}
  booking.completedAt = now;

  if (typeof finalAmount === "number") {
    booking.finalAmount = finalAmount;
  }

  if (!booking.finalAmount) {
    booking.finalAmount = booking.estimatedAmount;
  }

 const isScrapPickup =
  booking.serviceName?.toLowerCase() === "scrap pickup";

booking.commission = isScrapPickup
  ? 0
  : +(
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

  await booking.save();

  try {
    const customerPhone = (
      booking.customerSnapshot?.phone || ""
    ).replace(/^\+/, "");
    const isScrapPickup =
  booking.serviceName?.toLowerCase() === "scrap pickup";
   const completionMsg = isScrapPickup
  ? `♻️ *Scrap Pickup Completed Successfully!*

Hi ${booking.customerSnapshot?.name || "Customer"},

Your scrap has been collected successfully ✅

🆔 *Booking ID:* ${booking.code}

${
  booking.actualWeight
    ? `⚖️ *Collected Weight:* ${booking.actualWeight} KG`
    : ""
}

${
  booking.amountPaid
    ? `💰 *Amount Paid:* ₹${booking.amountPaid}`
    : ""
}

♻️ Thank you for choosing *ServiQ Scrap Pickup*.

We hope to help you recycle more waste responsibly 🌱

📲 Book again anytime on WhatsApp 🙌`
  : `✅ *Service Completed Successfully!*

Hi ${booking.customerSnapshot?.name || "Customer"},

Your service request has been completed successfully 🎉

🆔 *Booking ID:* ${booking.code}

🛠 *Service:* ${booking.serviceName}

💰 *Final Amount:* ₹${
      booking.finalAmount || booking.estimatedAmount || 0
    }

🙏 We hope you had a great experience with *ServiQ*.

⭐ Please share your feedback by sending:
*Hi*

Then go to:
*My Bookings → Select Booking → Give Feedback*

Thank you for choosing *ServiQ* 🙌`;

    console.log(
      "[booking] sending COMPLETED WhatsApp notification",
      customerPhone
    );

    await wa.sendText(customerPhone, completionMsg);
  } catch (err) {
    console.error(
      "[booking] failed to send COMPLETED WhatsApp notification",
      err
    );
  }

  return booking;
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
  exports.updateStatus(
    bookingId,
    { status: BOOKING_STATUS.CANCELLED, note: reason },
    actor,
  );
