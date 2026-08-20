/** Public deploy identity. No secrets. Safe to expose without login. */
export function publicBuildInfo() {
  return {
    sha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
    vercelEnv: process.env.VERCEL_ENV?.trim() || null,
  };
}
