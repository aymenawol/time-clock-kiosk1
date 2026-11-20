"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { slugify, US_TIME_ZONES } from "@/lib/platform-config";
import { createCompany, type CreatedCompany } from "./actions";

const empty = { name: "", slug: "", timezone: "America/Los_Angeles", firstName: "", lastName: "", email: "", employeeNumber: "" };

export function NewCompanyForm() {
  const [v, setV] = useState(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [created, setCreated] = useState<CreatedCompany | null>(null);
  const [run, pending, errors] = useAction(createCompany, {
    onSuccess: (data) => {
      setCreated(data);
      setV(empty);
      setSlugTouched(false);
    },
  });
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  const err = (k: string) => errors[k]?.[0];

  return (
    <div className="flex flex-col gap-4">
      {created ? (
        <div role="status" className="rounded-[var(--radius-control)] bg-success-soft px-3 py-3 text-sm text-success">
          <p className="font-medium">{created.name} was created.</p>
          <p className="mt-1">
            {created.adminFirstName} will get an email at {created.adminEmail} to set their password. After that they sign
            in at the normal login page and land on their dashboard. Slug: {created.slug}.
          </p>
        </div>
      ) : null}
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setCreated(null);
          await run(v);
        }}
      >
        <Field label="Company name" htmlFor="name" error={err("name")}>
          <Input
            id="name"
            value={v.name}
            required
            onChange={(e) => {
              const name = e.target.value;
              setV((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name) }));
            }}
          />
        </Field>
        <Field label="Slug" htmlFor="slug" hint="Lowercase letters, numbers and hyphens. Must be unique." error={err("slug")}>
          <Input
            id="slug"
            value={v.slug}
            required
            onChange={(e) => {
              setSlugTouched(true);
              set("slug")(e);
            }}
          />
        </Field>
        <Field label="Time zone" htmlFor="timezone" error={err("timezone")}>
          <Select id="timezone" value={v.timezone} onChange={set("timezone")}>
            {US_TIME_ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-sm font-medium text-fg">First admin</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" error={err("firstName")}>
            <Input id="firstName" value={v.firstName} required onChange={set("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={err("lastName")}>
            <Input id="lastName" value={v.lastName} required onChange={set("lastName")} />
          </Field>
        </div>
        <Field label="Email" htmlFor="email" error={err("email")}>
          <Input id="email" type="email" value={v.email} required onChange={set("email")} />
        </Field>
        <Field label="Employee number" htmlFor="employeeNumber" hint="3 to 8 digits" error={err("employeeNumber")}>
          <Input id="employeeNumber" inputMode="numeric" value={v.employeeNumber} required onChange={set("employeeNumber")} />
        </Field>
        <Button type="submit" loading={pending}>
          Create company
        </Button>
      </form>
    </div>
  );
}
