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

      subject: `🚨 ${booking.serviceType || "Service"} Booking | ${booking.phone}`,

      html: `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
        
        <div style="max-width:650px;margin:30px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
          
          <div style="background:#111827;padding:24px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;">
              🚨 New Booking Alert
            </h1>

            <p style="margin-top:8px;color:#d1d5db;font-size:14px;">
              A new service request has been received on ServiQ
            </p>
          </div>

          <div style="padding:28px;">

            <div style="background:#f9fafb;border-radius:12px;padding:20px;border:1px solid #e5e7eb;">
              
              <table style="width:100%;border-collapse:collapse;">

                <tr>
                  <td style="padding:12px 0;font-weight:bold;color:#374151;width:180px;">
                    Service
                  </td>

                  <td style="padding:12px 0;color:#111827;">
                    ${booking.serviceType || "N/A"}
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 0;font-weight:bold;color:#374151;">
                    Customer
                  </td>

                  <td style="padding:12px 0;color:#111827;">
                    ${booking.customerName || booking.phone || "N/A"}
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 0;font-weight:bold;color:#374151;">
                    Phone
                  </td>

                  <td style="padding:12px 0;">
                    <a 
                      href="tel:${booking.phone}"
                      style="color:#2563eb;text-decoration:none;font-weight:bold;"
                    >
                      ${booking.phone || "N/A"}
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 0;font-weight:bold;color:#374151;">
                    Problem
                  </td>

                  <td style="padding:12px 0;color:#111827;">
                    ${booking.issueDescription || "No issue provided"}
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 0;font-weight:bold;color:#374151;">
                    Location
                  </td>

                  <td style="padding:12px 0;">
                    ${
                      booking.address &&
                      booking.address.includes("https://")
                        ? `
                          <a 
                            href="${booking.address}" 
                            target="_blank"
                            style="
                              background:#2563eb;
                              color:white;
                              padding:10px 16px;
                              border-radius:8px;
                              text-decoration:none;
                              display:inline-block;
                              font-weight:bold;
                            "
                          >
                            📍 Open Google Maps
                          </a>
                        `
                        : booking.address || "N/A"
                    }
                  </td>
                </tr>

              </table>
            </div>

            <div style="margin-top:24px;background:#eff6ff;border:1px solid #bfdbfe;padding:18px;border-radius:12px;">
              
              <h3 style="margin-top:0;color:#1d4ed8;">
                ⚡ Recommended Action
              </h3>

              <p style="margin-bottom:0;color:#374151;line-height:1.6;">
                Assign a technician quickly to improve response time and customer satisfaction.
              </p>

            </div>

            <div style="margin-top:30px;text-align:center;color:#9ca3af;font-size:13px;">
              
              <p style="margin-bottom:4px;">
                ServiQ Booking Notification System
              </p>

              <p style="margin:0;">
                Automated Operational Alert
              </p>

            </div>

          </div>
        </div>
      </div>
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
