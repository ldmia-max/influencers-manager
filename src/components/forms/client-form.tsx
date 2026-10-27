"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateClient, useUpdateClient } from "@/hooks/mutations/use-client-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";

interface ClientContact {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  position: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface ClientFormData {
  id?: string;
  companyName: string;
  nit: string;
  email: string;
  contacts: ClientContact[];
}

interface ClientFormProps {
  initialData?: ClientFormData;
}

export function ClientForm({ initialData }: ClientFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<ClientFormData>(
    initialData || {
      companyName: "",
      nit: "",
      email: "",
      contacts: [
        {
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          position: "",
          isPrimary: true,
          isActive: true,
        },
      ],
    }
  );

  const [validationError, setValidationError] = useState("");

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const mutation = initialData?.id ? updateMutation : createMutation;
  const loading = mutation.isPending;
  const error = validationError || mutation.error?.message || "";

  const onSuccess = () => {
    router.push("/clients");
    router.refresh();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      companyName: formData.companyName,
      nit: formData.nit,
      email: formData.email,
      contacts: formData.contacts,
    };

    if (initialData?.id) {
      updateMutation.mutate({ clientId: initialData.id, payload }, { onSuccess });
    } else {
      createMutation.mutate(payload, { onSuccess });
    }
  };

  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [
        ...formData.contacts,
        {
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          position: "",
          isPrimary: false,
          isActive: true,
        },
      ],
    });
  };

  const removeContact = (index: number) => {
    if (formData.contacts.length === 1) {
      setValidationError("Debe haber al menos un contacto");
      return;
    }
    const newContacts = formData.contacts.filter((_, i) => i !== index);
    setFormData({ ...formData, contacts: newContacts });
  };

  const updateContact = (index: number, field: keyof ClientContact, value: string | boolean) => {
    const newContacts = [...formData.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };

    // If setting as primary, unset others
    if (field === "isPrimary" && value === true) {
      newContacts.forEach((contact, i) => {
        if (i !== index) {
          contact.isPrimary = false;
        }
      });
    }

    // Desactivar a alguien es decir que ya no trabaja en la empresa, así
    // que deja de ser a quien se llama y el puesto pasa al primero que
    // siga activo. Sin ninguno activo la empresa no tendría a quién
    // elegir al crear una campaña: el servidor también lo rechaza, pero
    // aquí se avisa antes de guardar.
    if (field === "isActive" && value === false) {
      const quedaOtro = newContacts.some((c, i) => i !== index && c.isActive);

      if (!quedaOtro) {
        setValidationError(
          "Debe quedar al menos un contacto activo: es a quien se elige al crear una campaña."
        );
        return;
      }

      newContacts[index] = { ...newContacts[index], isPrimary: false };

      if (!newContacts.some((c) => c.isPrimary)) {
        const relevo = newContacts.findIndex((c) => c.isActive);
        newContacts[relevo] = { ...newContacts[relevo], isPrimary: true };
      }
    }

    setValidationError("");
    setFormData({ ...formData, contacts: newContacts });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información de la Empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">
                Nombre de la Empresa <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) =>
                  setFormData({ ...formData, companyName: e.target.value })
                }
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nit">NIT</Label>
              <Input
                id="nit"
                value={formData.nit}
                onChange={(e) =>
                  setFormData({ ...formData, nit: e.target.value })
                }
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email de la Empresa <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contactos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Contactos</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addContact}
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Contacto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {formData.contacts.map((contact, index) => (
            <div
              key={index}
              className={`p-4 border rounded-lg space-y-4 relative ${
                contact.isActive ? "" : "border-dashed bg-gray-50"
              }`}
            >
              {formData.contacts.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removeContact(index)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              )}

              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-4 pr-10">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={contact.isPrimary}
                    onCheckedChange={(checked) =>
                      updateContact(index, "isPrimary", checked)
                    }
                    disabled={loading || !contact.isActive}
                  />
                  <Label>Contacto Principal</Label>
                </div>

                {/* El contacto de una campaña no se puede borrar —esa
                    campaña guarda quién la aprobó—, así que a quien se
                    va de la empresa se le desactiva: desaparece del
                    selector de contacto y su historia sigue en pie. */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={contact.isActive}
                    onCheckedChange={(checked) =>
                      updateContact(index, "isActive", checked)
                    }
                    disabled={loading}
                  />
                  <Label>Activo</Label>
                </div>
              </div>

              {!contact.isActive && (
                <p className="-mt-2 text-xs text-gray-500">
                  No aparecerá al crear campañas. Las campañas que ya son
                  suyas conservan su nombre.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Nombre <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={contact.firstName}
                    onChange={(e) =>
                      updateContact(index, "firstName", e.target.value)
                    }
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Apellido <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={contact.lastName}
                    onChange={(e) =>
                      updateContact(index, "lastName", e.target.value)
                    }
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={contact.phone}
                    onChange={(e) =>
                      updateContact(index, "phone", e.target.value)
                    }
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) =>
                      updateContact(index, "email", e.target.value)
                    }
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={contact.position}
                    onChange={(e) =>
                      updateContact(index, "position", e.target.value)
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          ))}
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
          onClick={() => router.push("/clients")}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : initialData?.id ? "Actualizar" : "Crear Cliente"}
        </Button>
      </div>
    </form>
  );
}
