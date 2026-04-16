export const selectEntityItems = (state) => state.entities.items;

export const selectActiveEntityItems = (state) =>
  selectEntityItems(state).filter((item) => item.isActive);

export const selectEntityOptions = (state) =>
  selectActiveEntityItems(state).map((item) => ({
    label: item.name,
    value: item.id,
  }));
