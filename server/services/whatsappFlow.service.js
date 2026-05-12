const Session = require("../models/WhatsAppSession");
const Service = require("../models/Service");
const bookingService = require("./booking.service");
const wa = require("./whatsapp.service");
const { URGENCY } = require("../constants");

async function getOrCreateSession(phone) {
  let s = await Session.findOne({ phone });

  if (!s) {
    s = await Session.create({
      phone,
      step: "IDLE",
      draft: {},
    });
  }

  return s;
}

function extractMessage(msg) {
  if (msg?.interactive?.list_reply) {
    return msg.interactive.list_reply.id;
  }

  if (msg?.interactive?.button_reply) {
    return msg.interactive.button_reply.id;
  }

  return (msg?.text?.body || "").trim();
}

async function sendServiceList(phone) {
  const services = await Service.find().sort({ createdAt: 1 });

  const rows = services.map((s) => ({
    id: s._id.toString(),
    title: s.serviceName,
    description: `Book ${s.serviceName} service`,
  }));

  return wa.sendList(phone, {
    body: "👋 Welcome to ServiQ\nSelect the service you need",
    buttonText: "View Services",
    sections: [
      {
        title: "Available Services",
        rows,
      },
    ],
  });
}

async function sendUrgencyButtons(phone) {
  return wa.sendButtons(phone, {
    body: "How urgent is your issue?",
 buttons: [
  {
    id: "LOW",
    title: "LOW",
  },
  {
    id: "HIGH",
    title: "HIGH",
  },
  {
    id: "EMERGENCY",
    title: "EMERGENCY",
  },
]
  });
}

async function sendConfirmationButtons(phone, draft) {
  return wa.sendButtons(phone, {
    body:
      `Confirm your booking:\n\n` +
      `Service: ${draft.serviceName}\n` +
      `Issue: ${draft.issueType}\n` +
      `Urgency: ${draft.urgency}\n` +
      `Address: ${draft.address.line1}`,

   buttons: [
  {
    id: "CONFIRM_BOOKING",
    title: "Confirm",
  },
  {
    id: "EDIT_BOOKING",
    title: "Edit",
  },
  {
    id: "CANCEL_BOOKING",
    title: "Cancel",
  },
]
  });
}

async function sendLocationOptions(phone) {
  return wa.sendButtons(phone, {
    body:
      "📍 Choose how you'd like to share your location",

  buttons: [
  {
    id: "SHARE_LOCATION",
    title: "Location",
  },
  {
    id: "MANUAL_ADDRESS",
    title: "Manual",
  },
  {
    id: "BACK_TO_URGENCY",
    title: "⬅ Back",
  },
]
  });
}

async function handleIncoming(payload, io) {
  const msg =
    payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!msg) return;

  const phone = msg.from;

  const incomingValue = extractMessage(msg);

  const session = await getOrCreateSession(phone);

 const normalized =
  (incomingValue || "").toLowerCase().trim();

