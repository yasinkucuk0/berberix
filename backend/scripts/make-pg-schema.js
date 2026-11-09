// Canli ortam icin PostgreSQL semasi uretir: prisma/schema.prisma (SQLite) -> prisma/postgres/schema.prisma
// Tek kaynak schema.prisma'dir; bu dosya her derlemede yeniden uretilir, elle duzenlenmez.
const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "..", "prisma", "schema.prisma");
const targetDir = path.join(__dirname, "..", "prisma", "postgres");
let schema = fs.readFileSync(source, "utf8");

schema = schema.replace(
  /datasource db \{[\s\S]*?\n\}/,
  'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}'
);
if (!schema.includes('provider = "postgresql"')) {
  throw new Error("datasource blogu bulunamadi");
}
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(targetDir, "schema.prisma"), "// OTOMATIK URETILDI - duzenleme. Kaynak: ../schema.prisma\n" + schema);
console.log("PostgreSQL semasi uretildi: prisma/postgres/schema.prisma");
