import http from "../../react-http-client/templates/httpClient";

const mapUser = (payload) => ({
  id: payload.id,
  fullName: payload.full_name,
  email: payload.email,
  role: payload.role_name,
});

export const usersApi = {
  list: async (params) => {
    const response = await http.get("/users", { params });
    return {
      items: response.items.map(mapUser),
      total: response.total,
    };
  },
  create: async (payload) => {
    const response = await http.post("/users", payload);
    return mapUser(response);
  },
};
