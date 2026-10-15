import { writeFileSync } from "node:fs";

import { buildSandboxDdl, sandboxDdlFile, sandboxDdlModule } from "./sandbox-ddl-lib";

const ddl = buildSandboxDdl();
writeFileSync("data/sandbox-ddl.sql", sandboxDdlFile(ddl));
writeFileSync("data/sandbox-ddl.js", sandboxDdlModule(ddl));
console.log(`Wrote data/sandbox-ddl.sql and data/sandbox-ddl.js (${ddl.migrations.length} migrations, hash ${ddl.hash.slice(0, 12)}...)`);
