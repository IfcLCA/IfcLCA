# Ökobaudat Integration Documentation

## Overview

This document describes the integration of Ökobaudat (German environmental database) alongside KBOB in the IfcLCA material library. The integration follows best practices for ILCD+EPD format compliance and provides seamless switching between data sources.

## Features

### 1. Dual Data Source Support
- **KBOB (Swiss)**: 314+ pre-loaded materials with instant access
- **Ökobaudat (German)**: 1000+ EPDs via real-time API, EN 15804+A2 compliant

### 2. Intelligent Material Matching
- **Fuzzy matching algorithm** using Levenshtein distance
- **Category-based boosting** for improved accuracy
- **Multiple search strategies** for comprehensive results
- **AI-suggested matches** for ambiguous materials

### 3. Density Management
- **Hierarchical fallback system**:
  1. User-defined density (highest priority)
  2. Ökobaudat API density
  3. Material category defaults
  4. AI-suggested density based on material name
  5. User prompt for manual entry
- **Validation** against expected ranges
- **Persistence** of user-defined values

### 4. Performance Optimizations
- **Intelligent caching** with 24-hour TTL
- **Rate limiting** with exponential backoff
- **Batch API requests** for efficiency
- **Lazy loading** of material details

## Configuration

Add these environment variables to your `.env.local` file:

```env
# Ökobaudat API Configuration
OKOBAUDAT_API_URL=https://oekobaudat.de/OEKOBAU.DAT/resource
OKOBAUDAT_DATASTOCK_ID=cd2bda71-760b-4fcc-8a0b-3877c10000a8
OKOBAUDAT_API_KEY=your_optional_api_key_here  # Optional but recommended
OKOBAUDAT_API_CACHE_TTL=86400  # 24 hours in seconds
OKOBAUDAT_API_RATE_LIMIT=100   # requests per minute
```

## API Endpoints

### Search Materials
```
POST /api/okobaudat/search
{
  "query": "concrete",
  "limit": 20,
  "compliance": "A2",  // or "A1"
  "fuzzy": true
}
```

### Get Material Details
```
GET /api/okobaudat/{uuid}
```

### Match Materials
```
POST /api/materials/match
{
  "materialIds": ["..."],
  "matchId": "okobaudat-uuid",
  "dataSource": "okobaudat",
  "density": 2400  // Optional
}
```

## Database Schema

The Material model has been enhanced with:

```typescript
{
  // Data source tracking
  dataSource: 'kbob' | 'okobaudat',
  
  // KBOB match (existing)
  kbobMatchId: ObjectId,
  
  // Ökobaudat match (new)
  okobaudatMatchId: string,  // UUID
  okobaudatData: {
    uuid: string,
    name: string,
    category: string,
    declaredUnit: string,
    referenceFlowAmount: number,
    lastFetched: Date
  },
  
  // Cached indicators (both sources)
  cachedIndicators: {
    gwp: number,
    ubp?: number,  // Only for KBOB
    penre: number,
    source: 'kbob' | 'okobaudat',
    lastUpdated: Date
  }
}
```

## Frontend Components

### DataSourceToggle
Toggle between KBOB and Ökobaudat databases with visual indicators and tooltips.

### OkobaudatSearch
Search interface with:
- Real-time search
- Compliance filtering (EN 15804+A1/A2)
- Fuzzy matching option
- Material preview cards

### DensityInputModal
User-friendly density input with:
- Suggested ranges based on material type
- Validation against expected values
- Common material density references

## Usage Example

```typescript
// Search Ökobaudat materials
const results = await fetch('/api/okobaudat/search', {
  method: 'POST',
  body: JSON.stringify({
    query: 'Beton C25/30',
    compliance: 'A2',
    fuzzy: true
  })
});

// Match materials with Ökobaudat
await fetch('/api/materials/match', {
  method: 'POST',
  body: JSON.stringify({
    materialIds: ['material1', 'material2'],
    matchId: 'okobaudat-uuid',
    dataSource: 'okobaudat',
    density: 2400
  })
});
```

## Data Validation

All Ökobaudat data is validated for:
- **ILCD+EPD format compliance**
- **EN 15804+A1/A2 standard compliance**
- **UUID and version consistency**
- **Environmental indicator completeness**

## Error Handling

The integration includes comprehensive error handling:
- **API timeouts** with 30-second limit
- **Rate limiting** with queue management
- **Cache invalidation** on errors
- **Graceful fallbacks** to cached data
- **User-friendly error messages**

## Performance Considerations

- **Cache first**: Always check cache before API calls
- **Batch operations**: Group material matches
- **Lazy loading**: Fetch full details only when needed
- **Progressive enhancement**: Start with basic data, enhance as needed

## Migration Guide

For existing projects:
1. Materials retain their KBOB matches by default
2. Switch to Ökobaudat per material as needed
3. Both data sources can coexist in the same project
4. Historical data is preserved

## Troubleshooting

### No results found
- Try broader search terms
- Check internet connection
- Verify API key (if using)
- Check compliance filter settings

### Missing density
- System will prompt for manual input
- Check category defaults
- Verify material properties in Ökobaudat

### Slow performance
- Consider getting an API key for higher limits
- Reduce search result limits
- Enable caching (default 24 hours)

## Future Enhancements

- [ ] Support for additional databases (EC3, ICE)
- [ ] Machine learning for better matching
- [ ] Bulk import/export functionality
- [ ] Advanced filtering options
- [ ] Material comparison tools

## References

- [Ökobaudat Website](https://www.oekobaudat.de/)
- [ILCD+EPD Format Specification](https://www.oekobaudat.de/en/guidance/software-developers.html)
- [EN 15804+A2 Standard](https://www.en-standard.eu/)







