import { useId, type ReactNode } from "react";
import { channelKind, typeBadgeClass } from "@/lib/channel-visual";

type ChannelMarkProps = {
  name: string;
  type?: string;
  size?: number;
};

function Face({
  fill,
  children,
  size,
}: {
  fill: string;
  children: ReactNode;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="shrink-0"
      aria-hidden="true"
    >
      <rect width="20" height="20" rx="5" fill={fill} />
      {children}
    </svg>
  );
}

export function ChannelMark({ name, type, size = 20 }: ChannelMarkProps) {
  const kind = channelKind(name, type);
  const igId = `ig-${useId().replace(/:/g, "")}`;

  switch (kind) {
    case "facebook":
      return (
        <Face fill="#1877f2" size={size}>
          <path
            d="M12.6 10.4H11V16H8.7v-5.6H7.5V8.4h1.2V7.1c0-1.6.8-2.6 2.7-2.6h1.6v2H12c-.8 0-.9.3-.9.9v1h1.8l-.3 2Z"
            fill="white"
          />
        </Face>
      );
    case "instagram":
      return (
        <Face fill={`url(#${igId})`} size={size}>
          <defs>
            <linearGradient id={igId} x1="2" y1="18" x2="18" y2="2">
              <stop stopColor="#f58529" />
              <stop offset="0.5" stopColor="#dd2a7b" />
              <stop offset="1" stopColor="#8134af" />
            </linearGradient>
          </defs>
          <rect
            x="4.2"
            y="4.2"
            width="11.6"
            height="11.6"
            rx="3.2"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          />
          <circle cx="10" cy="10" r="2.6" fill="none" stroke="white" strokeWidth="1.5" />
          <circle cx="13.6" cy="6.4" r="0.8" fill="white" />
        </Face>
      );
    case "google":
      return (
        <Face fill="#ffffff" size={size}>
          <rect
            x="0.4"
            y="0.4"
            width="19.2"
            height="19.2"
            rx="4.6"
            fill="none"
            stroke="#e6eaf0"
          />
          <path
            d="M16.2 10.2c0-.4 0-.8-.1-1.1H10v2.1h3.5c-.2.9-.8 1.6-1.7 2.1v1.7h2.2c1.3-1.2 2.2-3 2.2-4.8Z"
            fill="#4285F4"
          />
          <path
            d="M10 16.4c2.3 0 4.2-.8 5.6-2.1l-2.2-1.7c-.6.4-1.5.7-2.7.7-2.1 0-3.8-1.4-4.4-3.3H3.3v1.8C4.7 14.9 7.1 16.4 10 16.4Z"
            fill="#34A853"
          />
          <path
            d="M5.6 10c0-.5.1-1 .2-1.4V6.8H3.3C2.8 7.8 2.6 8.9 2.6 10s.2 2.2.7 3.2l2.3-1.8c-.1-.4-.2-.9-.2-1.4Z"
            fill="#FBBC05"
          />
          <path
            d="M10 4.7c1.2 0 2.3.4 3.2 1.2l1.9-1.9C13.7 2.6 12 2 10 2 7.1 2 4.7 3.5 3.3 6.8l2.5 1.8C6.4 6.7 8 4.7 10 4.7Z"
            fill="#EA4335"
          />
        </Face>
      );
    case "youtube":
      return (
        <Face fill="#ff0000" size={size}>
          <path d="M8 6.6 13.6 10 8 13.4V6.6Z" fill="white" />
        </Face>
      );
    case "tiktok":
      return (
        <Face fill="#111111" size={size}>
          <path
            d="M12.2 5.2c.5 1.4 1.5 2.4 3 2.7v2c-1 0-1.9-.3-2.8-.8v4.4c0 2.3-1.9 4.1-4.3 4.1S3.8 15.8 3.8 13.5 5.6 9.4 8 9.4c.3 0 .5 0 .8.1v2.1c-.2-.1-.5-.1-.8-.1-1.2 0-2.1.9-2.1 2s.9 2 2.1 2 2.1-.9 2.1-2V5.2h2.1Z"
            fill="white"
          />
        </Face>
      );
    case "microsoft":
      return (
        <Face fill="#ffffff" size={size}>
          <rect x="0.4" y="0.4" width="19.2" height="19.2" rx="4.6" stroke="#e6eaf0" fill="none" />
          <rect x="3.2" y="3.2" width="6.2" height="6.2" fill="#f25022" />
          <rect x="10.6" y="3.2" width="6.2" height="6.2" fill="#7fba00" />
          <rect x="3.2" y="10.6" width="6.2" height="6.2" fill="#00a4ef" />
          <rect x="10.6" y="10.6" width="6.2" height="6.2" fill="#ffb900" />
        </Face>
      );
    case "yahoo":
      return (
        <Face fill="#5f01d1" size={size}>
          <text
            x="10"
            y="13.6"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui"
          >
            Y!
          </text>
        </Face>
      );
    case "email":
      return (
        <Face fill="#7c3aed" size={size}>
          <rect
            x="3.4"
            y="5.6"
            width="13.2"
            height="8.8"
            rx="1.4"
            fill="none"
            stroke="white"
            strokeWidth="1.4"
          />
          <path d="M4 6.4 10 10.4 16 6.4" fill="none" stroke="white" strokeWidth="1.4" />
        </Face>
      );
    case "direct":
      return (
        <Face fill="#0f172a" size={size}>
          <path d="M4.4 10.2 10 5.4l5.6 4.8V15a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1v-4.8Z" fill="white" />
        </Face>
      );
    case "unknown":
      return (
        <Face fill="#94a3b8" size={size}>
          <text
            x="10"
            y="14"
            textAnchor="middle"
            fill="white"
            fontSize="11"
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui"
          >
            ?
          </text>
        </Face>
      );
    case "shopify":
      return (
        <Face fill="#95bf47" size={size}>
          <path
            d="M6.2 15.4 5 5.8l2.4-.4c.2-.7.8-2.2 2.4-2.2.2 0 .4 0 .6.1l.4 3.2 3.8-.6.8 9.5-8.6.1Zm4-8.3-.3-2.4c.6.1 1.3.4 1.3 1.3 0 .4-.2.8-.5 1.1h-.5Z"
            fill="white"
          />
        </Face>
      );
    default:
      return (
        <Face fill="#64748b" size={size}>
          <circle cx="10" cy="10" r="3.2" fill="white" />
        </Face>
      );
  }
}

export function ChannelLabel({
  name,
  type,
}: {
  name: string;
  type?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <ChannelMark name={name} type={type} />
      <span className="font-medium text-foreground">{name}</span>
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${typeBadgeClass(type)}`}
    >
      {type}
    </span>
  );
}
