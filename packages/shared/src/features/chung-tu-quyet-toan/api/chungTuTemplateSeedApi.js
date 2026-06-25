"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/services/apiRequest";
import { useWrappedMutation } from "@/lib/useWrappedMutation";

/** Sao chép mẫu chứng từ từ Drive hệ thống sang Drive của user, rồi refetch cây mẫu. */
export function useSeedChungTuTemplatesMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/templates/seed-from-system",
        method: "post",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chungTuQuyetToan", "templateTree"] });
      qc.invalidateQueries({ queryKey: ["chungTuQuyetToan", "categoryTemplates"] });
    },
  });
}
