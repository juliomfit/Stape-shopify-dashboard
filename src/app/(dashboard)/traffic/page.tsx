import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "Traffic",
};

export default function TrafficPage() {
  return (
    <>
      <Header
        title="Traffic"
        description="Server-side tracking and traffic sources from Stape."
      />
      <PagePlaceholder
        title="Traffic data is not connected yet"
        description="Sessions, sources, and related tracking metrics will appear here after Stape is connected."
      />
    </>
  );
}
