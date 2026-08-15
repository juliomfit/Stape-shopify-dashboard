import { DashboardFrame } from "@/components/layout/DashboardFrame";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardFrame>{children}</DashboardFrame>;
}
