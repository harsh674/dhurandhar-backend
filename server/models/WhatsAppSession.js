const mongoose = require("mongoose");

const waSessionSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    step: {
      type: String,

      enum: [
        "IDLE",
        "START",
        "ASK_SERVICE",
        "ASK_ISSUE",
        "ASK_NAME",
        "ASK_URGENCY",
        "ASK_LOCATION",
        "ASK_MANUAL_ADDRESS",
        "ASK_MEDIA",
        "ASK_SCRAP_TYPE",
        "ASK_SCRAP_WEIGHT",
        "CONFIRM",
        "VIEW_ACTIVE_BOOKINGS",
        "AWAIT_CANCEL_CONFIRM",
        "AWAIT_FEEDBACK_RATING",
        "AWAIT_FEEDBACK_REVIEW",
      ],

      default: "IDLE",
    },

    draft: {
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },

      serviceName: String,

      issueType: String,
      // Scrap Pickup
      scrapType: String,
      estimatedWeight: Number,
      scrapPhoto: String,

      customerName: String,

      urgency: String,

      address: {
        line1: String,
        pincode: String,

        latitude: Number,
        longitude: Number,

        name: String,
        address: String,
      },

      media: [
        {
          url: String,
          type: String,
        },
      ],

      bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    },
  },

  {
    timestamps: true,
  },
);

module.exports = mongoose.model("WhatsAppSession", waSessionSchema);
