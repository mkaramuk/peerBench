import { redirect } from "next/navigation";

export const fetchCache = "force-no-store";

export default function Home() {
  redirect("/dashboard");
}
