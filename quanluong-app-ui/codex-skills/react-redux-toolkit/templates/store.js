import { configureStore } from "@reduxjs/toolkit";

export const createStore = ({ api, reducers = {}, middleware = [] } = {}) => {
  return configureStore({
    reducer: {
      ...(api
        ? {
            [api.reducerPath]: api.reducer,
          }
        : {}),
      ...reducers,
    },
    middleware: (getDefaultMiddleware) => {
      const defaultMiddleware = getDefaultMiddleware();

      if (!api) {
        return defaultMiddleware.concat(middleware);
      }

      return defaultMiddleware.concat(api.middleware, middleware);
    },
    devTools: import.meta.env.DEV,
  });
};
