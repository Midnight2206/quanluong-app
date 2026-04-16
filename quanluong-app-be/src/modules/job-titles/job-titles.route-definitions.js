import { JOB_TITLES_MODULE_NAME, JOB_TITLES_PERMISSIONS } from "./job-titles.constants.js";

const JOB_TITLES_ROUTE_DEFINITIONS = [
  {
    key: "listJobTitles",
    method: "GET",
    module: JOB_TITLES_MODULE_NAME,
    path: "/",
    pathRoute: "/api/job-titles",
    permission: { code: JOB_TITLES_PERMISSIONS.LIST, name: "List job titles", description: "List job titles in unit scope." },
  },
  {
    key: "getJobTitle",
    method: "GET",
    module: JOB_TITLES_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/job-titles/:id",
    permission: { code: JOB_TITLES_PERMISSIONS.DETAIL, name: "Job title detail", description: "View one job title and permission ids." },
  },
  {
    key: "createJobTitle",
    method: "POST",
    module: JOB_TITLES_MODULE_NAME,
    path: "/",
    pathRoute: "/api/job-titles",
    permission: { code: JOB_TITLES_PERMISSIONS.CREATE, name: "Create job title", description: "Create a job title under a unit." },
  },
  {
    key: "patchJobTitle",
    method: "PATCH",
    module: JOB_TITLES_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/job-titles/:id",
    permission: { code: JOB_TITLES_PERMISSIONS.PATCH, name: "Update job title", description: "Update job title fields." },
  },
  {
    key: "deleteJobTitle",
    method: "DELETE",
    module: JOB_TITLES_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/job-titles/:id",
    permission: { code: JOB_TITLES_PERMISSIONS.DELETE, name: "Deactivate job title", description: "Soft-deactivate a job title." },
  },
  {
    key: "setJobTitlePermissions",
    method: "PUT",
    module: JOB_TITLES_MODULE_NAME,
    path: "/:id/permissions",
    pathRoute: "/api/job-titles/:id/permissions",
    permission: {
      code: JOB_TITLES_PERMISSIONS.PATCH,
      name: "Set job title permissions",
      description: "Replace permission set; each id must be held by the acting admin.",
    },
  },
  {
    key: "applyJobTitleToUnit",
    method: "POST",
    module: JOB_TITLES_MODULE_NAME,
    path: "/:id/apply-to-unit",
    pathRoute: "/api/job-titles/:id/apply-to-unit",
    permission: {
      code: JOB_TITLES_PERMISSIONS.APPLY_DOWN,
      name: "Apply job title to child unit",
      description:
        "Push one job title intact to a single strict child unit; idempotent mapping avoids duplicate applications.",
    },
  },
];

export { JOB_TITLES_ROUTE_DEFINITIONS };
