import { revalidateTag } from "next/cache";
import {
  tagsForSource,
  type InvalidationSource,
} from "@/lib/cache/tags";

export async function invalidateCachedSources(source: InvalidationSource) {
  for (const tag of tagsForSource(source)) {
    revalidateTag(tag, "max");
  }
}
