"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { ROLE_META } from "@/lib/constants";
import type { AgentOption, Viewer } from "@/types/options";
import { SelectField } from "./fields";

/**
 * Assignee picker. Agents can only assign to themselves, so for them the list is
 * reduced to their own name (the server enforces the same rule).
 */
export function AgentField<T extends FieldValues, TOut = T>({
  control,
  name,
  label = "Assigned agent",
  agents,
  viewer,
  className,
}: {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label?: string;
  agents: AgentOption[];
  viewer: Viewer;
  className?: string;
}) {
  const options = (viewer.isManager ? agents : agents.filter((a) => a.id === viewer.id)).map((a) => ({
    value: a.id,
    label: a.role === "AGENT" ? a.name : `${a.name} (${ROLE_META[a.role].label})`,
  }));
  return <SelectField control={control} name={name} label={label} options={options} allowEmpty emptyLabel="Unassigned" className={className} />;
}
