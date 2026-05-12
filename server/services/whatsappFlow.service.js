const Session = require("../models/WhatsAppSession");
const Service = require("../models/Service");
const bookingService = require("./booking.service");
const wa = require("./whatsapp.service");
const { URGENCY } = require("../constants");

/**
 * Note: WhatsApp Interactive messages have specific limits:
 * - List Messages: Up to 10 rows.
 * - Reply Buttons: Up to 3 buttons.
 */

async function getOrCreateSession(phone) {
  let s = await Session.findOne({ phone });
  if (!s) s = await Session.create({ phone, step: "IDLE", draft: {} });
  return s;
}

async function handleIncoming(payload, io) {
  const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return;

  const phone = msg.from;
  let text = "";

  // Extract text from standard message OR interactive button/list selection
  if (msg.type === "text") {
    text = (msg.text?.body || "").trim();
  } else if (msg.type === "interactive") {
    const interactive = msg.interactive;
    text = interactive.button_reply?.title || interactive.list_reply?.title || "";
    // We can also use IDs if you set them in the template: interactive.list_reply?.id
  }

  const session = await getOrCreateSession(phone);

  switch (session.step) {
    case "IDLE": {
      session.step = "ASK_SERVICE";
      await session.save();

      const services = await Service.find().sort({ createdAt: 1 }).limit(10);
      const rows = services.map((s, idx) => ({
        id: s.id,
        title: s.serviceName,
        description: `Book a professional ${s.serviceName}`
      }));

      return wa.sendInteractive(phone, {
        type: "list",
        header: "ServiQ Booking",
        body: "Hi 👋 Welcome to ServiQ. Please select the service you need:",
        footer: "Powered by ServiQ",
        button: "View Services",
        sections: [{ title: "Available Services", rows }]
      });
    }

    case "ASK_SERVICE": {
      let service = await Service.findOne({ serviceName: new RegExp(`^${text}$`, "i") });

      // Fallback for manual typing
      if (!service) {
        service = await Service.findOne({ serviceName: new RegExp(text, "i") });
      }

      if (!service) {
        return wa.sendText(phone, "Sorry, please select a service from the list provided.");
      }

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

      return wa.sendInteractive(phone, {
        type: "button",
        body: "How urgent is this request?",
        buttons: [
          { id: "URG_HIGH", title: "HIGH" },
          { id: "URG_NORMAL", title: "NORMAL" },
          { id: "URG_LOW", title: "LOW" }
        ]
      });
    }

    case "ASK_URGENCY": {
      const u = text.toUpperCase();
      if (!Object.values(URGENCY).includes(u)) {
        return wa.sendText(phone, "Please use the buttons to select urgency.");
      }
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

      return wa.sendInteractive(phone, {
        type: "button",
        body: `Confirm booking?\n\n🛠 *Service:* ${session.draft.serviceName}\n📝 *Issue:* ${session.draft.issueType}\n🚨 *Urgency:* ${session.draft.urgency}\n📍 *Address:* ${text}`,
        buttons: [
          { id: "CONFIRM_YES", title: "YES" },
          { id: "CONFIRM_NO", title: "Cancel" }
        ]
      });
    }

    case "CONFIRM": {
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

        session.step = "IDLE";
        session.draft = {};
        await session.save();
        return wa.sendText(phone, `✅ *Booking confirmed!*\n\nReference: ${booking.code}\nWe'll assign a pro shortly.`);
      } catch (err) {
        return wa.sendText(phone, "Sorry, we couldn't create your booking. Please try again.");
      }
    }

    default:
      session.step = "IDLE";
      await session.save();
      return wa.sendText(phone, "Session reset. Type 'hi' to begin.");
  }
}

module.exports = { handleIncoming };
