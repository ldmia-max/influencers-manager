/**
 * Category API services
 */

import { apiPost, apiPut, apiDelete } from "./api";
import type { CreateCategoryPayload, UpdateCategoryPayload } from "@/lib/schemas/category";

// Re-export types from schemas
export type { CreateCategoryPayload, UpdateCategoryPayload };

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type { Category } from "@/models/admin";
import type { Category } from "@/models/admin";

// =============================================================================
// Category Operations
// =============================================================================

/**
 * Create a new category
 */
export async function createCategory(payload: CreateCategoryPayload): Promise<Category> {
  return apiPost<Category>("/api/categories", payload);
}

/**
 * Update a category
 */
export async function updateCategory(id: string, payload: UpdateCategoryPayload): Promise<Category> {
  return apiPut<Category>(`/api/categories/${id}`, payload);
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/categories/${id}`);
}
