const path = require("path");
const crypto = require("crypto");
const fileUtil = require("../utils/file");

const chunkCache = new Map();
const MAX_CACHE_ITEMS = 30;

function getCache(key) {
  if (!chunkCache.has(key)) return null;
  const value = chunkCache.get(key);
  chunkCache.delete(key);
  chunkCache.set(key, value);
  return value;
}

function setCache(key, value) {
  if (chunkCache.has(key)) {
    chunkCache.delete(key);
  }
  chunkCache.set(key, value);

  if (chunkCache.size > MAX_CACHE_ITEMS) {
    const firstKey = chunkCache.keys().next().value;
    chunkCache.delete(firstKey);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function logRoute(name, req) {
  console.log(`\n[${name}]`);
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Params:", req.params);
  console.log("Query:", req.query);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("Content-Length:", req.headers["content-length"]);
}

async function loadManifest(sessionName) {
  const manifestPath = path.join(
    fileUtil.getSessionPath(sessionName),
    "manifest.json",
  );
  return await fileUtil.readJson(manifestPath);
}

async function saveManifest(sessionName, manifest) {
  const manifestPath = path.join(
    fileUtil.getSessionPath(sessionName),
    "manifest.json",
  );
  manifest.updatedAt = nowIso();
  await fileUtil.saveJson(manifestPath, manifest);
}

function buildManifest(sessionName, query = {}) {
  return {
    sessionName,
    app: query.app || "",
    version: query.version || "",
    changelist: query.cl != null ? Number(query.cl) : 0,
    friendlyName: query.friendlyName || sessionName,
    isLive: true,
    isCompleted: false,
    totalChunks: 0,
    totalDemoTimeMs: 0,
    totalUploadedBytes: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    users: [],
    viewers: [],
    events: [],
  };
}

// POST /replay
exports.startSessionAuto = async (req, res, next) => {
  try {
    logRoute("startSessionAuto", req);

    const session = crypto.randomUUID().replace(/-/g, "");
    const manifest = buildManifest(session, req.query);

    await saveManifest(session, manifest);

    return res.status(200).json({
      sessionId: session,
    });
  } catch (error) {
    console.error("[startSessionAuto] Error:", error);
    next(error);
  }
};

// POST /replay/:session
exports.startSession = async (req, res, next) => {
  try {
    logRoute("startSession", req);

    const { session } = req.params;

    let manifest = await loadManifest(session);

    if (!manifest) {
      manifest = buildManifest(session, req.query);
    } else {
      manifest.app = req.query.app || manifest.app || "";
      manifest.version = req.query.version || manifest.version || "";
      manifest.changelist =
        req.query.cl != null ? Number(req.query.cl) : manifest.changelist || 0;
      manifest.friendlyName =
        req.query.friendlyName || manifest.friendlyName || session;
      manifest.isLive = true;
      manifest.isCompleted = false;
    }

    await saveManifest(session, manifest);

    return res.status(200).json({
      sessionId: session,
    });
  } catch (error) {
    console.error("[startSession] Error:", error);
    next(error);
  }
};

// POST /replay/:session/stopUploading
exports.stopUploading = async (req, res, next) => {
  try {
    logRoute("stopUploading", req);

    const { session } = req.params;
    const manifest = await loadManifest(session);

    if (!manifest) {
      return res.status(404).end();
    }

    if (req.query.numChunks != null) {
      manifest.totalChunks = Number(req.query.numChunks);
    }

    if (req.query.time != null) {
      manifest.totalDemoTimeMs = Number(req.query.time);
    }

    if (req.query.absSize != null) {
      manifest.totalUploadedBytes = Number(req.query.absSize);
    }

    manifest.isLive = false;
    manifest.isCompleted = true;

    await saveManifest(session, manifest);

    return res.status(204).end();
  } catch (error) {
    console.error("[stopUploading] Error:", error);
    next(error);
  }
};

// POST /replay/:session/users
exports.postUsers = async (req, res, next) => {
  try {
    logRoute("postUsers", req);
    console.log("[postUsers] Body:", req.body);

    const { session } = req.params;
    const manifest = await loadManifest(session);

    if (!manifest) {
      return res.status(404).end();
    }

    const users = Array.isArray(req.body?.users) ? req.body.users : [];
    manifest.users = users;

    await saveManifest(session, manifest);

    return res.status(204).end();
  } catch (error) {
    console.error("[postUsers] Error:", error);
    next(error);
  }
};

// POST /replay/:session/file/:filename
exports.postFile = async (req, res, next) => {
  try {
    logRoute("postFile", req);

    const { session, filename } = req.params;
    const manifest = await loadManifest(session);

    if (!manifest) {
      return res.status(404).end();
    }

    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || []);
    console.log("[postFile] filename:", filename, "size:", body.length);

    if (filename.toLowerCase() === "replay.header") {
      const headerPath = path.join(
        fileUtil.getSessionPath(session),
        "replay.header",
      );
      await fileUtil.saveBinary(headerPath, body);

      if (req.query.numChunks != null) {
        manifest.totalChunks = Number(req.query.numChunks);
      }

      if (req.query.time != null) {
        manifest.totalDemoTimeMs = Number(req.query.time);
      }
    } else if (filename.toLowerCase().startsWith("stream.")) {
      const chunkIndex = Number(filename.substring("stream.".length));

      if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
        return res.status(400).end();
      }

      const chunkPath = path.join(
        fileUtil.getChunksPath(session),
        `stream.${chunkIndex}`,
      );
      await fileUtil.saveBinary(chunkPath, body);

      const metaPath = path.join(
        fileUtil.getChunksPath(session),
        `stream.${chunkIndex}.json`,
      );

      await fileUtil.saveJson(metaPath, {
        chunkIndex,
        startTimeMs: req.query.mTime1 != null ? Number(req.query.mTime1) : null,
        endTimeMs: req.query.mTime2 != null ? Number(req.query.mTime2) : null,
        size: body.length,
        createdAt: nowIso(),
      });

      if (req.query.numChunks != null) {
        manifest.totalChunks = Number(req.query.numChunks);
      } else {
        manifest.totalChunks = Math.max(
          manifest.totalChunks || 0,
          chunkIndex + 1,
        );
      }

      if (req.query.time != null) {
        manifest.totalDemoTimeMs = Number(req.query.time);
      }

      if (req.query.absSize != null) {
        manifest.totalUploadedBytes = Number(req.query.absSize);
      } else {
        manifest.totalUploadedBytes =
          Number(manifest.totalUploadedBytes || 0) + body.length;
      }
    } else {
      const otherFilePath = path.join(
        fileUtil.getSessionPath(session),
        filename,
      );
      await fileUtil.saveBinary(otherFilePath, body);
    }

    await saveManifest(session, manifest);

    return res.status(204).end();
  } catch (error) {
    console.error("[postFile] Error:", error);
    next(error);
  }
};

