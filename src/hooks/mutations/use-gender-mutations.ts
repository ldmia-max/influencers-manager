import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createGender } from "@/services/gender";
import type { Gender } from "@/services/gender";

export function useCreateGender() {
  const queryClient = useQueryClient();

  return useMutation<Gender, Error, string>({
    mutationFn: (name) => createGender(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.genders.all });
    },
  });
}
