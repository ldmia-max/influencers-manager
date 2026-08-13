import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthRedirect } from "@/components/auth/auth-redirect";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <Suspense fallback={null}>
        <AuthRedirect to="/dashboard" whenAuthenticated={true} />
      </Suspense>
      <main className="text-center px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Influencer Manager
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-md">
          Gestiona perfiles de influencers y UGC creators. Registra redes
          sociales, formatos, precios y categorías.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">Iniciar Sesión</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