// POST /replay/:session/event
exports.postAddEvent = async (req, res, next) => {
  try {
    logRoute("postAddEvent", req);

    const { session } = req.params;
    const manifest = await loadManifest(session);

    if (!manifest) {
      return res.status(404).end();
    }

    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || []);
    const eventId = `${session}_${Date.now()}`;

    const eventRecord = {
      id: eventId,
      session,
      group: req.query.group || "",
      time1: req.query.time1 != null ? Number(req.query.time1) : null,
      time2: req.query.time2 != null ? Number(req.query.time2) : null,
      meta: req.query.meta || "",
      incrementSize:
        req.query.incrementSize != null
          ? String(req.query.incrementSize) === "true"
          : null,
      createdAt: nowIso(),
    };

    const eventsDir = fileUtil.getEventsPath(session);
    const eventBinPath = path.join(eventsDir, `${eventId}.bin`);
    const eventMetaPath = path.join(eventsDir, `${eventId}.json`);
    const eventsIndexPath = path.join(
      fileUtil.getSessionPath(session),
      "events.json",
    );

    await fileUtil.saveBinary(eventBinPath, body);
    await fileUtil.saveJson(eventMetaPath, eventRecord);

    const eventsIndex = (await fileUtil.readJson(eventsIndexPath)) || [];
    eventsIndex.push(eventRecord);
    await fileUtil.saveJson(eventsIndexPath, eventsIndex);

    console.log("[postAddEvent] Saved event ID:", eventId);
    console.log("[postAddEvent] Saved binary:", eventBinPath);
    console.log("[postAddEvent] Body length:", body.length);

    return res.status(204).end();
  } catch (error) {
    console.error("[postAddEvent] Error:", error);
    next(error);
  }
};
// POST /replay/:session/event/:session2_:eventName
exports.postUpdateEvent = async (req, res, next) => {
  try {
    logRoute("postUpdateEvent", req);

    const { session2, eventName } = req.params;
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || []);
    const eventId = `${session2}_${eventName}`;

    const eventRecord = {
      id: eventId,
      session: session2,
      group: req.query.group || "",
      time1: req.query.time1 != null ? Number(req.query.time1) : null,
      time2: req.query.time2 != null ? Number(req.query.time2) : null,
      meta: req.query.meta || "",
      incrementSize:
        req.query.incrementSize != null
          ? String(req.query.incrementSize) === "true"
          : null,
      updatedAt: nowIso(),
    };

    const eventsDir = fileUtil.getEventsPath(session2);
    const eventBinPath = path.join(eventsDir, `${eventId}.bin`);
    const eventMetaPath = path.join(eventsDir, `${eventId}.json`);
    const eventsIndexPath = path.join(
      fileUtil.getSessionPath(session2),
      "events.json",
    );

    await fileUtil.saveBinary(eventBinPath, body);
    await fileUtil.saveJson(eventMetaPath, eventRecord);

    const eventsIndex = (await fileUtil.readJson(eventsIndexPath)) || [];
    const idx = eventsIndex.findIndex((e) => e.id === eventId);

    if (idx >= 0) {
      eventsIndex[idx] = { ...eventsIndex[idx], ...eventRecord };
    } else {
      eventsIndex.push(eventRecord);
    }

    await fileUtil.saveJson(eventsIndexPath, eventsIndex);

    console.log("[postUpdateEvent] Saved event ID:", eventId);
    console.log("[postUpdateEvent] Saved binary:", eventBinPath);
    console.log("[postUpdateEvent] Body length:", body.length);

    return res.status(204).end();
  } catch (error) {
    console.error("[postUpdateEvent] Error:", error);
    next(error);
  }
};

