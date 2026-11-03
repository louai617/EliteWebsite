"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { deleteClientAction } from "@/actions/clients";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { ClientSheet, type ClientRecord } from "./client-form";

export function ClientHeaderActions({ client, agents, viewer }: { client: ClientRecord; agents: AgentOption[]; viewer: Viewer }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil /> Edit
      </Button>
      {viewer.isManager && (
        <DeleteRecordButton action={deleteClientAction} id={client.id} redirectTo="/clients" title={`Delete ${client.fullName}?`} description="Clients with deals can't be deleted. Linked leads are kept." />
      )}
      <ClientSheet open={editing} onOpenChange={setEditing} client={client} agents={agents} viewer={viewer} />
    </>
  );
}
