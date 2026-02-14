// Minimal WebGPU type declarations for navigator.gpu detection.
// Full WebGPU types are provided at runtime by the browser;
// we only need enough for the feature-detection code path.

interface GPU {
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

interface GPURequestAdapterOptions {
  powerPreference?: "low-power" | "high-performance";
}

interface GPUAdapter {
  readonly name: string;
  requestDevice(descriptor?: Record<string, unknown>): Promise<GPUDevice>;
}

interface GPUDevice extends EventTarget {
  readonly lost: Promise<GPUDeviceLostInfo>;
  destroy(): void;
}

interface GPUDeviceLostInfo {
  readonly reason: "destroyed" | undefined;
  readonly message: string;
}

interface Navigator {
  readonly gpu?: GPU;
}
