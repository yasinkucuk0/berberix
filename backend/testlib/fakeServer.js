// Prisma motoru olmadan arayuzu denemek icin: bellek ici veritabaniyla API.
process.env.JWT_SECRET = process.env.JWT_SECRET || "fake-secret-fake-secret-fake-secret-12";
global.__TEST_DB__ = require("./fakeDb").createFakeDb();
const { createApp } = require("../src/app");
createApp().listen(5100, "127.0.0.1", () => console.log("fake API 5100"));
