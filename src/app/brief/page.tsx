import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { getCachedCategories } from "@/data-access/categories";
import { BriefForm } from "@/components/brief/brief-form";

const sora = Sora({ subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Brief de campaña con creadores de contenido | Los De Marketing",
  description:
    "Completa este formulario para que podamos preparar tu campaña con creadores de contenido.",
};

/**
 * Pagina PUBLICA del brief de campana.
 *
 * Vive fuera de los grupos (app) y (auth), y no figura en RUTAS_PRIVADAS
 * de auth.config.ts, por lo que es accesible sin sesion.
 * URL: /brief
 *
 * Los dos banners superiores reproducen la portada de la plantilla
 * original. Se omiten los campos Marca y Fecha de la portada: al ser un
 * formulario digital, la marca se recoge en el punto 01 y la fecha se
 * registra sola al enviarlo.
 */
export default async function BriefPage() {
  const categorias = await getCachedCategories();

  const nichos = categorias
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.name, label: c.name }));
  // "Otro" siempre al final, no viene de la base de datos
  nichos.push({ value: "Otro", label: "Otro" });

  return (
    <main className="min-h-screen bg-[#faf9f5] py-8 px-4 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* ---------- Banner 1: portada ---------- */}
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-7 text-white sm:px-8 sm:py-8"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(90,0,35,.28), rgba(90,0,35,.42)), url('/brief/hero.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#E1145F",
          }}
        >
          <div className="mb-7 flex items-start justify-between gap-5">
            <div
              className="text-[15px] font-extrabold leading-none tracking-tight sm:text-base"
              style={{ fontFamily: sora.style.fontFamily }}
            >
              los de
              <br />
              marketing
            </div>
            <div
              className="text-right text-[9.5px] font-bold uppercase leading-relaxed tracking-[0.14em]"
              style={{ fontFamily: sora.style.fontFamily }}
            >
              Documento para diligenciar
              <br />
              <span className="text-white/70">Confidencial</span>
            </div>
          </div>

          <h1
            className="m-0 text-[28px] font-extrabold leading-[1.05] tracking-tight sm:text-[34px]"
            style={{
              fontFamily: sora.style.fontFamily,
              textShadow: "0 1px 12px rgba(80,0,30,.35)",
            }}
          >
            Brief de campaña
            <br />
            con{" "}
            <em className="not-italic italic text-[#FFBFD7]">
              creadores de contenido
            </em>
          </h1>

          <p className="mt-3 max-w-[80%] text-[12.5px] leading-relaxed text-white/90 sm:text-[13px]">
            Completa este formulario y envíalo a tu equipo de cuenta. Entre más
            específico sea el brief, menos rondas de ajuste habrá después.
          </p>
        </div>

        {/* ---------- Banner 2: cómo completarlo ---------- */}
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#FFD3E5] bg-[#FFF0F6] px-4 py-4 sm:flex-row sm:gap-4 sm:px-5">
          <div
            className="whitespace-nowrap pt-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#FF2E88]"
            style={{ fontFamily: sora.style.fontFamily }}
          >
            Cómo <br className="hidden sm:block" />
            completarlo
          </div>
          <ul className="m-0 list-disc space-y-1 pl-5 text-[11.5px] leading-[1.65] text-[#3A3A46] sm:columns-2 sm:gap-x-6 sm:space-y-0">
            <li>Completa los campos directamente en esta página.</li>
            <li>
              Los campos marcados con <span className="text-[#FF2E88]">*</span>{" "}
              son obligatorios.
            </li>
            <li>
              Si un dato no está definido, escribe <strong>«Por definir»</strong>.
            </li>
            <li>Adjunta los materiales de apoyo en el punto 08.</li>
          </ul>
        </div>

        <div className="mt-8">
          {/* Con token de Blob (Vercel) los adjuntos se suben directos
              desde el navegador, esquivando el limite de 4.5 MB por
              peticion. Sin token (local y OVH) viajan en el POST. */}
          <BriefForm
            nichos={nichos}
            blobHabilitado={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
          />
        </div>

        <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">
          <p>¿Dudas? Escríbenos a nayibe.gomez@losdemarketing.com</p>
          <p className="mt-1">Carrera 42 No. 14 – 11, of. 105 · Medellín</p>
        </footer>
      </div>
    </main>
  );
}
