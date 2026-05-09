const router = require("express").Router();
const c = require("../controllers/service.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const s = require("../validations/schemas");

router.get("/", c.list); // public catalog
router.post("/", authenticate, requireRole("admin"), validate(s.createService), c.create);
router.patch("/:id", authenticate, requireRole("admin"), c.update);
router.delete("/:id", authenticate, requireRole("admin"), c.remove);

module.exports = router;
