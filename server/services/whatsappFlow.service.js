const Session = require("../models/WhatsAppSession");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Feedback = require("../models/Feedback");
const bookingService = require("./booking.service");
const wa = require("./whatsapp.service");
const { URGENCY } = require("../constants");
const SESSION_TIMEOUT = 30 * 60 * 1000;

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

async function sendWelcomeMenu(phone) {
  return wa.sendButtons(phone, {
    body: "👋 Welcome to ServiQ\nHow can we help you today?",
    buttons: [
      { id: "VIEW_SERVICES", title: "Book a Service" },
      { id: "CHECK_ACTIVE_BOOKING", title: "My Bookings" },
    ],
  });
}

async function sendServiceList(phone) {
  const services = await Service.find({ isActive: true }).sort({
    createdAt: 1,
  });

  const rows = services.map((s) => ({
    id: s._id.toString(),
    title: s.serviceName,
    description: `Book ${s.serviceName}`,
  }));

  return wa.sendList(phone, {
    body: "Please select the service you need:",
    buttonText: "View Services",
    sections: [
      {
        title: "Available Services",
        rows,
      },
    ],
  });
}

async function sendActiveBookingsList(phone) {
  const activeStatuses = [
    "NEW",
    "ASSIGNED",
    "ACCEPTED",
    "ON_THE_WAY",
    "STARTED",
  ];

  const items = await Booking.find({
    "customerSnapshot.phone": phone,
    status: { $in: activeStatuses },
  })
    .sort({ createdAt: -1 })
    .limit(20);

  if (!items || items.length === 0) {
    return wa.sendText(phone, "You have no active bookings right now.");
  }

  const rows = items.map((b) => ({
    id: b._id.toString(),
    title: b.code,
    description: `${b.serviceName} — ${b.status}`,
  }));

  return wa.sendList(phone, {
    body: "Here are your active bookings. Select one to manage.",
    buttonText: "View Bookings",
    sections: [
      {
        title: "Active Bookings",
        rows,
      },
    ],
  });
}

async function sendBookingActions(phone, booking) {
  // Logic: Show Feedback option only if booking is COMPLETED
  const buttons = [{ id: "BACK_TO_BOOKINGS", title: "⬅ Back" }];

  if (booking.status === "COMPLETED") {
    buttons.unshift({ id: "INIT_FEEDBACK", title: "Give Feedback" });
  } else {
    buttons.unshift({ id: "CONFIRM_CANCEL_BOOKING", title: "Cancel Booking" });
  }

  return wa.sendButtons(phone, {
    body: `Booking: ${booking.code}\nService: ${booking.serviceName}\nStatus: ${booking.status}\nAddress: ${booking.address?.line1 || "-"}`,
    buttons: buttons,
  });
}

async function sendRatingButtons(phone) {
  return wa.sendButtons(phone, {
    body: "How was your experience with our service?",
    buttons: [
      { id: "RATING_5", title: "Very Satisfied" },
      { id: "RATING_3", title: "Satisfied" },
      { id: "RATING_1", title: "Unsatisfied" },
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
    ],
  });
}

async function sendConfirmationButtons(phone, draft) {
  return wa.sendButtons(phone, {
 body:
  `📋 *Booking Summary*\n\n` +

  `👤 *Customer* : ${draft.customerName}\n` +

  `🛠 *Service* : ${draft.serviceName}\n` +

  `📌 *Issue* : ${draft.issueType}\n` +

  `🚨 *Urgency* : ${draft.urgency}\n` +

  `📍 *Location* : ${
    draft.address.line1 === "WHATS_APP_LOCATION"
      ? "Live Location Shared"
      : draft.address.line1
  }\n\n` +

  `Please confirm your booking below 👇`,

    buttons: [
  {
    id: "CONFIRM_BOOKING",
    title: "✅ Confirm",
  },
  {
    id: "EDIT_BOOKING",
    title: "✏️ Edit",
  },
  {
    id: "CANCEL_BOOKING",
    title: "❌ Cancel",
  },
],
  });
}

