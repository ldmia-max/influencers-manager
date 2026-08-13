"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Bloques reutilizables del formulario de brief. */

export function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-baseline gap-3 border-b border-gray-100 pb-4">
        <span className="text-2xl font-bold text-[#E1145F]">{numero}</span>
        <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function Campo({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-900">
        {label}
        {required && <span className="ml-1 text-[#E1145F]">*</span>}
      </Label>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function CampoTexto({
  label,
  required,
  hint,
  error,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <Campo label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(error && "border-red-500")}
      />
    </Campo>
  );
}

export function CampoArea({
  label,
  required,
  hint,
  error,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <Campo label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(error && "border-red-500")}
      />
    </Campo>
  );
}

/** Grupo de casillas: varias opciones seleccionables */
export function GrupoCheck({
  label,
  required,
  hint,
  error,
  opciones,
  seleccion,
  onChange,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  opciones: string[];
  seleccion: string[];
  onChange: (v: string[]) => void;
}) {
  const alternar = (opcion: string) =>
    onChange(
      seleccion.includes(opcion)
        ? seleccion.filter((o) => o !== opcion)
        : [...seleccion, opcion]
    );

  return (
    <Campo label={label} required={required} hint={hint} error={error}>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {opciones.map((opcion) => (
          <label
            key={opcion}
            className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
          >
            <Checkbox
              checked={seleccion.includes(opcion)}
              onCheckedChange={() => alternar(opcion)}
            />
            {opcion}
          </label>
        ))}
      </div>
    </Campo>
  );
}

/** Grupo de opciones excluyentes */
export function GrupoRadio({
  label,
  required,
  hint,
  error,
  name,
  opciones,
  valor,
  onChange,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  name: string;
  opciones: { value: string; label: string }[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <Campo label={label} required={required} hint={hint} error={error}>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {opciones.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={valor === o.value}
              onChange={(e) => onChange(e.target.value)}
              className="h-4 w-4 accent-[#E1145F]"
            />
            {o.label}
          </label>
        ))}
      </div>
    </Campo>
  );
}
