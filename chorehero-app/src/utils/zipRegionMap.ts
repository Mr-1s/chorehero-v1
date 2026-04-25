export type ZipRegionEntry = {
  zip: string;
  city: string;
  state: string;
  regions: string[];
};

export const ZIP_REGION_MAP: ZipRegionEntry[] = [
  {
    zip: '31401',
    city: 'Savannah',
    state: 'GA',
    regions: ['Historic District', 'Downtown Savannah', 'Victorian District', 'Eastside'],
  },
  {
    zip: '31404',
    city: 'Savannah',
    state: 'GA',
    regions: ['Midtown East', 'Skidaway Road Area', 'Bacon Park'],
  },
  {
    zip: '31405',
    city: 'Savannah',
    state: 'GA',
    regions: ['Midtown', 'Ardsley Park', 'Habersham Village'],
  },
  {
    zip: '31406',
    city: 'Savannah',
    state: 'GA',
    regions: ['Southside', 'Windsor Forest', 'Coffee Bluff'],
  },
  {
    zip: '31407',
    city: 'Savannah',
    state: 'GA',
    regions: ['Port Wentworth Area', 'Pooler East', 'Highlands'],
  },
  {
    zip: '31410',
    city: 'Savannah',
    state: 'GA',
    regions: ['Wilmington Island', 'Talahi Island'],
  },
  {
    zip: '31411',
    city: 'Savannah',
    state: 'GA',
    regions: ['Skidaway Island', 'The Landings'],
  },
  {
    zip: '31322',
    city: 'Pooler',
    state: 'GA',
    regions: ['Pooler Parkway', 'Godley Station', 'Towne Center'],
  },
];

export function formatCoverageArea(region: string, zip: string): string {
  const entry = ZIP_REGION_MAP.find((x) => x.zip === zip);
  if (!entry) return `${region} (ZIP ${zip})`;
  return `${region}, ${entry.city}, ${entry.state} (ZIP ${zip})`;
}

export function parseCoverageArea(coverageArea: string | undefined | null): {
  zip: string;
  region: string;
} {
  if (!coverageArea) return { zip: '', region: '' };
  const zipMatch = coverageArea.match(/ZIP\s*(\d{5})/i);
  const zip = zipMatch?.[1] || '';
  const beforeZip = coverageArea.split('(')[0]?.trim() || '';
  const region = beforeZip.split(',')[0]?.trim() || '';
  return { zip, region };
}
