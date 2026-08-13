"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreateCampaign, useUpdateCampaign } from "@/hooks/mutations/use-campaign-mutations";
import { buildCampaignPayload } from "@/services/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Client {
  id: string;
  companyName: string;
  contacts: ClientContact[];
}

interface ClientContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CampaignFormData {
  id?: string;
  name: string;
  description: string;
  clientId: string;
  clientContactId: string;
  budget: string;
  startDate: string;
  endDate: string;
}

interface CampaignFormProps {
  initialData?: CampaignFormData;
  clients: Client[];
}

export function CampaignForm({ initialData, clients }: CampaignFormProps) {
  const router = useRouter();
  const [validationError, setValidationError] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  const [formData, setFormData] = useState<CampaignFormData>(
    initialData || {
      name: "",
      description: "",
      clientId: "",
      clientContactId: "",
      budget: "",
      startDate: "",
      endDate: "",
    }
  );

  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();
  const mutation = initialData?.id ? updateMutation : createMutation;
  const loading = mutation.isPending;

  // Obtener contactos del cliente seleccionado
  const selectedClient = clients.find((c) => c.id === formData.clientId);
  const availableContacts = selectedClient?.contacts || [];

  // Resetear contacto si cambia el cliente
  useEffect(() => {
    if (formData.clientId && selectedClient) {
      // Si el contacto actual no pertenece al cliente, resetear
      const contactBelongs = availableContacts.some(
        (c) => c.id === formData.clientContactId
      );
      if (!contactBelongs) {
        setFormData((prev) => ({ ...prev, clientContactId: "" }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset contact when clientId changes
  }, [formData.clientId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // Validaciones
    if (!formData.name.trim()) {
      setValidationError("El nombre es requerido");
      return;
    }
    if (!formData.clientId) {
      setValidationError("Seleccione un cliente");
      return;
    }
    if (!formData.clientContactId) {
      setValidationError("Seleccione un contacto");
      return;
    }
    if (!formData.budget || parseInt(formData.budget, 10) <= 0) {
      setValidationError("El presupuesto debe ser mayor a 0");
      return;
    }

    const payload = buildCampaignPayload(formData);

    if (initialData?.id) {
      updateMutation.mutate(
        { campaignId: initialData.id, payload },
        {
          onSuccess: () => {
            router.push("/campaigns");
            router.refresh();
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          router.push(`/campaigns/${data.id}/edit`);
          router.refresh();
        },
      });
    }
  };

  const error = validationError || mutation.error?.message || "";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la Campaña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre de la Campaña <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ej: Campaña Navidad 2025"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descripción opcional de la campaña..."
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selector de Cliente */}
            <div className="space-y-2">
              <Label>
                Cliente <span className="text-red-500">*</span>
              </Label>
              <Popover
                open={clientPopoverOpen}
                onOpenChange={setClientPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientPopoverOpen}
                    className="w-full justify-between"
                    disabled={loading}
                  >
                    {selectedClient
                      ? selectedClient.companyName
                      : "Seleccionar cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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

            {/* Selector de Contacto */}
            <div className="space-y-2">
              <Label>
                Contacto <span className="text-red-500">*</span>
              </Label>
              <Popover
                open={contactPopoverOpen}
                onOpenChange={setContactPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={contactPopoverOpen}
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
                            : "Seleccionar contacto...";
                        })()
                      : "Seleccionar contacto..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar contacto..." />
                    <CommandList>
                      <CommandEmpty>No hay contactos disponibles.</CommandEmpty>
                      <CommandGroup>
                        {availableContacts.map((contact) => (
                          <CommandItem
                            key={contact.id}
                            value={`${contact.firstName} ${contact.lastName}`}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                clientContactId: contact.id,
                              });
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
                            <div>
                              <div>
                                {contact.firstName} {contact.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {contact.email}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">
              Presupuesto (COP) <span className="text-red-500">*</span>
            </Label>
            <PriceInput
              value={formData.budget}
              onChange={(value) =>
                setFormData({ ...formData, budget: value })
              }
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                disabled={loading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/campaigns")}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? "Guardando..."
            : initialData?.id
            ? "Actualizar"
            : "Continuar"}
        </Button>
      </div>
    </form>
  );
}
