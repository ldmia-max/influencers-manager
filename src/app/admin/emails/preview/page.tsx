import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  campaignReviewTemplate,
  tokenRegeneratedTemplate,
  campaignApprovedTemplate,
  campaignRejectedTemplate,
} from "@/lib/emails/templates";

async function EmailPreviewContent() {
  await connection();
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Datos de ejemplo para previsualización
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const template1 = campaignReviewTemplate({
    contactName: "María García",
    campaignName: "Campaña Navideña 2026",
    companyName: "Tech Solutions S.A.",
    approvalUrl: `${baseUrl}/client/campaigns/preview/example-token`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
  });

  const template2 = tokenRegeneratedTemplate({
    contactName: "María García",
    campaignName: "Campaña Navideña 2026",
    approvalUrl: `${baseUrl}/client/campaigns/preview/example-token`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const template3 = campaignApprovedTemplate({
    campaignName: "Campaña Navideña 2026",
    clientName: "Tech Solutions S.A.",
    contactName: "María García",
    approvedProfiles: 5,
    totalProfiles: 5,
    campaignUrl: `${baseUrl}/admin/campaigns/example-id`,
  });

  const template4 = campaignRejectedTemplate({
    campaignName: "Campaña Navideña 2026",
    clientName: "Tech Solutions S.A.",
    contactName: "María García",
    approvedProfiles: 3,
    rejectedProfiles: 2,
    totalProfiles: 5,
    rejectionDetails: [
      {
        profileName: "Ana Martínez (@anamartinez)",
        reason: "El contenido no se alinea con nuestra marca",
      },
      {
        profileName: "Carlos López (@carloslopez)",
        reason: "Preferimos influencers con más seguidores",
      },
    ],
    campaignUrl: `${baseUrl}/admin/campaigns/example-id`,
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Previsualización de Emails</h1>

      {/* Template 1: Campaña enviada a revisión */}
      <section className="mb-12">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-2">
            1. Campaña enviada a revisión (Cliente)
          </h2>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Subject:</strong> {template1.subject}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Enviado cuando el admin envía una campaña a revisión del cliente.
          </p>
          <iframe
            srcDoc={template1.html}
            className="w-full border rounded"
            style={{ height: "600px" }}
            title="Email Preview 1"
          />
        </div>
      </section>

      {/* Template 2: Token regenerado */}
      <section className="mb-12">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-2">
            2. Token regenerado (Cliente)
          </h2>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Subject:</strong> {template2.subject}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Enviado cuando el admin regenera el token de aprobación para el
            cliente.
          </p>
          <iframe
            srcDoc={template2.html}
            className="w-full border rounded"
            style={{ height: "600px" }}
            title="Email Preview 2"
          />
        </div>
      </section>

      {/* Template 3: Campaña aprobada */}
      <section className="mb-12">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-2">
            3. Campaña aprobada (Admin)
          </h2>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Subject:</strong> {template3.subject}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Enviado al admin cuando el cliente aprueba todos los perfiles de la
            campaña.
          </p>
          <iframe
            srcDoc={template3.html}
            className="w-full border rounded"
            style={{ height: "600px" }}
            title="Email Preview 3"
          />
        </div>
      </section>

      {/* Template 4: Campaña con rechazos */}
      <section className="mb-12">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="text-xl font-semibold mb-2">
            4. Campaña con rechazos (Admin)
          </h2>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Subject:</strong> {template4.subject}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Enviado al admin cuando el cliente rechaza algunos perfiles de la
            campaña.
          </p>
          <iframe
            srcDoc={template4.html}
            className="w-full border rounded"
            style={{ height: "700px" }}
            title="Email Preview 4"
          />
        </div>
      </section>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> Esta es una previsualización con datos de
          ejemplo. Los emails reales se generarán con los datos de las campañas
          y clientes actuales.
        </p>
      </div>
    </div>
  );
}

export default function EmailPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-8 px-4">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando previsualización...</p>
            </div>
          </div>
        </div>
      }
    >
      <EmailPreviewContent />
    </Suspense>
  );
}
