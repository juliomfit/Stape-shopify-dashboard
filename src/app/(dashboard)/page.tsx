import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

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
      <PagePlaceholder
        title="No data connected yet"
        description="This page will summarize sales, traffic, and conversions once Shopify and Stape are connected."
      />
    </>
  );
}
