/**
 * PM2 process list on the server (started and reloaded by deploy/update.sh).
 *
 * Both apps listen on 127.0.0.1 only; nginx publishes them on the real domains with HTTPS.
 * One process each, fork mode: the agent app runs the in-process scheduler and writes to
 * SQLite and local files, so it must never run as several copies (cluster mode).
 */
const path = require("node:path");

const home = process.env.ELITE_HOME || "/opt/elite";
const logs = path.join(home, "shared", "logs");

const app = (name, dir, port, memory) => ({
  name,
  // Through the `current` symlink, so a reload picks up the newly deployed release.
  cwd: path.join(home, "current", dir),
  script: "node_modules/next/dist/bin/next",
  args: `start -p ${port} -H 127.0.0.1`,
  exec_mode: "fork",
  instances: 1,
  max_memory_restart: memory,
  kill_timeout: 10_000,
  out_file: path.join(logs, `${name}.log`),
  error_file: path.join(logs, `${name}.error.log`),
  time: true,
  env: { NODE_ENV: "production", ELITE_HOME: home },
});

module.exports = {
  apps: [app("elite-agent-app", "backend", 3002, "1500M"), app("elite-website", "frontend", 3001, "1G")],
};
