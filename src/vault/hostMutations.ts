// Host CRUD end-to-end: the bridge from a form submission to a persisted,
// re-sealed vault and a scheduled sync push. Each mutation follows the PLAN §B
// path — update document → sealPayload (same DEK) → write local blob → update the
// derived Redux state → schedule a debounced push — so an edit is durable and
// biometric-unlockable immediately, and reaches the server on the next debounce.
// Framework-free so it unit-tests the reducer + push-scheduling flow directly.

import { sealPayload } from "@/crypto";
import { store } from "@/store";
import { vaultDocumentUpdated } from "@/store/vaultSlice";
import { scheduleSyncPush } from "@/sync/engine";
import { parseVaultDocument } from "./document";
import {
  addHostToPayload,
  deleteHostFromPayload,
  type HostInput,
  updateHostInPayload,
} from "./mutate";
import { writeVaultBlob } from "./storage";
import { getVaultSession, updateVaultSessionPayload } from "./vaultSession";

function requireSession() {
  const session = getVaultSession();
  if (!session) {
    throw new Error("vault is locked");
  }
  return session;
}

// commitPayload re-seals the mutated payload under the unlocked vault's DEK,
// persists it, primes it into the session + derived state, and schedules a push.
async function commitPayload(newPayload: Uint8Array): Promise<void> {
  const session = requireSession();
  const blob = await sealPayload(session, newPayload);
  writeVaultBlob(blob);
  updateVaultSessionPayload(newPayload);
  const version = store.getState().vault.version;
  const document = parseVaultDocument(newPayload);
  store.dispatch(vaultDocumentUpdated({ hosts: document.hosts, version }));
  scheduleSyncPush();
}

// addHost validates + appends a manual host, persists it, and returns its id.
export async function addHost(input: HostInput): Promise<string> {
  const { payload, id } = addHostToPayload(requireSession().payload, input);
  await commitPayload(payload);
  return id;
}

// editHost merges the editable fields into an existing host and persists it.
export async function editHost(id: string, input: HostInput): Promise<void> {
  const payload = updateHostInPayload(requireSession().payload, id, input);
  await commitPayload(payload);
}

// deleteHost removes a host and persists the shortened document.
export async function deleteHost(id: string): Promise<void> {
  const payload = deleteHostFromPayload(requireSession().payload, id);
  await commitPayload(payload);
}
