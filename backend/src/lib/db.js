// Testlerde global.__TEST_DB__ ile sahte istemci verilebilir.
let client = global.__TEST_DB__ || null;

function db() {
  if (!client) {
    const { PrismaClient } = require("@prisma/client");
    client = new PrismaClient();
  }
  return client;
}

module.exports = { db };
