import { writeFileSync } from "node:fs";

import { buildNeonRebuildSql } from "./neon-rebuild-sql";

writeFileSync("scripts/neon-rebuild.sql", buildNeonRebuildSql());
console.log("Wrote scripts/neon-rebuild.sql");
