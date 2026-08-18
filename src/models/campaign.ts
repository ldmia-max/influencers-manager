import type { CampaignStatus } from "@prisma/client";

// =============================================================================
// Client Types
// =============================================================================

export interface ClientContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Client {
  id: string;
  companyName: string;
  contacts: ClientContact[];
}

// =============================================================================
// Campaign Data Types
// =============================================================================

export interface CampaignData {
  id?: string;
  name: string;
  description: string;
  clientId: string;
  clientContactId: string;
  budget: string;
  startDate: string;
  endDate: string;
}

// =============================================================================
// Profile Types
// =============================================================================

export interface SocialPlatform {
  id: string;
  name: string;
  displayName: string;
}

export interface ServiceType {
  id: string;
  name: string;
  displayName: string;
}

export interface ProfileService {
  id: string;
  price: number | string;
  serviceType: ServiceType;
}

export interface SocialAccount {
  id: string;
  username: string;
  followers?: number | null;
  profilePicUrl?: string | null;
  platform: SocialPlatform;
  services: ProfileService[];
}

export interface ProfileCategory {
  category: {
    id: string;
    name: string;
  };
}

export interface ProfileGender {
  id: string;
  name: string;
  displayName: string;
}

export interface ProfileCountry {
  id: string;
  name: string;
  code: string;
}

export interface ProfileDepartment {
  id: string;
  name: string;
  code: string | null;
}

export interface ProfileCity {
  id: string;
  name: string;
}

export interface ProfileWithServices {
  id: string;
  name: string;
  type: string;
  countryId?: string | null;
  departmentId?: string | null;
  cityId?: string | null;
  country?: ProfileCountry | null;
  department?: ProfileDepartment | null;
  city?: ProfileCity | null;
  gender?: ProfileGender | null;
  socialAccounts: SocialAccount[];
  categories: ProfileCategory[];
}

// =============================================================================
// Configuration Types (re-exported from platform-service-selector)
// =============================================================================

export interface ServiceConfig {
  /** Ausente en los combos: no salen del tarifario del influencer. */
  profileServiceId: string | null;
  serviceTypeId: string;
  serviceName: string;
  /** Los combos van siempre con 1: son un acuerdo cerrado, no unidades. */
  quantity: number;
  basePrice: number;
  esCombo?: boolean;
  /** Que incluye el combo, en texto libre. */
  comboDescripcion?: string;
}

export interface PlatformConfig {
  socialAccountId: string;
  platformId: string;
  platformName: string;
  username: string;
  selected: boolean;
  services: ServiceConfig[];
}

export interface ProfileConfig {
  profileId: string;
  profileName: string;
  platforms: PlatformConfig[];
}

// =============================================================================
// Wizard Types
// =============================================================================

export type WizardStep = 1 | 2 | 3;

export const WIZARD_STEPS = [
  { step: 1, label: "Detalles", description: "Informacion de la campana" },
  { step: 2, label: "Perfiles", description: "Seleccionar y configurar" },
  { step: 3, label: "Resumen", description: "Revisar y enviar" },
] as const;

export const PROFILE_TYPES = [
  { value: "INFLUENCER", label: "Influencer" },
  { value: "UGC", label: "UGC Creator" },
  { value: "BOTH", label: "Ambos" },
] as const;

// =============================================================================
// API Response Types
// =============================================================================

export interface CreateCampaignResponse {
  id: string;
  name: string;
  status: CampaignStatus;
}

export interface UpdateStatusResponse {
  id: string;
  status: CampaignStatus;
  approvalUrl?: string;
  /**
   * Resultado del correo al cliente en la transicion a REVIEW. Ausente
   * en las demas transiciones, que no mandan nada. Si sent es false el
   * cambio de estado SI se hizo: solo fallo el aviso, y el enlace de
   * aprobacion sigue sirviendo para pasarselo al cliente a mano.
   */
  email?: { sent: boolean; reason?: string; error?: string };
  emailRecipient?: string;
}

export interface RegenerateTokenResponse {
  token: {
    id: string;
    token: string;
    expiresAt: string;
  };
  approvalUrl: string;
}

export interface ApprovalToken {
  id: string;
  token: string;
  expiresAt: Date | string;
  usedAt: Date | string | null;
  createdAt: Date | string;
  sentToEmail: string;
  sentToName: string | null;
}

export interface CampaignFormData {
  name: string;
  description: string;
  clientId: string;
  clientContactId: string;
  budget: string;
  startDate: string;
  endDate: string;
}

export interface CampaignDetail {
  id: string;
  name: string;
  description: string | null;
  budget: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  client: {
    id: string;
    companyName: string;
  };
  clientContact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  profiles: Array<{
    id: string;
    status: string;
    profile: {
      id: string;
      name: string;
      type: string;
    };
    platforms: Array<{
      id: string;
      socialAccount: {
        id: string;
        username: string;
        followers: number | null;
        platform: {
          id: string;
          name: string;
          displayName: string;
        };
      };
      services: Array<{
        id: string;
        quantity: number;
        basePrice: string;
        totalPrice: string;
        serviceType: {
          id: string;
          name: string;
          displayName: string;
        };
      }>;
    }>;
  }>;
}

// =============================================================================
// Editor Props Types
// =============================================================================

export interface CampaignEditorProps {
  campaignId?: string;
  initialData: CampaignData;
  clients: Client[];
  profiles: ProfileWithServices[];
  existingProfileIds?: string[];
  existingConfig?: ProfileConfig[];
  currentStatus?: CampaignStatus;
  /**
   * Margen congelado de la campana que se edita. Se omite al crear una
   * nueva, que usa el global por defecto. Sin esto, editar una campana
   * antigua mostraria precios distintos a los que aprobo el cliente.
   */
  markup?: number;
  onSaveSuccess?: () => void;
}
