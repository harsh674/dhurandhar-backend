const router = require("express").Router();
const c = require("../controllers/booking.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");
const s = require("../validations/schemas");

// Public create (used by WhatsApp gateway / web form). For admin-only, swap to authenticate+requireRole.
router.post("/", validate(s.createBooking), c.create);

router.get("/", authenticate, requireRole("admin"), c.list);
router.get("/:id", authenticate, c.get);
router.patch("/:id/assign", authenticate, requireRole("admin"), validate(s.assignTechnician), c.assign);
router.patch("/:id/status", authenticate, validate(s.updateStatus), c.updateStatus);
router.patch("/:id/cancel", authenticate, c.cancel);
router.post("/:id/media", authenticate, upload.array("files", 6), c.uploadMedia);

module.exports = router;
