const app = require("./app");

const PORT = process.env.PORT || 2000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Unreal Replay Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
