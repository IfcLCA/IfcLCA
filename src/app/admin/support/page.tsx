import { AdminSupportPage } from "@/components/admin-support-page";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support Admin",
  description: "Manage support tickets",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function Page() {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    redirect("/");
  }
  return <AdminSupportPage />;
}
