"use client";

import { useState } from "react";
import { MessageSquareText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { addNoteAction, deleteNoteAction, updateNoteAction } from "@/actions/notes";
import { useAction } from "@/hooks/use-action";
import type { NoteTarget } from "@/schemas/note";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "./empty-state";
import { UserAvatar } from "./user-avatar";
import { RelativeTime } from "./relative-time";

export interface NoteView {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: string | null;
  author: { id: string; name: string; avatarUrl: string | null } | null;
}

function NoteRow({ note, canEdit }: { note: NoteView; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const update = useAction(updateNoteAction, { onSuccess: () => setEditing(false) });
  const remove = useAction(deleteNoteAction);
  const edited = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <UserAvatar user={note.author} className="mt-0.5 size-7" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-foreground">{note.author?.name ?? "Former user"}</span>
          <span className="text-muted-foreground">
            <RelativeTime date={note.createdAt} />
            {edited && " · edited"}
          </span>
          {canEdit && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" className="ml-auto text-muted-foreground" aria-label="Note actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" disabled={remove.pending} onSelect={() => void remove.run({ id: note.id })}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-16" maxLength={5000} autoFocus />
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="ghost" onClick={() => { setDraft(note.content); setEditing(false); }}>
                Cancel
              </Button>
              <Button size="xs" loading={update.pending} disabled={!draft.trim()} onClick={() => void update.run({ id: note.id, content: draft })}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">{note.content}</p>
        )}
      </div>
    </li>
  );
}

export function NotesPanel({ target, targetId, notes, currentUserId, isManager }: { target: NoteTarget; targetId: string; notes: NoteView[]; currentUserId: string; isManager: boolean }) {
  const [content, setContent] = useState("");
  const add = useAction(addNoteAction, { onSuccess: () => setContent("") });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <span className="text-xs text-muted-foreground">{notes.length}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (content.trim()) void add.run({ target, targetId, content });
          }}
          className="space-y-2"
        >
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add a note — call summary, requirement, next step…" className="min-h-16" maxLength={5000} aria-label="New note" />
          <div className="flex justify-end">
            <Button size="sm" type="submit" loading={add.pending} disabled={!content.trim()}>
              Add note
            </Button>
          </div>
        </form>
        {notes.length === 0 ? (
          <EmptyState compact icon={MessageSquareText} title="No notes yet" description="Notes are visible to everyone who can see this record." />
        ) : (
          <ul className="divide-y">
            {notes.map((note) => (
              <NoteRow key={note.id} note={note} canEdit={isManager || note.authorId === currentUserId} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
