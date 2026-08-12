import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Products",
};

export default function ProductsPage() {
  return (
    <>
      <Header
        title="Products"
        description="Shopify catalog and product performance."
      />
      <PagePlaceholder
        title="Product data is not connected yet"
        description="Product listings and performance will appear here after Shopify is connected."
      />
    </>
  );
}
