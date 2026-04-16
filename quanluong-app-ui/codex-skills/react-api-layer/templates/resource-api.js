import http from "../../react-http-client/templates/httpClient";

const mapEntity = (payload) => ({
  id: payload.id,
  name: payload.name,
  createdAt: payload.created_at,
});

const normalizeApiError = (error) => ({
  code: error.response?.data?.code ?? "API_ERROR",
  message: error.response?.data?.message ?? error.message,
  status: error.response?.status ?? 500,
});

export const resourceApi = {
  list: async (params) => {
    try {
      const response = await http.get("/resources", { params });
      return response.items.map(mapEntity);
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  detail: async (id) => {
    try {
      const response = await http.get(`/resources/${id}`);
      return mapEntity(response);
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  create: async (payload) => {
    try {
      const response = await http.post("/resources", payload);
      return mapEntity(response);
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
};
