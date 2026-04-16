import { createApi } from "@reduxjs/toolkit/query/react";
import http from "../../react-http-client/templates/httpClient";
import { createAxiosBaseQuery } from "./axiosBaseQuery";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: createAxiosBaseQuery({ http }),
  tagTypes: ["User"],
  endpoints: () => ({}),
});

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: () => ({
        url: "/users",
        method: "get",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((user) => ({
                type: "User",
                id: user.id,
              })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),
    createUser: builder.mutation({
      query: (payload) => ({
        url: "/users",
        method: "post",
        data: payload,
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
  }),
});

export const { useCreateUserMutation, useGetUsersQuery } = usersApi;
