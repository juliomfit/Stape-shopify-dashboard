/**
 * /meta/story is screenshot/demo only.
 * Allowed in local development and Vercel Preview. Blocked in Production.
 */
export function isMetaStoryAllowed(vercelEnv: string | undefined) {
  return vercelEnv !== "production";
}
