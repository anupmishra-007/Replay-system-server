const express = require("express");
const router = express.Router();
const eventController = require("../controllers/event.controller");

router.get("/", eventController.searchForReplaysByEvent);
router.get("/:eventName", eventController.requestReplayEvent);

module.exports = router;
