import { getMetaCredentials } from "@/lib/ads/meta-credentials";
import { requestedMetaProvider, flyweelMcpUrl } from "@/lib/ads/providers/config";
import { resolveFlyweelApiKey } from "@/lib/ads/providers/flyweel-credentials";
import { FlyweelMcpClient } from "@/lib/ads/providers/flyweel-mcp";
import { FlyweelMetaAdsProvider } from "@/lib/ads/providers/flyweel";
import { GraphMetaAdsProvider } from "@/lib/ads/providers/graph";
import type { MetaAdsProvider } from "@/lib/ads/providers/types";

export async function getMetaAdsProvider(): Promise<MetaAdsProvider | null> {
  const key = await resolveFlyweelApiKey();
  const { credentials } = await getMetaCredentials();
  const requested = requestedMetaProvider();
  if (requested === "meta_graph") {
    return credentials ? new GraphMetaAdsProvider() : null;
  }
  if (key) {
    return new FlyweelMetaAdsProvider(new FlyweelMcpClient(flyweelMcpUrl(), key));
  }
  if (requested === "flyweel") {
    return null;
  }
  if (credentials) {
    return new GraphMetaAdsProvider();
  }
  return null;
}

export { FlyweelMetaAdsProvider, GraphMetaAdsProvider };
export type { MetaAdsProvider };
