import type { Role } from "@/generated/prisma/enums";

export interface AgentOption {
  id: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface Viewer {
  id: string;
  role: Role;
  isManager: boolean;
}
