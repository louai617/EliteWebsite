import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { apiRoute, listQuery } from "@/lib/api/handler";
import { createUserSchema } from "@/schemas/user";
import { USER_SORTS, createUser, listUsers } from "@/services/users";

const query = listQuery.extend({
  sort: z.enum(USER_SORTS).default("createdAt"),
  role: z.enum(Role).optional(),
  active: z.enum(["true", "false"]).optional(),
});

/** GET /api/users — staff accounts (admins: everyone; managers: their agents). Client accounts are managed per client. */
export const GET = apiRoute({ audience: "staff", permission: "users.manage", query }, async ({ user, query: q }) => {
  const { page, pageSize, q: search, sort, dir, role, active } = q;
  return listUsers(user, { page, pageSize, q: search, sort, dir }, { role, active: active === undefined ? undefined : active === "true" });
});

/** POST /api/users — create a staff account (role checks in the service). */
export const POST = apiRoute({ audience: "staff", permission: "users.manage", body: createUserSchema, status: 201 }, ({ user, body }) => createUser(user, body));
