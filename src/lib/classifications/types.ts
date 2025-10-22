export interface ClassificationCode {
    code: string;
    label: string;
    amortizationYears?: number[];
    category?: string;
}

export interface ClassificationSystem {
    id: string;                    // "ebkp", "uniformat", "masterformat"
    name: string;                  // "eBKP-H", "UniFormat", "MasterFormat"
    version?: string;              // "2020", "2024"

    // Normalize code format (e.g., C2.1 → C02.01)
    normalizeCode: (code: string) => string;

    // Get amortization years for a code
    getAmortizationYears: (code: string) => number;

    // Get code details
    getCodeDetails: (code: string) => ClassificationCode | undefined;

    // Validate code format
    isValidCode: (code: string) => boolean;
}

export interface ClassificationRegistry {
    registerSystem: (system: ClassificationSystem) => void;
    getSystem: (id: string) => ClassificationSystem | undefined;
    listSystems: () => ClassificationSystem[];
    getDefaultSystem: () => ClassificationSystem;
}

