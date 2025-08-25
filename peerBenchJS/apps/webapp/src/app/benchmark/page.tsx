import { redirect } from "next/navigation";
import { getUser } from "../actions/auth";
import BenchmarkPage from "./BenchmarkPage";

export default async function Page() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return <BenchmarkPage user={user} />;
}
