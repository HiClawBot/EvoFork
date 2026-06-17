import { AdminConsole } from "./AdminConsole";
import { getAdminSnapshot } from "../lib/admin-api";

export default async function AdminPage() {
  const snapshot = await getAdminSnapshot();

  return <AdminConsole initialSnapshot={snapshot} />;
}
