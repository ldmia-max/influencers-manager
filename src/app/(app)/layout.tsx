import { Suspense } from "react";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { LayoutSkeleton } from "@/components/layout/layout-skeleton";
import { CartWrapper } from "@/components/cart";
import { QueryProvider } from "@/providers/query-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <QueryProvider>
        <CartWrapper>
          <Suspense fallback={<LayoutSkeleton />}>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </Suspense>
        </CartWrapper>
      </QueryProvider>
    </div>
  );
}