async function sendLocationOptions(phone) {
  return wa.sendButtons(phone, {
    body: "📍 Choose how you'd like to share your location",

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
    ],
  });
}

async function handleIncoming(payload, io) {
  const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!msg) return;

  const phone = msg.from;

  const incomingValue = extractMessage(msg);

  const session = await getOrCreateSession(phone);

  // if (
  //   ![
  //   "IDLE",
  //   "VIEW_ACTIVE_BOOKINGS",
  //   "AWAIT_CANCEL_CONFIRM",
  // ].includes(session.step) &&
  //   session.updatedAt &&
  //   Date.now() - new Date(session.updatedAt).getTime() >
  //     SESSION_TIMEOUT
  // ) {
  //   session.step = "ASK_SERVICE";

  //   session.draft = {};

  //   await session.save();

  //   await wa.sendText(
  //     phone,
  //     "⌛ Your previous session expired. Starting a new booking."
  //   );

  //   return sendServiceList(phone);
  // }

  const normalized = (incomingValue || "").toLowerCase().trim();

  if (["hi", "hello", "start", "menu", "restart"].includes(normalized)) {
    session.step = "START";
    session.draft = {};
    await session.save();
    return sendWelcomeMenu(phone);
  }

  switch (session.step) {
    case "IDLE":
    case "START": {
      if (incomingValue === "VIEW_SERVICES") {
        session.step = "ASK_SERVICE";
        await session.save();
        return sendServiceList(phone);
      }
      if (incomingValue === "CHECK_ACTIVE_BOOKING") {
        session.step = "VIEW_ACTIVE_BOOKINGS";
        await session.save();
        // Updated to show COMPLETED bookings too so they can give feedback
        const items = await Booking.find({
          "customerSnapshot.phone": phone,
          status: {
            $in: [
              "NEW",
              "ASSIGNED",
              "ACCEPTED",
              "ON_THE_WAY",
              "STARTED",
              "COMPLETED",
            ],
          },
        })
          .sort({ createdAt: -1 })
          .limit(10);

        if (!items.length)
          return wa.sendText(phone, "No recent bookings found.");

        const rows = items.map((b) => ({
          id: b._id.toString(),
          title: b.code,
          description: `${b.serviceName} — ${b.status}`,
        }));

        return wa.sendList(phone, {
          body: "Select a booking:",
          buttonText: "View Bookings",
          sections: [{ title: "Recent Bookings", rows }],
        });
      }
      return sendWelcomeMenu(phone);
    }
    case "VIEW_ACTIVE_BOOKINGS": {
      if (incomingValue && /^[0-9a-fA-F]{24}$/.test(incomingValue)) {
        const booking = await Booking.findById(incomingValue);
        if (!booking) return sendWelcomeMenu(phone);

        session.draft.bookingId = booking._id;
        session.step = "AWAIT_CANCEL_CONFIRM"; // This step handles the Detail View
        await session.save();
        return sendBookingActions(phone, booking);
      }
      return sendWelcomeMenu(phone);
    }

    case "AWAIT_CANCEL_CONFIRM": {
      if (incomingValue === "BACK_TO_BOOKINGS") {
        session.step = "START"; // Return to main to refresh list
        await session.save();
        return sendWelcomeMenu(phone);
      }

      // FEEDBACK INITIATION
      if (incomingValue === "INIT_FEEDBACK") {
        session.step = "AWAIT_FEEDBACK_RATING";
        await session.save();
        return sendRatingButtons(phone);
      }

      if (incomingValue === "CONFIRM_CANCEL_BOOKING") {
        try {
          await bookingService.cancel(
            session.draft.bookingId,
            "Cancelled by user",
            "customer",
          );
          session.step = "START";
          await session.save();
          return wa.sendText(phone, "✅ Booking cancelled.");
        } catch (e) {
          return wa.sendText(phone, "Error cancelling.");
        }
      }
      return sendWelcomeMenu(phone);
    }
    case "AWAIT_FEEDBACK_RATING": {
      const ratings = { RATING_5: 5, RATING_3: 3, RATING_1: 1 };
      const selectedRating = ratings[incomingValue];

      if (!selectedRating) {
        return wa.sendText(
          phone,
          "Please select a rating using the buttons above.",
        );
      }

      // Force an atomic update to the database to prevent race conditions
      await Session.updateOne(
        { _id: session._id },
        {
          $set: {
            "draft.rating": selectedRating,
            step: "AWAIT_FEEDBACK_REVIEW",
          },
        },
      );

      return wa.sendButtons(phone, {
        body: "Got your rating! Please type a short review, or click skip.",
        buttons: [{ id: "SKIP_REVIEW", title: "Skip" }],
      });
    }

    case "AWAIT_FEEDBACK_REVIEW": {
      const review = incomingValue === "SKIP_REVIEW" ? "" : incomingValue;

      // Reload session from DB to get the latest atomic update (rating saved earlier)
      const refreshed = await Session.findById(session._id).lean();
      const savedRating = refreshed?.draft?.rating;

      console.log("Saving Feedback - Rating:", savedRating);

      await Feedback.create({
        fk_booking_id: refreshed?.draft?.bookingId || session.draft.bookingId,
        user_whatsapp_number: phone,
        rating: Number(savedRating),
        review: review,
      });

      // Clear session after successful save
      session.step = "START";
      session.draft = {};
      await session.save();

      return wa.sendText(phone, "🙏 Thank you for your feedback!");
    }
    case "ASK_SERVICE": {
      console.log("[wa-flow] ASK_SERVICE recv", {
        phone,
        incomingValue,
      });

      // User requested to check active bookings
      if (incomingValue === "CHECK_ACTIVE_BOOKING") {
        session.step = "VIEW_ACTIVE_BOOKINGS";
        session.draft = {};

        await session.save();

        return sendActiveBookingsList(phone);
      }

      let service = null;

      // Only search by ObjectId if valid
      if (incomingValue && /^[0-9a-fA-F]{24}$/.test(incomingValue)) {
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
        `Got it 👍\nDescribe your issue with ${service.serviceName}.\n\nType 'back' to change service.`,
      );
    }

    case "VIEW_ACTIVE_BOOKINGS": {
      // User selected a booking from the list (id will be the booking _id)
      if (incomingValue === "BACK_TO_BOOKINGS") {
        return sendActiveBookingsList(phone);
      }

      if (incomingValue && /^[0-9a-fA-F]{24}$/.test(incomingValue)) {
        const booking = await Booking.findById(incomingValue);
        if (!booking || booking.customerSnapshot?.phone !== phone) {
          return sendActiveBookingsList(phone);
        }

        session.draft.bookingId = booking._id;
        session.step = "AWAIT_CANCEL_CONFIRM";

        await session.save();

        return sendBookingActions(phone, booking);
      }

      return sendActiveBookingsList(phone);
    }

    case "AWAIT_CANCEL_CONFIRM": {
      if (incomingValue === "BACK_TO_BOOKINGS") {
        session.step = "VIEW_ACTIVE_BOOKINGS";
        await session.save();
        return sendActiveBookingsList(phone);
      }

      if (incomingValue === "CONFIRM_CANCEL_BOOKING") {
        const bid = session.draft.bookingId;
        try {
          await bookingService.cancel(
            bid,
            "Cancelled by customer via WhatsApp",
            "customer",
          );

          session.step = "IDLE";
          session.draft = {};

          await session.save();

          return wa.sendText(phone, "✅ Booking cancelled successfully.");
        } catch (err) {
          console.error("[wa-flow] cancel booking failed", err);
          return wa.sendText(
            phone,
            "Sorry, could not cancel booking right now.",
          );
        }
      }

      // Fallback: re-show actions
      const bookingId = session.draft.bookingId;
      if (bookingId) {
        const booking = await Booking.findById(bookingId);
        if (booking) return sendBookingActions(phone, booking);
      }

      session.step = "VIEW_ACTIVE_BOOKINGS";
      session.draft = {};
      await session.save();
      return sendActiveBookingsList(phone);
    }

   case "ASK_ISSUE": {

  if (incomingValue.toLowerCase() === "back") {
    session.step = "ASK_SERVICE";

    await session.save();

    return sendServiceList(phone);
  }

  session.draft.issueType = incomingValue;

  session.step = "ASK_NAME";

  await session.save();

  return wa.sendText(
    phone,
    "👤 Please enter your full name."
  );
}

case "ASK_NAME": {

  if (incomingValue.toLowerCase() === "back") {
    session.step = "ASK_ISSUE";

    await session.save();

    return wa.sendText(
      phone,
      "Please describe your issue."
    );
  }

if (
  !/^[a-zA-Z\s]+$/.test(incomingValue) ||
  incomingValue.trim().length < 3
) {
  return wa.sendText(
    phone,
    "Please enter a valid full name."
  );
}
  
session.draft.customerName = incomingValue;

session.markModified("draft");

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
          "📍 Please share your current location for faster technician assignment.",
        );
      }
      console.log("[wa-flow] ASK_LOCATION recv", {
        phone,
        incomingValue,
        msg
      });


      // User shared actual WhatsApp location
      if (msg.location) {
        session.draft.address = {
          line1: "WHATS_APP_LOCATION",
          latitude: msg.location.latitude,
          longitude: msg.location.longitude,
          name: msg.location.name || "",
          address: msg.location.address || "",
        };

        session.step = "CONFIRM";

        await session.save();

        return sendConfirmationButtons(phone, session.draft);
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
          "✍️ Enter your full address with pincode.\n\nExample:\n221B Baker Street 400001\n\nType 'back' to return.",
        );
      }

      // Fallback
      return sendLocationOptions(phone);
    }

    case "ASK_MANUAL_ADDRESS": {
      if (incomingValue.toLowerCase() === "back") {
        session.step = "ASK_LOCATION";

        await session.save();

        return sendLocationOptions(phone);
      }

      const pin = (incomingValue.match(/\b\d{4,8}\b/) || [])[0];

      if (!pin) {
        return wa.sendText(phone, "Please include a valid pincode.");
      }

      session.draft.address = {
        line1: incomingValue,
        pincode: pin,
      };

      session.step = "CONFIRM";

      await session.save();

      return sendConfirmationButtons(phone, session.draft);
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
          "❌ Booking cancelled.\nSend Hi to start again.",
        );
      }

      if (incomingValue !== "CONFIRM_BOOKING") {
        return sendConfirmationButtons(phone, session.draft);
      }

      try {
        console.log("FINAL SESSION DRAFT:", session.draft);

console.log("CUSTOMER NAME:", session.draft.customerName);
        const booking = await bookingService.createBooking(
          {
            customer: {
  phone,
  name: session.draft.customerName,
},

            serviceId: session.draft.serviceId,

            issueType: session.draft.issueType,

            urgency: session.draft.urgency,

            address: session.draft.address,

            source: "whatsapp",
          },
          io,
        );

        console.log("[wa-flow] booking created", {
          bookingId: booking.id,
          code: booking.code,
        });

       const bookingSummary = {
  customerName: session.draft.customerName,
  serviceName: session.draft.serviceName,
  issueType: session.draft.issueType,
  urgency: session.draft.urgency,
};

session.step = "IDLE";
session.draft = {};

await session.save();

return wa.sendText(
  phone,
  `✅ *Booking Confirmed Successfully!*

👤 *Customer:* ${bookingSummary.customerName}

🛠 *Service:* ${bookingSummary.serviceName}

📋 *Issue:* ${bookingSummary.issueType}

🚨 *Urgency:* ${bookingSummary.urgency}

🆔 *Booking ID:* ${booking.code}

📍 Our team is now finding the best technician for your request.

⏳ *Expected assignment time:* 10-20 minutes.

Thank you for choosing *ServiQ* 🙌`
);
      } catch (err) {
        console.error("[wa-flow] booking creation failed", err);

        return wa.sendText(
          phone,
          "Sorry, booking failed right now. Please try again later.",
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
