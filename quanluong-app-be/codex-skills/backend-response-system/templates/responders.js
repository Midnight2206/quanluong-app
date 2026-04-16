import { successResponse } from "./response";

export const respondOk = (res, payload) => {
  return res.status(200).json(successResponse(payload));
};

export const respondCreated = (res, payload) => {
  return res.status(201).json(successResponse(payload));
};

export const respondNoContent = (res) => {
  return res.status(204).send();
};
