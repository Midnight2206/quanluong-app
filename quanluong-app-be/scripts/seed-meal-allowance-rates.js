import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { MEAL_ALLOWANCE_INITIAL_ROWS } from "../src/modules/meal-allowance-rates/meal-allowance-rates.seed-data.js";

async function main() {
  const n = await prisma.mealAllowanceRate.count();
  if (n > 0) {
    console.log(`MealAllowanceRate: đã có ${n} bản ghi — bỏ qua seed.`);
    return;
  }
  const created = await prisma.mealAllowanceRate.createMany({
    data: MEAL_ALLOWANCE_INITIAL_ROWS,
  });
  console.log(`MealAllowanceRate: đã tạo ${created.count} bản ghi khởi tạo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
