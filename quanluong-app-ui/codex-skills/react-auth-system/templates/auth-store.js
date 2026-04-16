import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  status: "unknown",
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthLoading: (state) => {
      state.status = "loading";
    },
    setAuthenticatedUser: (state, action) => {
      state.status = "authenticated";
      state.user = action.payload;
    },
    clearAuth: () => initialState,
    setUnauthenticated: (state) => {
      state.status = "unauthenticated";
      state.user = null;
    },
  },
});

export const {
  clearAuth,
  setAuthenticatedUser,
  setAuthLoading,
  setUnauthenticated,
} = authSlice.actions;

export const authReducer = authSlice.reducer;

export const selectAuthStatus = (state) => state.auth.status;
export const selectCurrentUser = (state) => state.auth.user;