// POST /replay/:sessionName/startDownloading
exports.startDownloading = async (req, res, next) => {
  try {
    logRoute("startDownloading", req);

    const { sessionName } = req.params;
    const manifest = await loadManifest(sessionName);

    if (!manifest) {
      return res.status(404).end();
    }

    const user = req.query.user || req.body?.user || "anonymous";
    const viewerId = crypto.randomUUID().replace(/-/g, "");

    if (!Array.isArray(manifest.viewers)) {
      manifest.viewers = [];
    }

    manifest.viewers.push({
      viewerId,
      user,
      lastSeenAt: nowIso(),
      final: false,
    });

    await saveManifest(sessionName, manifest);

    return res.status(200).json({
      numChunks: manifest.totalChunks || 0,
      state: manifest.isLive ? "Live" : "",
      time: manifest.totalDemoTimeMs || 0,
      viewerId,
    });
  } catch (error) {
    console.error("[startDownloading] Error:", error);
    next(error);
  }
};

// POST /replay/:sessionName/viewer/:viewerName
exports.viewerHeartbeat = async (req, res, next) => {
  try {
    logRoute("viewerHeartbeat", req);

    const { sessionName, viewerName } = req.params;
    const manifest = await loadManifest(sessionName);

    if (!manifest) {
      return res.status(404).end();
    }

    if (!Array.isArray(manifest.viewers)) {
      manifest.viewers = [];
    }

    const finalValue =
      req.query.final != null
        ? String(req.query.final) === "true"
        : req.body?.final === true;

    const existing = manifest.viewers.find((v) => v.viewerId === viewerName);

    if (existing) {
      existing.lastSeenAt = nowIso();
      existing.final = !!finalValue;
    } else {
      manifest.viewers.push({
        viewerId: viewerName,
        user: "unknown",
        lastSeenAt: nowIso(),
        final: !!finalValue,
      });
    }

    if (finalValue) {
      manifest.viewers = manifest.viewers.filter(
        (v) => v.viewerId !== viewerName,
      );
    }

    await saveManifest(sessionName, manifest);

    return res.status(204).end();
  } catch (error) {
    console.error("[viewerHeartbeat] Error:", error);
    next(error);
  }
};

