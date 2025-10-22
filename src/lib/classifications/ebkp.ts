import { ClassificationSystem, ClassificationCode } from './types';
import {
    AMORTIZATION_LOOKUP,
    EBKP_STRUCTURE_WITH_AMORTIZATION
} from '@/data/ebkp-with-amortization-types';

export const DEFAULT_AMORTIZATION_YEARS = 30;

export const ebkpSystem: ClassificationSystem = {
    id: 'ebkp',
    name: 'eBKP-H',
    version: '2020',

    normalizeCode(code: string): string {
        // Add leading zeros: C2.1 → C02.01
        const match = code.match(/^([A-J])(\d{1,2})\.(\d{1,2})/);
        if (match) {
            const [, letter, num1, num2] = match;
            return `${letter}${num1.padStart(2, '0')}.${num2.padStart(2, '0')}`;
        }
        return code;
    },

    getAmortizationYears(code: string): number {
        const normalized = this.normalizeCode(code);
        const years = AMORTIZATION_LOOKUP.get(normalized);
        if (!years || years.length === 0) return DEFAULT_AMORTIZATION_YEARS;
        return years[0]; // Use first value
    },

    getCodeDetails(code: string): ClassificationCode | undefined {
        const normalized = this.normalizeCode(code);
        const years = AMORTIZATION_LOOKUP.get(normalized);

        // Extract from EBKP_STRUCTURE_WITH_AMORTIZATION if needed
        // This is a simplified version - full implementation would traverse the structure
        return years ? {
            code: normalized,
            label: '', // Would need to extract from structure
            amortizationYears: years,
        } : undefined;
    },

    isValidCode(code: string): boolean {
        return /^[A-J]\d{2}\.\d{2}$/.test(this.normalizeCode(code));
    }
};

