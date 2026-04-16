import http from "../templates/httpClient";

// GET
export const getUsers = () => http.get("/users");

// POST
export const createUser = (data) => http.post("/users", data);

// PUT
export const updateUser = (id, data) => http.put(`/users/${id}`, data);

// DELETE
export const deleteUser = (id) => http.delete(`/users/${id}`);
