export interface ZipLookupResult {
  city: string;
  state: string;
}

const cache = new Map<string, ZipLookupResult>();

const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
};

class ZipLookupService {
  async lookup(zip: string): Promise<ZipLookupResult | null> {
    if (cache.has(zip)) return cache.get(zip)!;
    try {
      const response = await withTimeout(fetch(`https://api.zippopotam.us/us/${zip}`), 4000);
      if (!response.ok) return null;
      const data = await response.json();
      const place = data?.places?.[0];
      if (!place) return null;
      const result = { city: place['place name'], state: place['state abbreviation'] };
      cache.set(zip, result);
      return result;
    } catch {
      return null;
    }
  }
}

export const zipLookupService = new ZipLookupService();
