import { auth } from "@clerk/nextjs/server";
import Dashboard from "@/components/dashboard";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    return redirect("/");
  }

  return <Dashboard />;
}
