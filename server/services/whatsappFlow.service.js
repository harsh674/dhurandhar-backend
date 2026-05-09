// Minimal WhatsApp booking flow — state machine over WhatsAppSession.
// Stubbed for now: handleIncoming() walks the steps but only logs sends until
// WHATSAPP_TOKEN is set. Wire to real webhook in routes/whatsapp.routes.js.
const Session = require("../models/WhatsAppSession");
const Service = require("../models/Service");
const bookingService = require("./booking.service");
const wa = require("./whatsapp.service");
const { URGENCY } = require("../constants");

const SERVICE_PROMPT = "Hi 👋 Welcome to ServiQ. Reply with the service you need:\n1. Plumber\n2. Electrician\n3. AC Repair\n4. Cleaning\n5. Carpenter\n6. Mechanic";
const URGENCY_PROMPT = "How urgent? Reply: LOW / NORMAL / HIGH / EMERGENCY";

async function getOrCreateSession(phone) {
  let s = await Session.findOne({ phone });
  if (!s) s = await Session.create({ phone, step: "IDLE", draft: {} });
  return s;
}

async function handleIncoming(payload, io) {
  // payload is the WhatsApp Cloud API "messages" entry.
  const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;
  const phone = msg.from;
  const text = (msg.text?.body || "").trim();
  const session = await getOrCreateSession(phone);

  switch (session.step) {
    case "IDLE": {
      session.step = "ASK_SERVICE";
      await session.save();
      return wa.sendText(phone, SERVICE_PROMPT);
    }
    case "ASK_SERVICE": {
      const service = await Service.findOne({ serviceName: new RegExp(text, "i") });
      if (!service) return wa.sendText(phone, "Sorry, I didn't catch that.\n" + SERVICE_PROMPT);
      session.draft.serviceId = service.id;
      session.draft.serviceName = service.serviceName;
      session.step = "ASK_ISSUE";
      await session.save();
      return wa.sendText(phone, `Got it — ${service.serviceName}. Briefly describe the issue:`);
    }
    case "ASK_ISSUE": {
      session.draft.issueType = text;
      session.step = "ASK_URGENCY";
      await session.save();
      return wa.sendText(phone, URGENCY_PROMPT);
    }
    case "ASK_URGENCY": {
      const u = text.toUpperCase();
      if (!Object.values(URGENCY).includes(u)) return wa.sendText(phone, URGENCY_PROMPT);
      session.draft.urgency = u;
      session.step = "ASK_LOCATION";
      await session.save();
      return wa.sendText(phone, "Share your address with pincode (e.g., '12 MG Road, 560001').");
    }
    case "ASK_LOCATION": {
      const pin = (text.match(/\b\d{4,8}\b/) || [])[0];
      if (!pin) return wa.sendText(phone, "Please include a pincode in the address.");
      session.draft.address = { line1: text, pincode: pin };
      session.step = "CONFIRM";
      await session.save();
      return wa.sendText(
        phone,
        `Confirm booking?\nService: ${session.draft.serviceName}\nIssue: ${session.draft.issueType}\nUrgency: ${session.draft.urgency}\nAddress: ${text}\n\nReply YES to confirm.`
      );
    }
    case "CONFIRM": {
      if (!/^yes$/i.test(text)) {
        session.step = "IDLE";
        session.draft = {};
        await session.save();
        return wa.sendText(phone, "Booking cancelled. Send 'hi' to start again.");
      }
      const booking = await bookingService.createBooking(
        {
          customer: { phone },
          serviceId: session.draft.serviceId,
          issueType: session.draft.issueType,
          urgency: session.draft.urgency,
          address: session.draft.address,
          source: "whatsapp",
        },
        io
      );
      session.step = "IDLE";
      session.draft = {};
      await session.save();
      return wa.sendText(phone, `✅ Booking confirmed! Your reference: ${booking.code}. We'll assign a pro shortly.`);
    }
    default:
      session.step = "IDLE";
      await session.save();
      return wa.sendText(phone, SERVICE_PROMPT);
  }
}

module.exports = { handleIncoming };
