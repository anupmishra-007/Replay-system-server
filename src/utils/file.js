const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function getSessionPath(sessionName) {
  return path.join(DATA_DIR, sessionName);
}

function getChunksPath(sessionName) {
  return path.join(getSessionPath(sessionName), "chunks");
}

function getEventsPath(sessionName) {
  return path.join(getSessionPath(sessionName), "events");
}

async function saveBinary(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data);
}

async function readBinary(filePath) {
  return await fs.readFile(filePath);
}

async function saveJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function listSessions() {
  await ensureDir(DATA_DIR);
  const items = await fs.readdir(DATA_DIR, { withFileTypes: true });
  return items.filter((item) => item.isDirectory()).map((item) => item.name);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  DATA_DIR,
  ensureDir,
  getSessionPath,
  getChunksPath,
  getEventsPath,
  saveBinary,
  readBinary,
  saveJson,
  readJson,
  listSessions,
  fileExists,
};
