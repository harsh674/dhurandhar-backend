const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    fk_booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    user_whatsapp_number: { type: String, required: true, index: true },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
