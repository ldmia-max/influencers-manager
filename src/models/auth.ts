// =============================================================================
// Authentication result types (single source of truth)
// =============================================================================

export interface ClientLoginResult {
  success: boolean;
  redirectUrl?: string;
  message?: string;
}
