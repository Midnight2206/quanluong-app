"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/app/query/queryKeys";
import { useWrappedMutation } from "@/lib/useWrappedMutation";
import { apiRequest } from "@/services/apiRequest";

export function useBaLatestProfilesQuery(enabled = true) {
  return useQuery({
    queryKey: qk.baProfiles.latest(),
    queryFn: () => apiRequest({ url: "/ba/admin/unit-profiles", method: "get", skipTargetUnitHeader: true }),
    enabled,
  });
}

export function useBaProfileQuery(id) {
  return useQuery({
    queryKey: qk.baProfiles.detail(id),
    queryFn: () => apiRequest({ url: `/ba/admin/unit-profiles/${id}`, method: "get", skipTargetUnitHeader: true }),
    enabled: Boolean(id),
  });
}

export function useBaTokensQuery(enabled = true) {
  return useQuery({
    queryKey: qk.baProfiles.tokens(),
    queryFn: () => apiRequest({ url: "/ba/tokens", method: "get", skipTargetUnitHeader: true }),
    enabled,
  });
}

export function useCreateBaTokenMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (body) => apiRequest({ url: "/ba/tokens", method: "post", data: body, skipTargetUnitHeader: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.baProfiles.root }),
  });
}

export function useRevokeBaTokenMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: (id) => apiRequest({ url: `/ba/tokens/${id}`, method: "delete", skipTargetUnitHeader: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.baProfiles.root }),
  });
}

const ba = (url, method = "get", data) => apiRequest({ url, method, data, skipTargetUnitHeader: true });

export function useBaBaselineQuery(enabled = true) {
  return useQuery({ queryKey: qk.baProfiles.baseline(), queryFn: () => ba("/ba/baseline"), enabled });
}

export function useBaBaselineVersionsQuery(docKey) {
  return useQuery({
    queryKey: qk.baProfiles.baselineVersions(docKey),
    queryFn: () => ba(`/ba/baseline/${docKey}/versions`),
    enabled: Boolean(docKey),
  });
}

export function useBaBaselineDocQuery(docKey, version) {
  return useQuery({
    queryKey: qk.baProfiles.baselineDoc(docKey, version),
    queryFn: () => ba(`/ba/baseline/${docKey}${version ? `?version=${version}` : ""}`),
    enabled: Boolean(docKey),
  });
}

export function usePublishBaBaselineMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ docKey, ...body }) => ba(`/ba/baseline/${docKey}`, "post", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.baProfiles.root }),
  });
}

export function useBaComparisonQuery(enabled = true) {
  return useQuery({ queryKey: qk.baProfiles.comparison(), queryFn: () => ba("/ba/comparison"), enabled });
}

export function useBaProposalsQuery(status, enabled = true) {
  return useQuery({
    queryKey: qk.baProfiles.proposals(status),
    queryFn: () => ba(`/ba/proposals${status ? `?status=${status}` : ""}`),
    enabled,
  });
}

export function useReviewBaProposalMutation() {
  const qc = useQueryClient();
  return useWrappedMutation({
    mutationFn: ({ id, ...body }) => ba(`/ba/proposals/${id}`, "patch", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.baProfiles.root }),
  });
}
