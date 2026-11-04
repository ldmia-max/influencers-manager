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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCampaignWizard } from "@/contexts/campaign-wizard-context";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";

export function CampaignStepDetails() {
  const { clients } = useCampaignWizard();
  const formData = useCampaignWizardStore((s) => s.formData);
  const setFormData = useCampaignWizardStore((s) => s.setFormData);
  const clientPopoverOpen = useCampaignWizardStore((s) => s.clientPopoverOpen);
  const setClientPopoverOpen = useCampaignWizardStore((s) => s.setClientPopoverOpen);
  const contactPopoverOpen = useCampaignWizardStore((s) => s.contactPopoverOpen);
  const setContactPopoverOpen = useCampaignWizardStore((s) => s.setContactPopoverOpen);
  const loading = useCampaignWizardStore((s) => s.loading);

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
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
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
        </div>
      </CardContent>
    </Card>
  );
}
