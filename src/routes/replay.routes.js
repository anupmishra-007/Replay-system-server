const express = require("express");
const router = express.Router();
const replayController = require("../controllers/replay.controller");

const rawBody = express.raw({
  type: "application/octet-stream",
  limit: "500mb",
});

router.post("/", express.json(), replayController.startSessionAuto);
router.post("/:session", express.json(), replayController.startSession);

router.post(
  "/:session/stopUploading",
  express.json(),
  replayController.stopUploading,
);
router.post("/:session/users", express.json(), replayController.postUsers);

router.post("/:session/file/:filename", rawBody, replayController.postFile);

router.post("/:session/event", rawBody, replayController.postAddEvent);
router.post(
  "/:session/event/:session2_:eventName",
  rawBody,
  replayController.postUpdateEvent,
);

router.post(
  "/:sessionName/startDownloading",
  express.json(),
  replayController.startDownloading,
);
router.post(
  "/:sessionName/viewer/:viewerName",
  express.json(),
  replayController.viewerHeartbeat,
);

router.get("/:sessionName/file/replay.header", replayController.getHeaderFile);
router.get(
  "/:sessionName/file/stream.:chunkIndex",
  replayController.getStreamChunkFile,
);

router.get("/:sessionName/event", replayController.getGroup);
router.get("/", replayController.searchReplays);

module.exports = router;
