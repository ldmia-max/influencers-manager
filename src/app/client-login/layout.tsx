import { QueryProvider } from "@/providers/query-provider";

export default function ClientLoginLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
