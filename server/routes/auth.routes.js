const router = require("express").Router();
const c = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const s = require("../validations/schemas");

router.post("/admin/login", authLimiter, validate(s.adminLogin), c.adminLogin);
router.post("/technician/login", authLimiter, validate(s.technicianLogin), c.technicianLogin);
router.post("/technician/register", authLimiter, validate(s.technicianRegister), c.technicianRegister);
router.get("/me", authenticate, c.me);

module.exports = router;
