import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

interface AdminAuthenticatedLayoutProps {
  children: React.ReactNode;
}

export async function AdminAuthenticatedLayout({ children }: AdminAuthenticatedLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <>
      <Header user={session.user} />
      <div className="flex">
        <Sidebar role={session.user.role} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </>
  );
}
