/**
 * Runs the service test-suite against a fresh throwaway SQLite database (./test.db):
 * delete → migrate deploy → seed → tests. The development database is never touched.
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const env = { ...process.env, DATABASE_URL: "file:./test.db" };
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`test.db${suffix}`, { force: true });
run("npx prisma migrate deploy");
run("npx prisma db seed");
run("node --conditions=react-server --import tsx tests/services.test.ts");
run("node --conditions=react-server --import tsx tests/operations.test.ts");
