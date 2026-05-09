const router = require("express").Router();
const c = require("../controllers/technician.controller");
const { authenticate, requireRole } = require("../middleware/auth");

router.use(authenticate);
router.post("/", requireRole("admin"), c.create);
router.get("/", c.list);
router.get("/:id", c.get);
router.patch("/:id", c.update);
router.patch("/:id/availability", c.setAvailability);
router.get("/:id/earnings", c.earnings);
router.get("/:id/jobs", c.completedJobs);

module.exports = router;
