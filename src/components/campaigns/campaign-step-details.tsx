"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PriceInput } from "@/components/ui/price-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCampaignWizard } from "@/contexts/campaign-wizard-context";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";
import {
  MESES_DEL_ANO,
  aniosSeleccionables,
  periodoDeImputacion,
} from "@/lib/campaign-utils";
import { useRef } from "react";

export function CampaignStepDetails() {
  const { clients, currentStatus } = useCampaignWizard();
  const formData = useCampaignWizardStore((s) => s.formData);
  const setFormData = useCampaignWizardStore((s) => s.setFormData);
  const clientPopoverOpen = useCampaignWizardStore((s) => s.clientPopoverOpen);
  const setClientPopoverOpen = useCampaignWizardStore((s) => s.setClientPopoverOpen);
  const contactPopoverOpen = useCampaignWizardStore((s) => s.contactPopoverOpen);
  const setContactPopoverOpen = useCampaignWizardStore((s) => s.setContactPopoverOpen);
  const loading = useCampaignWizardStore((s) => s.loading);

  /**
   * Si alguien ya eligio el periodo a mano.
   *
   * Un ref y no estado: no cambia nada de lo que se pinta, solo decide
   * si la fecha de inicio puede seguir arrastrando el mes. Al abrir una
   * campana guardada arranca en true, porque el periodo que trae ya es
   * una decision tomada y mover la fecha de inicio no debe deshacerla.
   */
  const periodoTocado = useRef<boolean>(Boolean(formData.id));

  const selectedClient = clients.find((c) => c.id === formData.clientId);

  // Quien ya no trabaja en la empresa no se puede borrar —sus campañas
  // guardan quién las aprobó—, se desactiva. Aquí desaparece, salvo que
  // sea justo el contacto que esta campaña ya tenía guardado: quitárselo
  // de la lista abriría la campaña sin contacto y el primer guardado lo
  // perdería.
  const todosLosContactos = selectedClient?.contacts || [];
  const availableContacts = todosLosContactos.filter(
    (c) => c.isActive || c.id === formData.clientContactId
  );

  // El principal siempre puede aprobar: encabeza la ficha y firma los
  // correos, asi que no tendria sentido que no pudiera revisar lo que
  // lleva su nombre. El servidor lo mete igualmente; aqui se muestra
  // marcado y sin poder quitarse, para que nadie lo intente.
  const aprobadores = new Set(
    [formData.clientContactId, ...formData.clientContactIds].filter(Boolean)
  );

  const alternarAprobador = (id: string) => {
    if (id === formData.clientContactId) return;
    const siguiente = new Set(aprobadores);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    setFormData({ ...formData, clientContactIds: [...siguiente] });
  };

  const elegirPrincipal = (id: string) => {
    setFormData({
      ...formData,
      clientContactId: id,
      clientContactIds: [...new Set([id, ...formData.clientContactIds])],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la Campaña</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Nombre <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={loading}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Cliente <span className="text-red-500">*</span>
            </Label>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  disabled={loading}
                >
                  {selectedClient?.companyName || "Seleccionar cliente..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.companyName}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              clientId: client.id,
                              clientContactId: "",
                              clientContactIds: [],
                            });
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.clientId === client.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {client.companyName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>
              Contacto principal <span className="text-red-500">*</span>
            </Label>
            <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  disabled={loading || !formData.clientId}
                >
                  {formData.clientContactId
                    ? (() => {
                        const contact = availableContacts.find(
                          (c) => c.id === formData.clientContactId
                        );
                        return contact
                          ? `${contact.firstName} ${contact.lastName}`
                          : "Seleccionar...";
                      })()
                    : "Seleccionar contacto..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar contacto..." />
                  <CommandList>
                    <CommandEmpty>No hay contactos.</CommandEmpty>
                    <CommandGroup>
                      {availableContacts.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          value={`${contact.firstName} ${contact.lastName}`}
                          onSelect={() => {
                            elegirPrincipal(contact.id);
                            setContactPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.clientContactId === contact.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {contact.firstName} {contact.lastName}
                          {!contact.isActive && (
                            <span className="ml-2 text-xs text-gray-500">
                              (inactivo)
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Quien puede aprobar.
            Aparece solo con cliente elegido y con mas de un contacto:
            con uno solo no hay nada que decidir y seria una fila vacia
            pidiendo atencion. */}
        {formData.clientId && availableContacts.length > 1 && (
          <div className="space-y-2 rounded-md border bg-gray-50/60 p-3">
            <div>
              <Label>Quién puede aprobar esta campaña</Label>
              <p className="mt-0.5 text-xs text-gray-500">
                Cada uno recibirá su propio enlace al enviarla a revisión, y
                solo ellos verán la campaña en el portal.
              </p>
              {/* La campana ya salio: los enlaces se emitieron al
                  enviarla, asi que quien se sume ahora no tiene ninguno.
                  Decir donde se consigue evita el "lo agregue y no le
                  llego nada". */}
              {(currentStatus === "REVIEW" || currentStatus === "ACTIVE") && (
                <p className="mt-1 text-xs text-amber-700">
                  Esta campaña ya se envió: quien añadas ahora verá la campaña
                  en su portal, pero su enlace de aprobación se genera desde la
                  pestaña Revisiones.
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableContacts.map((contact) => {
                const esPrincipal = contact.id === formData.clientContactId;
                const marcado = aprobadores.has(contact.id);
                return (
                  <label
                    key={contact.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border bg-white p-2 text-sm",
                      esPrincipal
                        ? "cursor-default border-gray-200"
                        : "cursor-pointer hover:border-gray-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-gray-900"
                      checked={marcado}
                      disabled={loading || esPrincipal}
                      onChange={() => alternarAprobador(contact.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-800">
                        {contact.firstName} {contact.lastName}
                        {esPrincipal && (
                          <span className="ml-1 text-xs font-normal text-gray-500">
                            (principal)
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {contact.email}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              Presupuesto (COP) <span className="text-red-500">*</span>
            </Label>
            <PriceInput
              value={formData.budget}
              onChange={(value) => setFormData({ ...formData, budget: value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha Inicio</Label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => {
                const startDate = e.target.value;
                // El periodo sigue a la fecha de inicio mientras nadie
                // lo haya elegido a mano. En cuanto se toca deja de
                // moverse: lo contrario seria borrar una decision.
                if (periodoTocado.current || !startDate) {
                  setFormData({ ...formData, startDate });
                  return;
                }
                const p = periodoDeImputacion(`${startDate}T12:00:00Z`);
                setFormData({
                  ...formData,
                  startDate,
                  mes: String(p.mes),
                  anio: String(p.anio),
                });
              }}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha Fin</Label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              disabled={loading}
            />
          </div>

          {/*
            Mes y año NO son las fechas de ejecución.
            Son el periodo con cuyo presupuesto se paga la campaña, que
            es con lo que contabilidad agrupa y cuadra el gasto. Una
            campaña del 28 de octubre al 15 de noviembre sale del sobre
            de uno de los dos meses, y eso lo decide mercadeo.

            Se mueven solos con la fecha de inicio hasta que alguien los
            toca a mano: a partir de ahí mandan ellos, porque cambiar
            después la fecha de inicio no debe deshacer una decisión
            deliberada sobre de dónde sale el dinero.
          */}
          <div className="space-y-2">
            <Label>
              Mes <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.mes}
              onValueChange={(v) => {
                periodoTocado.current = true;
                setFormData({ ...formData, mes: v });
              }}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MESES_DEL_ANO.map((nombre, i) => (
                  <SelectItem key={nombre} value={String(i + 1)}>
                    {nombre[0].toUpperCase() + nombre.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Año <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.anio}
              onValueChange={(v) => {
                periodoTocado.current = true;
                setFormData({ ...formData, anio: v });
              }}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {aniosSeleccionables(Number(formData.anio) || null).map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Mes y año son el periodo con cuyo presupuesto se paga esta campaña —
          con eso agrupa contabilidad—, y no tienen por qué coincidir con las
          fechas de inicio y fin.
        </p>
      </CardContent>
    </Card>
  );
}