if (
  ["hi", "hello", "start", "menu", "restart"].includes(
    normalized
  )
) {
  session.step = "ASK_SERVICE";

  session.draft = {};

  await session.save();

  return sendServiceList(phone);
}

  switch (session.step) {
    case "IDLE": {
      session.step = "ASK_SERVICE";

      await session.save();

      return sendServiceList(phone);
    }

   case "ASK_SERVICE": {
  console.log("[wa-flow] ASK_SERVICE recv", {
    phone,
    incomingValue,
  });

  let service = null;

  // Only search by ObjectId if valid
  if (
    incomingValue &&
    /^[0-9a-fA-F]{24}$/.test(incomingValue)
  ) {
    service = await Service.findById(incomingValue);
  }

  // Fallback text matching
  if (!service) {
    service = await Service.findOne({
      serviceName: new RegExp(incomingValue, "i"),
    });
  }

  // Still not found
  if (!service) {
    return sendServiceList(phone);
  }

  session.draft.serviceId = service._id;
  session.draft.serviceName = service.serviceName;

  session.step = "ASK_ISSUE";

  await session.save();

return wa.sendText(
  phone,
  `Got it 👍\nDescribe your issue with ${service.serviceName}.\n\nType 'back' to change service.`
);

}

case "ASK_ISSUE": {

  if (
    incomingValue.toLowerCase() === "back"
  ) {

    session.step = "ASK_SERVICE";

    await session.save();

    return sendServiceList(phone);
  }

  session.draft.issueType = incomingValue;

  session.step = "ASK_URGENCY";

  await session.save();

  return sendUrgencyButtons(phone);
}

    case "ASK_URGENCY": {
      const urgency = incomingValue.toUpperCase();

      if (!Object.values(URGENCY).includes(urgency)) {
        return sendUrgencyButtons(phone);
      }

      session.draft.urgency = urgency;

      session.step = "ASK_LOCATION";

      await session.save();

      return sendLocationOptions(phone);
    }

   case "ASK_LOCATION": {

  // User clicked current location button
if (incomingValue === "SHARE_LOCATION") {

  return wa.sendLocationRequest(
    phone,
    "📍 Please share your current location for faster technician assignment."
  );
}

  // User shared actual WhatsApp location
  if (msg.location) {

    session.draft.address = {
      line1: "Shared via WhatsApp location",
      latitude: msg.location.latitude,
      longitude: msg.location.longitude,
      name: msg.location.name || "",
      address: msg.location.address || "",
    };

    session.step = "CONFIRM";

    await session.save();

    return sendConfirmationButtons(
      phone,
      session.draft
    );
  }
     if (incomingValue === "BACK_TO_URGENCY") {

  session.step = "ASK_URGENCY";

  await session.save();

  return sendUrgencyButtons(phone);
}

  // User selected manual address option
 if (incomingValue === "MANUAL_ADDRESS") {

  session.step = "ASK_MANUAL_ADDRESS";

  await session.save();

  return wa.sendText(
    phone,
    "✍️ Enter your full address with pincode.\n\nExample:\n221B Baker Street 400001\n\nType 'back' to return."
  );
}

 // Fallback
  return sendLocationOptions(phone);
     }
      
     case "ASK_MANUAL_ADDRESS": {

  if (
    incomingValue.toLowerCase() === "back"
  ) {

    session.step = "ASK_LOCATION";

    await session.save();

    return sendLocationOptions(phone);
  }

  const pin =
    (incomingValue.match(/\b\d{4,8}\b/) || [])[0];

  if (!pin) {
    return wa.sendText(
      phone,
      "Please include a valid pincode."
    );
  }

  session.draft.address = {
    line1: incomingValue,
    pincode: pin,
  };

  session.step = "CONFIRM";

  await session.save();

  return sendConfirmationButtons(
    phone,
    session.draft
  );
}

    case "CONFIRM": {
      console.log("[wa-flow] CONFIRM recv", {
        phone,
        incomingValue,
      });
      if (incomingValue === "EDIT_BOOKING") {

  session.step = "ASK_SERVICE";

  session.draft = {};

  await session.save();

  return sendServiceList(phone);
}

      if (incomingValue === "CANCEL_BOOKING") {
        session.step = "IDLE";
        session.draft = {};

        await session.save();

        return wa.sendText(
          phone,
          "❌ Booking cancelled.\nSend Hi to start again."
        );
      }

      if (incomingValue !== "CONFIRM_BOOKING") {
        return sendConfirmationButtons(
          phone,
          session.draft
        );
      }

      try {
        const booking =
          await bookingService.createBooking(
            {
              customer: { phone },

              serviceId:
                session.draft.serviceId,

              issueType:
                session.draft.issueType,

              urgency:
                session.draft.urgency,

              address:
                session.draft.address,

              source: "whatsapp",
            },
            io
          );

        console.log("[wa-flow] booking created", {
          bookingId: booking.id,
          code: booking.code,
        });

        session.step = "IDLE";
        session.draft = {};

        await session.save();

        return wa.sendText(
          phone,
          `✅ Booking confirmed!\nReference ID: ${booking.code}\nWe'll assign a professional shortly.`
        );
      } catch (err) {
        console.error(
          "[wa-flow] booking creation failed",
          err
        );

        return wa.sendText(
          phone,
          "Sorry, booking failed right now. Please try again later."
        );
      }
    }

    default: {
      session.step = "IDLE";

      await session.save();

      return sendServiceList(phone);
    }
  }
}

module.exports = { handleIncoming };
