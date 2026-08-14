export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ignoreMissingCredentialFile } = await import("@/lib/stape/config");
  ignoreMissingCredentialFile();
}
