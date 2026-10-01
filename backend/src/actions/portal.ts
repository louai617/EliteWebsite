"use server";

import { authedAction } from "@/lib/action";
import { z } from "zod";
import { id } from "@/schemas/common";
import { portalAccessSchema } from "@/schemas/portal";
import { grantPortalAccess, revokePortalAccess } from "@/services/client-accounts";

export const grantPortalAccessAction = authedAction(portalAccessSchema, async (input, user) => {
  const account = await grantPortalAccess(user, input);
  return { email: account.email };
}, { message: "Portal access granted" });

export const revokePortalAccessAction = authedAction(z.object({ clientId: id }), (input, user) => revokePortalAccess(user, input.clientId), { message: "Portal access revoked" });
