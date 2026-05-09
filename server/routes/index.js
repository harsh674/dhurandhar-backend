const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/bookings", require("./booking.routes"));
router.use("/technicians", require("./technician.routes"));
router.use("/services", require("./service.routes"));
router.use("/customers", require("./customer.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/whatsapp", require("./whatsapp.routes"));

router.get("/health", (_req, res) => res.json({ success: true, status: "ok", time: new Date().toISOString() }));

module.exports = router;
