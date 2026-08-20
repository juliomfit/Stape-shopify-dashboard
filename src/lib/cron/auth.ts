import { cronSecret } from "@/lib/platform/config";

export function cronAuthorized(request: Request): boolean {
  const secret = cronSecret();
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}