// GET /replay/:sessionName/file/replay.header
exports.getHeaderFile = async (req, res, next) => {
  try {
    logRoute("getHeaderFile", req);

    const { sessionName } = req.params;
    const headerPath = path.join(
      fileUtil.getSessionPath(sessionName),
      "replay.header",
    );
    const data = await fileUtil.readBinary(headerPath);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", data.length);
    return res.status(200).send(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).end();
    }
    console.error("[getHeaderFile] Error:", error);
    next(error);
  }
};

// GET /replay/:sessionName/file/stream.:chunkIndex
exports.getStreamChunkFile = async (req, res, next) => {
  try {
    logRoute("getStreamChunkFile", req);

    const { sessionName, chunkIndex } = req.params;
    const manifest = await loadManifest(sessionName);

    if (!manifest) {
      return res.status(404).end();
    }

    const cacheKey = `${sessionName}:${chunkIndex}`;
    let data = getCache(cacheKey);
    let chunkMeta = null;

    const metaPath = path.join(
      fileUtil.getChunksPath(sessionName),
      `stream.${chunkIndex}.json`,
    );

    if (!data) {
      const chunkPath = path.join(
        fileUtil.getChunksPath(sessionName),
        `stream.${chunkIndex}`,
      );

      const startedAt = Date.now();
      try {
        data = await fileUtil.readBinary(chunkPath);
      } catch (error) {
        if (error.code === "ENOENT") {
          data = Buffer.alloc(0);
        } else {
          throw error;
        }
      }

      console.log(
        `[getStreamChunkFile] chunk=${chunkIndex} size=${data.length} took=${Date.now() - startedAt}ms`,
      );

      setCache(cacheKey, data);
    } else {
      console.log(
        `[getStreamChunkFile] chunk=${chunkIndex} cache hit size=${data.length}`,
      );
    }

    try {
      chunkMeta = await fileUtil.readJson(metaPath);
    } catch (_) {}

    res.setHeader("NumChunks", String(manifest.totalChunks || 0));
    res.setHeader("Time", String(manifest.totalDemoTimeMs || 0));
    res.setHeader("State", manifest.isLive ? "Live" : "");

    if (chunkMeta?.startTimeMs != null) {
      res.setHeader("MTime1", String(chunkMeta.startTimeMs));
    }

    if (chunkMeta?.endTimeMs != null) {
      res.setHeader("MTime2", String(chunkMeta.endTimeMs));
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", data.length);

    return res.status(200).send(data);
  } catch (error) {
    console.error("[getStreamChunkFile] Error:", error);
    next(error);
  }
};

// GET /replay/:sessionName/event?group=...
exports.getGroup = async (req, res, next) => {
  try {
    logRoute("getGroup", req);

    const { sessionName } = req.params;
    const group = req.query.group || "";
    const eventsIndexPath = path.join(
      fileUtil.getSessionPath(sessionName),
      "events.json",
    );
    const events = (await fileUtil.readJson(eventsIndexPath)) || [];

    const filtered = events.filter((e) => e.group === group);

    return res.status(200).json({
      events: filtered.map((e) => ({
        id: e.id,
        group: e.group,
        meta: e.meta,
        time1: e.time1,
        time2: e.time2,
      })),
    });
  } catch (error) {
    console.error("[getGroup] Error:", error);
    next(error);
  }
};

// GET /replay
exports.searchReplays = async (req, res, next) => {
  try {
    logRoute("searchReplays", req);

    const sessions = await fileUtil.listSessions();
    const replays = [];

    for (const sessionName of sessions) {
      const manifest = await loadManifest(sessionName);
      if (!manifest) continue;

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
    console.error("[searchReplays] Error:", error);
    next(error);
  }
};
