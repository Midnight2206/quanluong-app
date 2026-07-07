import { AUTH_ROUTE_DEFINITIONS } from "../modules/auth/auth.route-definitions.js";
import { JOB_TITLES_ROUTE_DEFINITIONS } from "../modules/job-titles/job-titles.route-definitions.js";
import { REGISTRATIONS_ROUTE_DEFINITIONS } from "../modules/registrations/registrations.route-definitions.js";
import { UNITS_ROUTE_DEFINITIONS } from "../modules/units/units.route-definitions.js";
import { UNIT_LEVEL_ROUTE_DEFINITIONS } from "../modules/unit-level-metadata/unit-level-metadata.route-definitions.js";
import { UNIT_LEVEL_PERMISSION_CAPS_ROUTE_DEFINITIONS } from "../modules/unit-level-permission-caps/unit-level-permission-caps.route-definitions.js";
import { USERS_ROUTE_DEFINITIONS } from "../modules/users/users.route-definitions.js";
import { PERMISSIONS_ROUTE_DEFINITIONS } from "../modules/permissions/permissions.route-definitions.js";
import { LTTP_ROUTE_DEFINITIONS } from "../modules/lttp/lttp.route-definitions.js";
import { MEAL_ALLOWANCE_RATES_ROUTE_DEFINITIONS } from "../modules/meal-allowance-rates/meal-allowance-rates.route-definitions.js";
import { MEAL_ROSTER_ROUTE_DEFINITIONS } from "../modules/meal-roster/meal-roster.route-definitions.js";
import { KITCHEN_BOOKS_ROUTE_DEFINITIONS } from "../modules/kitchen-books/kitchen-books.route-definitions.js";
import { CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS } from "../modules/chung-tu-quyet-toan/chung-tu-quyet-toan.route-definitions.js";
import { getPermissionVi } from "../shared/constants/permission-catalog.vi.js";

const ROUTE_PERMISSION_DEFINITIONS = [
  ...AUTH_ROUTE_DEFINITIONS,
  ...LTTP_ROUTE_DEFINITIONS,
  ...JOB_TITLES_ROUTE_DEFINITIONS,
  ...REGISTRATIONS_ROUTE_DEFINITIONS,
  ...PERMISSIONS_ROUTE_DEFINITIONS,
  ...UNITS_ROUTE_DEFINITIONS,
  ...UNIT_LEVEL_ROUTE_DEFINITIONS,
  ...UNIT_LEVEL_PERMISSION_CAPS_ROUTE_DEFINITIONS,
  ...USERS_ROUTE_DEFINITIONS,
  ...MEAL_ALLOWANCE_RATES_ROUTE_DEFINITIONS,
  ...MEAL_ROSTER_ROUTE_DEFINITIONS,
  ...KITCHEN_BOOKS_ROUTE_DEFINITIONS,
  ...CHUNG_TU_QUYET_TOAN_ROUTE_DEFINITIONS,
]
  .filter((route) => route.permission)
  .map((route) => {
    const vi = getPermissionVi(route.permission.code);
    return {
      ...route.permission,
      name: vi?.name ?? route.permission.name,
      description: vi?.description ?? route.permission.description,
      method: route.method,
      pathRoute: route.pathRoute,
      module: route.module,
    };
  });

export { ROUTE_PERMISSION_DEFINITIONS };
