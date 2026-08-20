import type { Metadata } from "next";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { Header } from "@/components/layout/Header";
import { getSelectedPeriod } from "@/lib/period-server";
import { isOpenAiConfigured } from "@/lib/platform/config";


export const metadata: Metadata = { title: "Ask AI" };

export default async function AiPage() {
  const period = await getSelectedPeriod();
  return (
    <>
      <Header
        title="Ask GoodsNova AI"
        description="Optional control layer. Charts do not call GPT. Tools query the same semantic metrics as the dashboard."
      />
      <section className="dash-page gap-6">
        {!isOpenAiConfigured() ? (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-muted">
            Set OPENAI_API_KEY to enable answers. Refresh Meta and other syncs still work from Integrations.
          </p>
        ) : null}
        <AskAiPanel viewContext={`Ask AI page · ${period.label}`} />
      </section>
    </>
  );
}
