/**
 * Creates the first admin account on a server — or gets an admin back in after a lockout.
 * Safe on a live database: it never deletes anything (unlike the seed, which refuses to run
 * in production).
 *
 *   npm run admin:create
 *   npm run admin:create -- --if-missing   (does nothing when an admin already exists)
 *
 * Asks for a name, e-mail and password (hidden while typing; 10+ characters with upper and
 * lower case and a number). If the e-mail already belongs to an account, it offers to make it
 * an active admin with the new password and signs it out everywhere.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { email as emailSchema } from "@/schemas/common";
import { passwordRule } from "@/schemas/user";

const interactive = Boolean(process.stdin.isTTY);
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
const lines = interactive ? null : rl[Symbol.asyncIterator]();

async function ask(question: string) {
  if (lines) {
    process.stdout.write(question);
    const next = await lines.next();
    process.stdout.write("\n");
    return next.done ? "" : String(next.value).trim();
  }
  return (await rl.question(question)).trim();
}

/** Reads a line without echoing it (stars instead). Ends the visible questions: readline would echo the keys. */
async function askHidden(question: string) {
  if (lines) return ask(question);
  rl.close();
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  try {
    return await new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        for (const ch of chunk.toString("utf8")) {
          if (ch === "\r" || ch === "\n") {
            stdin.off("data", onData);
            process.stdout.write("\n");
            return resolve(value);
          }
          if (ch === "\u0003") {
            stdin.off("data", onData);
            return reject(new Error("Cancelled"));
          }
          if (ch === "\u007f" || ch === "\b") {
            if (value) {
              value = value.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else if (ch >= " ") {
            value += ch;
            process.stdout.write("*");
          }
        }
      };
      stdin.on("data", onData);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}

async function main() {
  if (process.argv.includes("--if-missing") && (await db.user.count({ where: { role: "ADMIN", isActive: true } }))) {
    console.log("An admin account already exists — skipped (run `elite admin` to add another or reset a password).");
    return;
  }
  console.log("Create an admin account for the ELITE agent app.\n");
  const name = await ask("Full name: ");
  if (!name) throw new Error("A name is required.");
  const parsedEmail = emailSchema.safeParse(await ask("E-mail (used to sign in and for password reset codes): "));
  if (!parsedEmail.success) throw new Error(parsedEmail.error.issues[0]?.message ?? "Enter a valid e-mail address.");
  const email = parsedEmail.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true, isActive: true } });
  if (existing) {
    const answer = (await ask(`An account with ${email} already exists (${existing.role.toLowerCase()}${existing.isActive ? "" : ", inactive"}). Make it an active admin with a new password? [y/N] `)).toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      console.log("Nothing changed.");
      return;
    }
  }

  const password = await askHidden("Password: ");
  const rule = passwordRule.safeParse(password);
  if (!rule.success) throw new Error(`${rule.error.issues[0]?.message ?? "Password too weak"} (10+ characters with upper and lower case and a number).`);
  if ((await askHidden("Repeat the password: ")) !== password) throw new Error("The passwords don't match.");
  const passwordHash = await hashPassword(password);

  if (existing) {
    await db.$transaction([
      db.user.update({ where: { id: existing.id }, data: { name, role: "ADMIN", isActive: true, passwordHash } }),
      db.session.deleteMany({ where: { userId: existing.id } }),
    ]);
    console.log(`\n✓ ${email} is an active admin with the new password (signed out everywhere).`);
  } else {
    await db.user.create({ data: { name, email, role: "ADMIN", passwordHash } });
    console.log(`\n✓ Admin ${email} created. Sign in at ${process.env.APP_URL || "the agent app"}/login`);
  }
}

main()
  .catch((error) => {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await db.$disconnect();
  });
