// Pure helpers for the host form: the Zod schema (format validation matching the
// TUI's rules), the string<->HostInput mapping, and comma-separated tag parsing.
// Framework-free so it unit-tests without React. Uniqueness is NOT checked here —
// it needs the host list and is enforced by the document mutation (mutate.ts),
// whose "name-duplicate" error the logic hook surfaces on the name field.

import { z } from "zod";
import type { VaultHost } from "@/vault/document";
import type { HostInput } from "@/vault/mutate";
import { PORT_MAX, PORT_MIN } from "@/vault/mutate";

export interface HostFormValues {
  name: string;
  user: string;
  address: string;
  // Port is a string in the form (an empty field means "default to 22").
  port: string;
  // Tags are a single comma-separated string in the form.
  tags: string;
}

export interface HostFormErrorCopy {
  readonly nameRequired: string;
  readonly addrRequired: string;
  readonly portRange: string;
}

// portValid accepts an empty port (defaulted downstream) or an integer in range.
function portValid(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") {
    return true;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= PORT_MIN && parsed <= PORT_MAX;
}

// hostFormSchema builds the resolver schema. Format only (required name/address,
// port range) — completeness gating lives in the hook (REACT.md).
export function hostFormSchema(copy: HostFormErrorCopy) {
  return z.object({
    name: z.string().min(1, copy.nameRequired),
    user: z.string(),
    address: z.string().min(1, copy.addrRequired),
    port: z.string().refine(portValid, copy.portRange),
    tags: z.string(),
  });
}

export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// toHostInput maps form strings onto the HostInput the mutation consumes. An
// empty port becomes 0, which mutate.normalizePort turns into the default 22.
export function toHostInput(values: HostFormValues): HostInput {
  const trimmed = values.port.trim();
  const port = trimmed === "" ? 0 : Number(trimmed);
  return {
    name: values.name,
    user: values.user,
    addr: values.address,
    port: Number.isNaN(port) ? 0 : port,
    tags: parseTags(values.tags),
  };
}

export const EMPTY_HOST_FORM: HostFormValues = {
  name: "",
  user: "",
  address: "",
  port: "",
  tags: "",
};

// hostToFormValues seeds the form when editing an existing host.
export function hostToFormValues(host: VaultHost): HostFormValues {
  return {
    name: host.name,
    user: host.user,
    address: host.addr,
    port: host.port ? String(host.port) : "",
    tags: host.tags ? host.tags.join(", ") : "",
  };
}
