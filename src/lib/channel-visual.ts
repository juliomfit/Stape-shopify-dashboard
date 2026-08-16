export type ChannelKind =
  | "instagram"
  | "facebook"
  | "google"
  | "youtube"
  | "tiktok"
  | "microsoft"
  | "yahoo"
  | "email"
  | "direct"
  | "unknown"
  | "shopify"
  | "other";

function haystack(name: string, type?: string) {
  return `${name} ${type ?? ""}`.toLowerCase();
}

export function channelKind(name: string, type?: string): ChannelKind {
  const text = haystack(name, type);

  if (text.includes("unknown") || text.includes("unattributed")) {
    return "unknown";
  }
  if (text.includes("instagram") || /\big\b/.test(text)) {
    return "instagram";
  }
  if (
    text.includes("facebook") ||
    text.includes("meta") ||
    /\bfb\b/.test(text)
  ) {
    return "facebook";
  }
  if (text.includes("youtube") || text.includes("youtu")) {
    return "youtube";
  }
  if (text.includes("google")) {
    return "google";
  }
  if (text.includes("tiktok") || text.includes("tik tok")) {
    return "tiktok";
  }
  if (
    text.includes("microsoft") ||
    text.includes("bing") ||
    text.includes("msclkid")
  ) {
    return "microsoft";
  }
  if (text.includes("yahoo")) {
    return "yahoo";
  }
  if (
    text.includes("email") ||
    text.includes("klaviyo") ||
    text.includes("sendvio") ||
    text.includes("omnisend") ||
    text.includes("sms") ||
    text.includes("attentive") ||
    text.includes("postscript") ||
    text.includes("mailchimp") ||
    text.includes("brevo")
  ) {
    return "email";
  }
  if (text.includes("shop pay") || text.includes("shopify")) {
    return "shopify";
  }
  if (text.includes("direct")) {
    return "direct";
  }

  return "other";
}

export function channelColor(name: string, type?: string) {
  switch (channelKind(name, type)) {
    case "instagram":
      return "#e1306c";
    case "facebook":
      return "#1877f2";
    case "google":
      return "#4285f4";
    case "youtube":
      return "#ff0000";
    case "tiktok":
      return "#111111";
    case "microsoft":
      return "#00a4ef";
    case "yahoo":
      return "#5f01d1";
    case "email":
      return "#7c3aed";
    case "direct":
      return "#0f172a";
    case "unknown":
      return "#94a3b8";
    case "shopify":
      return "#95bf47";
    default:
      return "#64748b";
  }
}

export function typeBadgeClass(type: string) {
  const text = type.toLowerCase();
  if (text.includes("paid") || text.includes("ads") || text.includes("cpc")) {
    return "bg-blue-50 text-blue-800";
  }
  if (text.includes("organic")) {
    return "bg-emerald-50 text-emerald-800";
  }
  if (text.includes("direct")) {
    return "bg-slate-100 text-slate-800";
  }
  if (text.includes("unknown") || text.includes("unattributed")) {
    return "bg-amber-50 text-amber-800";
  }
  if (text.includes("email") || text.includes("sms")) {
    return "bg-violet-50 text-violet-800";
  }
  return "bg-slate-100 text-slate-600";
}
