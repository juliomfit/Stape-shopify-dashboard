import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Sales",
};

export default function SalesPage() {
  return (
    <>
      <Header
        title="Sales"
        description="Shopify orders, revenue, and related sales metrics."
      />
      <PagePlaceholder
        title="Sales data is not connected yet"
        description="Order and revenue reporting will appear here after the Shopify integration is added."
      />
    </>
  );
}
