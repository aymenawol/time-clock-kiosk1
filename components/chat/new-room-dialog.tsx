"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Label, Select } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { ROLE_LABEL, ROLES } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/types";
import { createRoom } from "./actions";
import type { ChatPerson } from "./types";

export function NewRoomDialog({ people, basePath }: { people: ChatPerson[]; basePath: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus />
          New room
        </Button>
      </DialogTrigger>
      <DialogContent title="New chat room" description="A group room has the people you pick. A role room includes everyone with the chosen roles.">
        {open ? <NewRoomForm people={people} basePath={basePath} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NewRoomForm({ people, basePath, onDone }: { people: ChatPerson[]; basePath: string; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"group" | "role">("group");
  const [members, setMembers] = useState<string[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [filter, setFilter] = useState("");
  const [run, pending, fieldErrors] = useAction(createRoom, {
    success: "Room created",
    onSuccess: (d) => {
      onDone();
      router.push(`${basePath}?room=${d.id}`);
    },
  });
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const shown = people.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ name, kind, memberIds: members, roles });
      }}
    >
      <Field label="Room name" htmlFor="room-name" error={fieldErrors.name?.[0]}>
        <Input id="room-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Terminal 3 crew" />
      </Field>
      <Field label="Type" htmlFor="room-kind">
        <Select id="room-kind" value={kind} onChange={(e) => setKind(e.target.value as "group" | "role")}>
          <option value="group">Group (pick members)</option>
          <option value="role">Role (everyone with these roles)</option>
        </Select>
      </Field>

      {kind === "group" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="room-filter">Members ({members.length} selected)</Label>
          <Input id="room-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search people" />
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-[var(--radius-control)] border border-border">
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                  <Checkbox checked={members.includes(p.id)} onChange={() => setMembers((m) => toggle(m, p.id))} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted">{ROLE_LABEL[p.role]}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 ? <li className="px-3 py-4 text-sm text-muted">No one matches.</li> : null}
          </ul>
          {fieldErrors.memberIds?.[0] ? (
            <p className="text-xs text-danger" role="alert">
              {fieldErrors.memberIds[0]}
            </p>
          ) : null}
        </div>
      ) : (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Roles</legend>
          <div className="grid grid-cols-2 gap-1">
            {ROLES.map((r) => (
              <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm hover:bg-surface-2">
                <Checkbox checked={roles.includes(r)} onChange={() => setRoles((l) => toggle(l, r))} />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </div>
          {fieldErrors.roles?.[0] ? (
            <p className="text-xs text-danger" role="alert">
              {fieldErrors.roles[0]}
            </p>
          ) : null}
        </fieldset>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Create room
        </Button>
      </div>
    </form>
  );
}
