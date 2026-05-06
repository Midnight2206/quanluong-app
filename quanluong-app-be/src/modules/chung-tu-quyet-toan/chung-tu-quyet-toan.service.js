async function getChungTuQuyetToanHealth({ user, unitScope, effectiveUnitIds }) {
  return {
    status: "ok",
    module: "chungtuquyettoan",
    serverTime: new Date().toISOString(),
    actor: {
      userId: user?.id ?? null,
      type: user?.type?.name ?? null,
    },
    scope: {
      selectedUnitId: unitScope?.selectedUnitId ?? null,
      allUnits: unitScope?.all === true,
      effectiveUnitIds: Array.isArray(effectiveUnitIds) ? effectiveUnitIds : [],
    },
  };
}

export { getChungTuQuyetToanHealth };
