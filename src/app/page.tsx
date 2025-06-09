import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import LandingPage from "@/components/landing-page";
import { TermsAcceptanceWrapper } from "@/components/terms-acceptance-wrapper";

export const metadata: Metadata = {
  title: "IfcLCA - Open-source Building LCA",
  description:
    "Analyze your building's environmental impact using IFC models and Swiss KBOB metrics with the open-source IfcLCA web application.",
  alternates: {
    canonical: "https://ifclca.com",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "IfcLCA - Open-source Building LCA",
    description:
      "Analyze your building's environmental impact using IFC models and Swiss KBOB metrics with the open-source IfcLCA web application.",
    url: "https://ifclca.com",
    siteName: "IfcLCA",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/LandingPage.jpg",
        width: 1200,
        height: 630,
        alt: "IfcLCA - Life Cycle Assessment for Buildings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IfcLCA - Open-source Building LCA",
    description:
      "Analyze your building's environmental impact using IFC models and Swiss KBOB metrics with the open-source IfcLCA web application.",
    images: ["/LandingPage.jpg"],
    creator: "@ifclca",
  },
};

export default async function HomePage() {
  const { userId } = await auth();
  const cookieStore = cookies();
  const hasAcceptedTerms = cookieStore.has("terms_accepted");

  // If user is not authenticated, show landing page
  if (!userId) {
    return (
      <>
        <h1 className="sr-only">IfcLCA - Open-source Building LCA</h1>
        <h2 className="sr-only">Analyze your building's environmental impact using IFC models</h2>
        <LandingPage />
      </>
    );
  }

  // If user is authenticated but hasn't accepted terms, show terms acceptance
  if (!hasAcceptedTerms) {
    return (
      <TermsAcceptanceWrapper>
        <Dashboard />
      </TermsAcceptanceWrapper>
    );
  }

  // If user is authenticated and has accepted terms, show dashboard
  return <Dashboard />;
}
