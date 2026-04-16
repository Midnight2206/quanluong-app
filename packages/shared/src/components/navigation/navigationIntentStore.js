import { create } from "zustand";

/**
 * Trạng thái "đang điều hướng" bật đồng bộ khi click (trước khi pathname kịp đổi),
 * để thanh progress / skeleton không bị trễ 2–3s lần đầu tải chunk.
 */
export const useNavigationIntentStore = create((set) => ({
  intent: false,
  startIntent: () => set({ intent: true }),
  clearIntent: () => set({ intent: false }),
}));

export function startNavigationIntent() {
  useNavigationIntentStore.getState().startIntent();
}

export function clearNavigationIntent() {
  useNavigationIntentStore.getState().clearIntent();
}
