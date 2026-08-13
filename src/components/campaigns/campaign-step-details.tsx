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
  const availableContacts = selectedClient?.contacts || [];

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
              Contacto <span className="text-red-500">*</span>
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
                            setFormData({ ...formData, clientContactId: contact.id });
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
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

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
