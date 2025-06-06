import { SupportPage } from "@/components/support-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help or report issues",
};

export default function Page() {
  return <SupportPage />;
}
