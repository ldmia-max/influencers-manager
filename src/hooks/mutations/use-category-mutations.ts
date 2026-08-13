import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/services/category";
import type {
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from "@/services/category";

// =============================================================================
// Create Category
// =============================================================================

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<Category, Error, CreateCategoryPayload>({
    mutationFn: (payload) => createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      router.refresh();
    },
  });
}

// =============================================================================
// Update Category
// =============================================================================

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<
    Category,
    Error,
    { id: string; payload: UpdateCategoryPayload }
  >({
    mutationFn: ({ id, payload }) => updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      router.refresh();
    },
  });
}

// =============================================================================
// Delete Category
// =============================================================================

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      router.refresh();
    },
  });
}
