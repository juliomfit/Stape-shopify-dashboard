import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Customers",
};

export default function CustomersPage() {
  return (
    <>
      <Header
        title="Customers"
        description="Shopify customer records and related insights."
      />
      <PagePlaceholder
        title="Customer data is not connected yet"
        description="Customer lists and insights will appear here after Shopify is connected."
      />
    </>
  );
}
