import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Conversions",
};

export default function ConversionsPage() {
  return (
    <>
      <Header
        title="Conversions"
        description="Purchase and event conversion performance."
      />
      <PagePlaceholder
        title="Conversion data is not connected yet"
        description="Conversion events will appear here once Shopify and Stape data can be compared."
      />
    </>
  );
}
