import { fetchWithRetry } from '@/lib/fetch-with-timeout';

export type NearbyStore = {
  name: string;
  address: string;
  distance: number;
  phone: string;
};

export type StoreComparison = {
  storeName: string;
  address: string;
  distance: number;
  phone: string;
  drivingTime: string;
  totalPrice: number;
  items: { name: string; price: number; available: boolean }[];
};

// Real stores come from OpenStreetMap, so names, addresses and distances are never invented. The AI is only
// used to estimate prices for them. Overpass is a free community service: keep requests few and identify the app.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADII_MILES = [5, 20];
const METERS_PER_MILE = 1609.34;
const MAX_STORES = 5;

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

async function queryStores(latitude: number, longitude: number, radiusMiles: number): Promise<NearbyStore[]> {
  const radius = Math.round(radiusMiles * METERS_PER_MILE);
  const query = `[out:json][timeout:25];nwr(around:${radius},${latitude},${longitude})["shop"~"^(supermarket|grocery)$"];out center tags;`;

  const response = await fetchWithRetry(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: '*/*',
      'User-Agent': 'MealPlannerRoulette/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  }, 40000, 3);
  if (!response.ok) throw new Error(`Map service error ${response.status}`);

  const data = (await response.json()) as {
    elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
  };

  const stores: NearbyStore[] = [];
  for (const element of data.elements ?? []) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!tags.name || lat === undefined || lon === undefined) continue;

    const distance = Math.round(milesBetween(latitude, longitude, lat, lon) * 10) / 10;
    if (stores.some((s) => s.name === tags.name && Math.abs(s.distance - distance) < 0.1)) continue;

    const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
    const address = [street, tags['addr:city'], tags['addr:state']].filter(Boolean).join(', ');
    stores.push({
      name: tags.name,
      address: address || 'Address not listed',
      distance,
      phone: tags.phone || tags['contact:phone'] || 'Phone not available',
    });
  }
  return stores.sort((a, b) => a.distance - b.distance).slice(0, MAX_STORES);
}

/** The closest real grocery stores, searching 5 miles out first and widening to 20 only if fewer than 3 are found. */
export async function findNearbyStores(latitude: number, longitude: number): Promise<NearbyStore[]> {
  let found: NearbyStore[] = [];
  for (const radius of SEARCH_RADII_MILES) {
    found = await queryStores(latitude, longitude, radius);
    if (found.length >= 3) break;
  }
  return found;
}

/** Estimates what each item costs at each of these (real) stores. Prices are estimates. */
export async function estimateStorePrices(stores: NearbyStore[], itemNames: string[]): Promise<StoreComparison[]> {
  let comparisons = await requestPriceEstimate(stores, itemNames);
  // The AI sometimes returns the same prices for every store, which makes the comparison meaningless: ask once more.
  const allSame = comparisons.length > 1 && comparisons.every((c) => c.totalPrice === comparisons[0].totalPrice);
  if (allSame) comparisons = await requestPriceEstimate(stores, itemNames);
  return comparisons;
}

async function requestPriceEstimate(stores: NearbyStore[], itemNames: string[]): Promise<StoreComparison[]> {
  const response = await fetchWithRetry('https://toolkit.rork.com/text/llm/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'You are a grocery price estimator. Given real grocery stores and a list of items, estimate a realistic current US price for each item at each store. Discount chains (Aldi, Walmart, Food Lion, Save-A-Lot) are cheaper; premium stores (Whole Foods, Harris Teeter) cost more; small independent stores are in between. Return ONLY a JSON array with one object per store, in the same order as given: [{"storeName": string, "items": [{"name": string, "price": number, "available": true}]}]. Use the store name exactly as given (without the address). Prices must differ between stores. Include every item for every store. No explanations, no markdown.',
        },
        {
          role: 'user',
          content: `Stores:\n${stores.map((s, i) => `${i + 1}. ${s.name} (${s.address})`).join('\n')}\n\nItems: ${itemNames.join(', ')}`,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Price service error ${response.status}`);

  const data = (await response.json()) as { completion?: string };
  const cleaned = (data.completion ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const priced = JSON.parse(cleaned) as { storeName?: string; items?: { name?: string; price?: number; available?: boolean }[] }[];
  if (!Array.isArray(priced)) throw new Error('Unreadable price estimate');

  const comparisons: StoreComparison[] = [];
  stores.forEach((store, index) => {
    const entry = priced.find((p) => p.storeName === store.name || p.storeName?.startsWith(store.name)) ?? priced[index];
    if (!entry || !Array.isArray(entry.items) || entry.items.length === 0) return;

    const items = entry.items.map((item) => ({
      name: item.name || 'Unknown item',
      price: typeof item.price === 'number' ? item.price : 0,
      available: item.available !== false,
    }));
    comparisons.push({
      storeName: store.name,
      address: store.address,
      distance: store.distance,
      phone: store.phone,
      drivingTime: `${Math.max(2, Math.round(store.distance * 2))} min`,
      totalPrice: Math.round(items.reduce((sum, item) => sum + item.price, 0) * 100) / 100,
      items,
    });
  });
  return comparisons;
}
