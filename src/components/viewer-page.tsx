"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const ThreeSceneWithNoSSR = dynamic(() => import("./ThreeScene"), {
  loading: () => <div>Loading 3D viewer...</div>,
  ssr: false,
});

export function ViewerPage({
  modelId,
  modelPath,
}: {
  modelId: string;
  modelPath: string;
}) {
  return (
    <Suspense fallback={<div>Loading viewer...</div>}>
      <ThreeSceneWithNoSSR modelId={modelId} modelPath={modelPath} />
    </Suspense>
  );
}
