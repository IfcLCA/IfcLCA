declare module 'pyodide' {
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

    export function loadPyodide(config?: { indexURL?: string }): Promise<PyodideInterface>;
}

declare global {
    interface Window {
        loadPyodide: (config?: { indexURL?: string }) => Promise<import('pyodide').PyodideInterface>;
        pyodide?: import('pyodide').PyodideInterface;
    }
}
