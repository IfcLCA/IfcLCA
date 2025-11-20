"use client";

import { useState, useEffect } from "react";
import { TermsAcceptanceModal } from "./terms-acceptance-modal";
import { useRouter, useSearchParams } from "next/navigation";

export function TermsAcceptanceWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showModal, setShowModal] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");

  const handleAcceptTerms = async () => {
    try {
      await fetch("/api/accept-terms", {
        method: "POST",
      });

      setShowModal(false);

      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to accept terms:", error);
    }
  };

  return (
    <>
      <TermsAcceptanceModal
        open={showModal}
        onAccept={handleAcceptTerms}
      />
      {children}
    </>
  );
}
