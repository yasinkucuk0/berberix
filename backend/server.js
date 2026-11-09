const { ensureEnv } = require("./src/lib/env");

ensureEnv();

const { createApp } = require("./src/app");

const PORT = Number(process.env.PORT) || 5100;

createApp().listen(PORT, "0.0.0.0", () => {
  console.log(`BERBERİX API: http://localhost:${PORT}`);
  require("./src/decisions").backfillCustomerKeys()
    .then((n) => n && console.log(`Karar motoru: ${n} eski randevuya müşteri anahtarı eklendi.`))
    .catch((e) => console.error("Müşteri anahtarı doldurulamadı:", e.message));
});
