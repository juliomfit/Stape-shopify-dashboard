export type PlatformSource = "facebook" | "google";

export type PlatformClaimKind =
  | "warehouse"
  | "paste"
  | "graph"
  | "env"
  | "file"
  | "missing";

export type PlatformClaim = {
  source: PlatformSource;
  label: string;
  state: "connected" | "not_configured" | "error";
  claimKind?: PlatformClaimKind;
  message?: string;
  spend: number | null;
  purchases: number | null;
  revenue: number | null;
};

export type PlatformReported = {
  facebook: PlatformClaim;
  google: PlatformClaim;
  totalSpend: number | null;
};
