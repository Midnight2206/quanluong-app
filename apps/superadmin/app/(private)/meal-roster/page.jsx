import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { MealRosterPage } from "@/pages/meal-roster/MealRosterPage";

export default function MealRosterRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-meal-roster">
      <MealRosterPage />
    </RouteApiGuard>
  );
}
