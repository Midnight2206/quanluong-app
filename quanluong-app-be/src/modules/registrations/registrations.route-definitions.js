import { REGISTRATIONS_MODULE_NAME, REGISTRATIONS_PERMISSIONS } from "./registrations.constants.js";

const REGISTRATIONS_ROUTE_DEFINITIONS = [
  {
    key: "listPendingRegistrations",
    method: "GET",
    module: REGISTRATIONS_MODULE_NAME,
    path: "/pending",
    pathRoute: "/api/registrations/pending",
    permission: {
      code: REGISTRATIONS_PERMISSIONS.LIST,
      name: "View pending registrations",
      description: "List users awaiting registration approval in unit scope.",
    },
  },
  {
    key: "approveRegistration",
    method: "POST",
    module: REGISTRATIONS_MODULE_NAME,
    path: "/:userId/approve",
    pathRoute: "/api/registrations/:userId/approve",
    permission: {
      code: REGISTRATIONS_PERMISSIONS.REVIEW,
      name: "Approve registration",
      description: "Approve a pending user account in allowed unit branch.",
    },
  },
  {
    key: "rejectRegistration",
    method: "POST",
    module: REGISTRATIONS_MODULE_NAME,
    path: "/:userId/reject",
    pathRoute: "/api/registrations/:userId/reject",
    permission: {
      code: REGISTRATIONS_PERMISSIONS.REVIEW,
      name: "Reject registration",
      description: "Reject a pending user registration.",
    },
  },
];

export { REGISTRATIONS_ROUTE_DEFINITIONS };
