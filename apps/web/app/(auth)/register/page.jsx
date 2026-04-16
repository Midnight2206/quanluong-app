import { fetchRegisterUnitsForServer } from "@quanluong/shared/server-data/register-units";
import { RegisterPage } from "@/pages/register/RegisterPage";

export default async function RegisterRoutePage() {
  const result = await fetchRegisterUnitsForServer();

  return (
    <RegisterPage initialUnits={result.units} initialUnitsError={!result.ok} />
  );
}
