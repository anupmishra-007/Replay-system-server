const express = require("express");
const healthRoutes = require("./routes/health.routes");
const replayRoutes = require("./routes/replay.routes");
const eventRoutes = require("./routes/event.routes");

const app = express();

app.use((req, res, next) => {
  console.log("--------------------------------------------------");
  console.log("Incoming Request");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("Content-Length:", req.headers["content-length"]);
  console.log("User-Agent:", req.headers["user-agent"]);

  res.on("finish", () => {
    console.log("Response Status:", res.statusCode);
    console.log("--------------------------------------------------");
  });

  next();
});

app.use("/health", healthRoutes);
app.use("/replay", replayRoutes);
app.use("/event", eventRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: err.message || "Internal Server Error",
  });
});

module.exports = app;
