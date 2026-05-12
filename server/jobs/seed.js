// One-shot seeder: admin + services + a few technicians + sample bookings.
// Run: npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const Admin = require("../models/Admin");
const Service = require("../models/Service");
const Technician = require("../models/Technician");
const Customer = require("../models/Customer");
const Booking = require("../models/Booking");
const Feedback = require("../models/Feedback");
const { BOOKING_STATUS, PAYMENT_STATUS, URGENCY } = require("../constants");

const SERVICES = [
  { serviceName: "Plumbing", icon: "wrench", visitCharge: 99, estimatedTime: "30-60 min",
    issueTypes: [{ name: "Pipe leakage", basePrice: 350, estimatedMinutes: 45 }, { name: "Tap replacement", basePrice: 250, estimatedMinutes: 30 }] },
  { serviceName: "Electrical", icon: "zap", visitCharge: 99, estimatedTime: "30-60 min",
    issueTypes: [{ name: "Short circuit", basePrice: 500, estimatedMinutes: 60 }, { name: "Fan installation", basePrice: 300, estimatedMinutes: 45 }] },
  { serviceName: "AC Repair", icon: "snowflake", visitCharge: 199, estimatedTime: "45-90 min",
    issueTypes: [{ name: "Not cooling", basePrice: 800, estimatedMinutes: 90 }, { name: "Gas refill", basePrice: 1500, estimatedMinutes: 60 }] },
  { serviceName: "Cleaning", icon: "sparkles", visitCharge: 0, estimatedTime: "2-4 hr",
    issueTypes: [{ name: "Deep clean 2BHK", basePrice: 2200, estimatedMinutes: 240 }] },
  { serviceName: "Carpentry", icon: "hammer", visitCharge: 99, estimatedTime: "30-90 min", issueTypes: [{ name: "Door fitting", basePrice: 600, estimatedMinutes: 60 }] },
  { serviceName: "Mechanic", icon: "cog", visitCharge: 149, estimatedTime: "30-60 min", issueTypes: [{ name: "Bike service", basePrice: 600, estimatedMinutes: 60 }] },
];

async function run() {
  await connectDB();
  await Promise.all([
    Admin.deleteMany({}),
    Service.deleteMany({}),
    Technician.deleteMany({}),
    Customer.deleteMany({}),
    Booking.deleteMany({}),
    Feedback.deleteMany({}),
  ]);

  const admin = await Admin.create({ name: "Aditya Roy", email: "admin@serviq.in", password: "Admin@123", role: "superadmin" });
  const services = await Service.insertMany(SERVICES);
  const techs = await Technician.create([
    { name: "Rahul Singh", phone: "+919812345601", password: "Tech@123", services: [services[0]._id], areasCovered: ["560001"], experienceYears: 6, rating: 4.9 },
    { name: "Aisha Khan", phone: "+919812345602", password: "Tech@123", services: [services[1]._id], areasCovered: ["560002"], experienceYears: 5, rating: 4.95 },
    { name: "Manish Kapoor", phone: "+919812345603", password: "Tech@123", services: [services[2]._id], areasCovered: ["560001"], experienceYears: 8, rating: 4.86 },
  ]);

  const cust = await Customer.create({ name: "Priya Sharma", phone: "+919820123456", source: "whatsapp" });
  await Booking.create({
    code: "SQ-10001", customer: cust._id, customerSnapshot: { name: cust.name, phone: cust.phone },
    service: services[0]._id, serviceName: services[0].serviceName, issueType: "Pipe leakage",
    urgency: URGENCY.NORMAL, address: { line1: "12 MG Road", pincode: "560001" },
    visitCharge: 99, estimatedAmount: 99, status: BOOKING_STATUS.NEW, paymentStatus: PAYMENT_STATUS.PENDING,
    timeline: [{ status: BOOKING_STATUS.NEW, by: "seed", note: "Seed booking" }],
  });

  // Create a sample feedback for the seeded booking
  const seededBooking = await Booking.findOne({ code: 'SQ-10001' });
  if (seededBooking) {
    await Feedback.create({
      fk_booking_id: seededBooking._id,
      user_whatsapp_number: cust.phone,
      rating: 5,
      review: 'Sample feedback created by seed script',
    });
  }

  // eslint-disable-next-line no-console
  console.log("[seed] done — admin:", admin.email, "/ password: Admin@123");
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
