const path = require("path");
const fileUtil = require("../utils/file");

exports.searchForReplaysByEvent = async (req, res, next) => {
  try {
    const group = req.query.group || "";
    const sessions = await fileUtil.listSessions();
    const replays = [];

    for (const sessionName of sessions) {
      const manifestPath = path.join(
        fileUtil.getSessionPath(sessionName),
        "manifest.json",
      );
      const manifest = await fileUtil.readJson(manifestPath);
      if (!manifest) continue;

      const eventsIndexPath = path.join(
        fileUtil.getSessionPath(sessionName),
        "events.json",
      );
      const eventsIndex = (await fileUtil.readJson(eventsIndexPath)) || [];

      const hasGroup = eventsIndex.some((e) => e.group === group);
      if (!hasGroup) continue;

      replays.push({
        app: manifest.app || "",
        sessionName: manifest.sessionName || sessionName,
        friendlyName: manifest.friendlyName || sessionName,
        timestamp: manifest.createdAt,
        sizeInBytes: manifest.totalUploadedBytes || 0,
        demoTimeInMs: manifest.totalDemoTimeMs || 0,
        numViewers: Array.isArray(manifest.viewers)
          ? manifest.viewers.length
          : 0,
        bIsLive: !!manifest.isLive,
        changelist: manifest.changelist || 0,
        shouldKeep: false,
      });
    }

    return res.status(200).json({ replays });
  } catch (error) {
    next(error);
  }
};

exports.requestReplayEvent = async (req, res, next) => {
  try {
    const { eventName } = req.params;
    console.log("[requestReplayEvent] Requested:", eventName);

    const underscoreIndex = eventName.indexOf("_");
    if (underscoreIndex <= 0) {
      console.log("[requestReplayEvent] Invalid event name");
      return res.status(404).end();
    }

    const sessionName = eventName.slice(0, underscoreIndex);
    const eventsDir = fileUtil.getEventsPath(sessionName);

    const directBinPath = path.join(eventsDir, `${eventName}.bin`);
    const directJsonPath = path.join(eventsDir, `${eventName}.json`);

    console.log("[requestReplayEvent] Trying direct path:", directBinPath);

    if (await fileUtil.fileExists(directBinPath)) {
      const data = await fileUtil.readBinary(directBinPath);
      console.log(
        "[requestReplayEvent] Found direct binary:",
        directBinPath,
        "size:",
        data.length,
      );

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", data.length);
      return res.status(200).send(data);
    }

    console.log(
      "[requestReplayEvent] Direct binary not found, checking events index",
    );

    const eventsIndexPath = path.join(
      fileUtil.getSessionPath(sessionName),
      "events.json",
    );
    const eventsIndex = (await fileUtil.readJson(eventsIndexPath)) || [];
    const eventMeta = eventsIndex.find((e) => e.id === eventName);

    if (!eventMeta) {
      console.log("[requestReplayEvent] Event not found in index:", eventName);
      return res.status(404).end();
    }

    const fallbackBinPath = path.join(eventsDir, `${eventMeta.id}.bin`);
    if (!(await fileUtil.fileExists(fallbackBinPath))) {
      console.log(
        "[requestReplayEvent] Event found in index but binary missing:",
        fallbackBinPath,
      );
      return res.status(404).end();
    }

    const data = await fileUtil.readBinary(fallbackBinPath);
    console.log(
      "[requestReplayEvent] Found via index:",
      fallbackBinPath,
      "size:",
      data.length,
    );

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", data.length);
    return res.status(200).send(data);
  } catch (error) {
    console.error("[requestReplayEvent] Error:", error);
    next(error);
  }
};
