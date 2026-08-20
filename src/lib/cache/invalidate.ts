import { revalidateTag, updateTag } from "next/cache";
import {
  revalidateProfile,
  tagsForMutation,
  tagsForSource,
  type CacheMutation,
  type InvalidationMode,
  type InvalidationSource,
} from "@/lib/cache/tags";

export async function expireCacheTags(
  tags: readonly string[],
  mode: InvalidationMode,
) {
  const profile = revalidateProfile(mode);
  for (const tag of tags) {
    revalidateTag(tag, profile);
  }
}

/**
 * Route Handler / cron invalidation.
 * Explicit Refresh buttons must use hard (`{ expire: 0 }`) so router.refresh()
 * cannot read SWR-stale data. Cron may use swr (`"max"`).
 * Do not call updateTag here — it is Server-Action only.
 */
export async function invalidateCachedSources(
  source: InvalidationSource,
  options: { mode?: InvalidationMode } = {},
) {
  await expireCacheTags(tagsForSource(source), options.mode ?? "hard");
}

/** Server Actions only. Immediate read-your-own-writes for the current render. */
export function updateCachedMutation(kind: CacheMutation) {
  for (const tag of tagsForMutation(kind)) {
    updateTag(tag);
  }
}
