import { classificationRegistry } from '@/lib/classifications';
import { DEFAULT_AMORTIZATION_YEARS } from '@/lib/constants/amortization';

/**
 * Get amortization years for an element's classification
 */
export function getAmortizationYears(
    classification?: { system: string; code: string }
): number {
    if (!classification) return DEFAULT_AMORTIZATION_YEARS;

    // Handle "Unknown" system gracefully - just use default
    if (classification.system === 'Unknown' || !classification.system) {
        return DEFAULT_AMORTIZATION_YEARS;
    }

    const system = classificationRegistry.getSystem(classification.system);
    if (!system) {
        // Only warn if it's not a recognized variant
        if (!classification.system.toLowerCase().includes('ebkp')) {
            console.warn(`Unknown classification system: ${classification.system}`);
        }
        return DEFAULT_AMORTIZATION_YEARS;
    }

    return system.getAmortizationYears(classification.code);
}

/**
 * Calculate relative emissions: absolute / (amortization × area)
 */
export function calculateRelativeEmissions(
    absoluteEmissions: number,
    amortizationYears: number,
    area: number
): number {
    if (area <= 0) return 0;
    // Guard against non-positive amortization years
    if (amortizationYears <= 0) {
        amortizationYears = DEFAULT_AMORTIZATION_YEARS;
    }
    return absoluteEmissions / (amortizationYears * area);
}

