const router = require("express").Router();
const c = require("../controllers/whatsapp.controller");
const { authenticate, requireRole } = require("../middleware/auth");

router.get("/webhook", c.verify);
router.post("/webhook", c.incoming);
router.post("/send", authenticate, requireRole("admin"), c.send);

module.exports = router;
