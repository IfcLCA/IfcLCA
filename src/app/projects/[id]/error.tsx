"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-full flex-col items-center justify-center">
      <h2 className="text-center text-2xl font-bold mb-4">
        Something went wrong!
      </h2>
      <p className="text-muted-foreground mb-8">
        {error.message || "An unexpected error occurred"}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/projects")}>
          Return to Projects
        </Button>
      </div>
    </main>
  );
}
