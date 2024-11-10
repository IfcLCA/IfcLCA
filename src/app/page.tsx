import { auth } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/dashboard";
import LandingPage from "@/components/landing-page";

export default async function HomePage() {
  const { userId } = await auth();

  // If user is not authenticated, show landing page
  if (!userId) {
    return <LandingPage />;
  }

  // If user is authenticated, show dashboard
  return <Dashboard />;
}
