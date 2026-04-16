export const createAxiosBaseQuery =
  ({ http }) =>
  async ({ url, method = "get", data, params, config }) => {
    try {
      const result = await http[method](url, data, {
        params,
        ...config,
      });

      return { data: result };
    } catch (error) {
      return {
        error: {
          status: error.response?.status ?? 500,
          data: error.response?.data ?? error.message,
        },
      };
    }
  };
