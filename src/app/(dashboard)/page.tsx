import type { Metadata } from "next";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Overview",
};

export default function OverviewPage() {
  return (
    <>
      <Header
        title="Overview"
        description="A high-level view of Shopify and Stape performance."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Revenue" source="Shopify · no data yet" />
          <MetricCard label="Orders" source="Shopify · no data yet" />
          <MetricCard label="Conversion Rate" source="Shopify + Stape · no data yet" />
          <MetricCard label="Sessions / Traffic" source="Stape · no data yet" />
        </div>
        <EmptyPanel
          title="Top Products"
          description="Top-selling products will appear here after Shopify is connected."
        />
      </section>
    </>
  );
}
