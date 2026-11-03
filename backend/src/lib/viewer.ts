import type { SessionUser } from "@/lib/auth/session";
import { isManager } from "@/lib/permissions";
import type { Viewer } from "@/types/options";

export function toViewer(user: SessionUser): Viewer {
  return { id: user.id, role: user.role, isManager: isManager(user) };
}
