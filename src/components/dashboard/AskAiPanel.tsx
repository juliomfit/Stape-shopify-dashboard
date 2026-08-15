"use client";

import { useState } from "react";

export function AskAiPanel({
  viewContext,
  compact = false,
}: {
  viewContext?: string;
  compact?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    setAnswer("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, viewContext }),
      });
      const payload = (await response.json()) as { text?: string; ok?: boolean };
      setAnswer(payload.text || "No answer.");
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Ask GoodsNova AI</h2>
      <p className="mt-1 text-xs text-muted">
        Optional. Uses canonical metrics. Cannot pause ads or invent COGS.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="How are Meta ads doing today?"
          className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </form>
      {!compact ? (
        <button
          type="button"
          className="mt-2 text-xs text-muted underline"
          onClick={() => void ask("Ask AI about this view")}
        >
          Ask AI about this view
        </button>
      ) : null}
      {answer ? (
        <pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
          {answer}
        </pre>
      ) : null}
    </article>
  );
}
