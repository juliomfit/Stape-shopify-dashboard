import { getMetaCredentials } from "@/lib/ads/meta-credentials";
import { resolveActiveMetaProviderId } from "@/lib/ads/providers/config";
import { FlyweelMetaAdsProvider } from "@/lib/ads/providers/flyweel";
import { GraphMetaAdsProvider } from "@/lib/ads/providers/graph";
import type { MetaAdsProvider } from "@/lib/ads/providers/types";

export async function getMetaAdsProvider(): Promise<MetaAdsProvider | null> {
  const { credentials } = await getMetaCredentials();
  const id = resolveActiveMetaProviderId(Boolean(credentials));
  if (id === "flyweel") {
    return new FlyweelMetaAdsProvider();
  }
  if (id === "meta_graph") {
    return new GraphMetaAdsProvider();
  }
  return null;
}

export { FlyweelMetaAdsProvider, GraphMetaAdsProvider };
export type { MetaAdsProvider };
