"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        The page could not be loaded. If this keeps happening, the database may be unreachable.
        {error.digest ? ` (reference ${error.digest})` : null}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
