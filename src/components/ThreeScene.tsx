"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback() {
  return <div>Something went wrong with the 3D viewer</div>;
}

function Scene({ modelId, modelPath }: { modelId: string; modelPath: string }) {
  return (
    <mesh>
      {/* Your 3D scene content */}
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  );
}

export default function ThreeScene({
  modelId,
  modelPath,
}: {
  modelId: string;
  modelPath: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div style={{ width: "100%", height: "100vh" }}>
        <Canvas>
          <Suspense fallback={null}>
            <Scene modelId={modelId} modelPath={modelPath} />
          </Suspense>
        </Canvas>
      </div>
    </ErrorBoundary>
  );
}
