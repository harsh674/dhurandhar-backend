const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendNewBookingMail = async (booking) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: "yourserviq@gmail.com",
      subject: "🚨 New Booking Received - ServiQ",

      html: `
        <h2>New Booking Received</h2>

        <p><strong>Customer Name:</strong> ${booking.customerName || "N/A"}</p>
        <p><strong>Phone:</strong> ${booking.phone || "N/A"}</p>
        <p><strong>Service:</strong> ${booking.serviceType || "N/A"}</p>
        <p><strong>Address:</strong> ${booking.address || "N/A"}</p>
        <p><strong>Description:</strong> ${booking.issueDescription || "N/A"}</p>

        <hr />

        <p>ServiQ Booking Notification System</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log("✅ Booking email sent");
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
  }
};

module.exports = {
  sendNewBookingMail,
};
