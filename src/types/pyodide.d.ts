// Top-level export for direct imports
export interface PyodideInterface {
    runPython(code: string): any;
    pyimport(name: string): any;
    loadPackage(packages: string[]): Promise<void>;
    version: string;
    globals: {
        get(name: string): any;
        set(name: string, value: any): void;
    };
}

// Module augmentation for 'pyodide' module (for runtime compatibility)
declare module 'pyodide' {
    export { PyodideInterface };

    export function loadPyodide(config?: { indexURL?: string }): Promise<PyodideInterface>;
}

// Global Window augmentation
declare global {
    interface Window {
        loadPyodide: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
        pyodide?: PyodideInterface;
    }
}
