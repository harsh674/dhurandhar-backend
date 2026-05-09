const router = require("express").Router();
const c = require("../controllers/customer.controller");
const { authenticate, requireRole } = require("../middleware/auth");

router.use(authenticate, requireRole("admin"));
router.get("/", c.list);
router.get("/:id", c.get);

module.exports = router;
