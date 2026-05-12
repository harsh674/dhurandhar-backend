// Minimal WhatsApp booking flow — state machine over WhatsAppSession.
// Stubbed for now: handleIncoming() walks the steps but only logs sends until
// WHATSAPP_TOKEN is set. Wire to real webhook in routes/whatsapp.routes.js.
const Session = require("../models/WhatsAppSession");
const Service = require("../models/Service");
const bookingService = require("./booking.service");
const wa = require("./whatsapp.service");
const { URGENCY } = require("../constants");

const SERVICE_PROMPT = "Hi 👋 Welcome to ServiQ. Reply with the service you need:\n1. Plumber\n2. Electrician\n3. AC Repair\n4. Cleaning\n5. Carpenter\n6. Mechanic";
const URGENCY_PROMPT = "How urgent? Reply: LOW / NORMAL / HIGH / EMERGENCY  ";

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
      console.log('[wa-flow] ASK_SERVICE recv', { phone, text });
      let service = null;

      // If user replies with a number (menu selection), map to available services
      if (/^\d+$/.test(text)) {
        const idx = parseInt(text, 10);
        const services = await Service.find().sort({ createdAt: 1 });
        if (idx >= 1 && idx <= services.length) service = services[idx - 1];
      }

      // Direct name match (case-insensitive / regex)
      if (!service) {
        service = await Service.findOne({ serviceName: new RegExp(text, "i") });
      }

      // Fuzzy fallback: substring matches or partial comparisons
      if (!service) {
        const services = await Service.find();
        const t = text.toLowerCase();
        service = services.find((s) => {
          const name = s.serviceName.toLowerCase();
          return name.includes(t) || t.includes(name.slice(0, 4));
        });
      }

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
      console.log('[wa-flow] CONFIRM recv', { phone, text, draft: session.draft });
      if (!/^yes$/i.test(text)) {
        session.step = "IDLE";
        session.draft = {};
        await session.save();
        return wa.sendText(phone, "Booking cancelled. Send 'hi' to start again.");
      }

      try {
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

        console.log('[wa-flow] booking created', { bookingId: booking.id, code: booking.code });

        session.step = "IDLE";
        session.draft = {};
        await session.save();
        return wa.sendText(phone, `✅ Booking confirmed! Your reference: ${booking.code}. We'll assign a pro shortly.`);
      } catch (err) {
        console.error('[wa-flow] booking creation failed', { err: err && err.message, draft: session.draft });
        // Keep session as CONFIRM to let user retry or cancel
        return wa.sendText(phone, "Sorry, we couldn't create your booking right now. Please try again later.");
      }
    }
    default:
      session.step = "IDLE";
      await session.save();
      return wa.sendText(phone, SERVICE_PROMPT);
  }
}

module.exports = { handleIncoming };
