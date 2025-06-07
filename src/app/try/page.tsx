import { Metadata } from "next";
import TryNowPage from "@/components/try-now-page";

export const metadata: Metadata = {
  title: "Try Now - IfcLCA",
  description: "Upload an IFC and preview results without an account",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function TryPage() {
  return <TryNowPage />;
}
