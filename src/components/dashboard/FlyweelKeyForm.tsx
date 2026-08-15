import { saveFlyweelKeyForm } from "@/lib/platform/actions";

export function FlyweelKeyForm(props: { accountId?: string; keyHint?: string }) {
  return (
    <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
      <h2 className="font-semibold text-foreground">Paste the Flyweel key here</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Flyweel is rejecting the key currently on Vercel. Generate a new key, copy the full{" "}
        <code className="rounded bg-white px-1">fwl_</code> string immediately, and paste it below.
        Do not use Add to Cursor or the masked prefix from the token list
        {props.keyHint ? ` (current: ${props.keyHint})` : ""}.
      </p>
      <form action={saveFlyweelKeyForm} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          Flyweel API key
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            required
            placeholder="fwl_"
            className="rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Meta ad account id
          <input
            name="accountId"
            defaultValue={props.accountId || "209273195421975"}
            className="rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm"
          />
        </label>
        <button type="submit" className="w-fit rounded-lg bg-foreground px-3 py-2 text-sm text-background">
          Save Flyweel key
        </button>
      </form>
    </article>
  );
}
