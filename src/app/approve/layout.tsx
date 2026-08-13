import { QueryProvider } from "@/providers/query-provider";

export default function ApproveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QueryProvider>{children}</QueryProvider>;
}
