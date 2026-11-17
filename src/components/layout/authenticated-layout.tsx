import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MenuSuperior } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <Header user={session.user} />
      <MenuSuperior role={session.user.role} />
      {/* min-w-0: lo que sea mas ancho que la pantalla se desplaza dentro
          de su tarjeta, no arrastra la pagina entera. */}
      <main className="min-w-0 p-4 md:p-6">{children}</main>
    </>
  );
}
