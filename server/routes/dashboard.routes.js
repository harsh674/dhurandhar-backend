const router = require("express").Router();
const c = require("../controllers/dashboard.controller");
const { authenticate, requireRole } = require("../middleware/auth");

router.use(authenticate, requireRole("admin"));
router.get("/stats", c.stats);
router.get("/revenue", c.revenue);
router.get("/bookings-trend", c.bookingsTrend);
router.get("/technician-stats", c.technicianStats);
router.get("/pending", c.pending);

module.exports = router;
