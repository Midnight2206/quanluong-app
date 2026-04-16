import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async (_, { extra, rejectWithValue }) => {
    try {
      return await extra.http.get("/users");
    } catch (error) {
      return rejectWithValue(error.response?.data ?? error.message);
    }
  },
);

const initialState = {
  items: [],
  status: "idle",
  error: null,
};

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    resetUsersState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Unknown error";
      });
  },
});

export const { resetUsersState } = usersSlice.actions;
export const usersReducer = usersSlice.reducer;

export const selectUsers = (state) => state.users.items;
export const selectUsersStatus = (state) => state.users.status;
export const selectUsersError = (state) => state.users.error;
