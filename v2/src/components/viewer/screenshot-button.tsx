"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { viewerRefs } from "@/lib/store/app-store";

/**
 * Screenshot button — captures the current 3D view as a PNG.
 */
export function ScreenshotButton() {
  const [capturing, setCapturing] = useState(false);

  async function handleCapture() {
    const r = viewerRefs.renderer as any;
    if (!r?.captureScreenshot) return;

    setCapturing(true);
    try {
      const dataUrl = await r.captureScreenshot();
      if (dataUrl) {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `ifclca-screenshot-${Date.now()}.png`;
        link.click();
      }
    } catch (err) {
      console.error("[Screenshot] Capture failed:", err);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs"
      onClick={handleCapture}
      disabled={capturing}
      title="Capture screenshot"
    >
      {capturing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Camera className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
