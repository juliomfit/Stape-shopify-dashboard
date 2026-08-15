import { randomUUID } from "crypto";
import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { insertRows, isPlatformBqReady } from "@/lib/platform/bq";

export type ChangeLogEntry = {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  entity_type: string;
  entity_id: string;
  metadata: string | null;
  created_by: string;
};

const STORE = "analytics-change-log";

export async function listChangeLog(): Promise<ChangeLogEntry[]> {
  const store = (await readDurableJson<{ rows: ChangeLogEntry[] }>(STORE)) ?? {
    rows: [],
  };
  return store.rows;
}

export async function addChangeLog(input: {
  type: string;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  createdBy?: string;
}): Promise<ChangeLogEntry> {
  const entry: ChangeLogEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type: input.type.trim() || "note",
    title: input.title.trim(),
    description: input.description.trim(),
    entity_type: input.entityType?.trim() || "account",
    entity_id: input.entityId?.trim() || "",
    metadata: null,
    created_by: input.createdBy || "dashboard",
  };
  const rows = [entry, ...(await listChangeLog())].slice(0, 200);
  await writeDurableJson(STORE, { rows });
  if (isPlatformBqReady()) {
    try {
      await insertRows("analytics_change_log", [entry]);
    } catch {
      // ignore
    }
  }
  return entry;
}
