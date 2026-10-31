const { ensureEnv } = require("./src/lib/env");

ensureEnv();

const { createApp } = require("./src/app");

const PORT = Number(process.env.PORT) || 5100;

createApp().listen(PORT, "0.0.0.0", () => {
  console.log(`Berberim API: http://localhost:${PORT}`);
});
