import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { Recipe, RecipeCategory } from '@/types';

const RECIPES_STORAGE_KEY = 'meal-planner-recipes';
const IMAGE_FAILURES_STORAGE_KEY = 'meal-planner-image-failures';

const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
};

const domainUserAgentCache = new Map<string, 'desktop' | 'mobile'>();

export type RecipeStoreState = {
  recipes: Recipe[];
  addRecipeFromUrl: (url: string, suggestedCategory?: RecipeCategory) => Promise<Recipe | undefined>;
  updateRecipe: (r: Recipe) => void;
  removeRecipe: (id: string) => void;
  getRecipesByCategory: (category: RecipeCategory) => Recipe[];
  reextractImagesForAll: () => Promise<void>;
  getImageFailures: () => Promise<any[]>;
  clearImageFailures: () => Promise<void>;
};

export const [RecipeProvider, useRecipes] = createContextHook(() => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(RECIPES_STORAGE_KEY);
        if (raw) {
          setRecipes(JSON.parse(raw));
        }
      } catch (e) {
        console.warn('Failed loading recipes', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const persist = useCallback(async (recipesToSave: Recipe[]) => {
    try {
      await AsyncStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipesToSave));
    } catch (e) {
      console.warn('Failed persisting recipes', e);
    }
  }, []);

  const addRecipeFromUrl = useCallback(async (url: string, suggestedCategory?: RecipeCategory): Promise<Recipe | undefined> => {
    // Minimal higher-level flow:
    // 1. Fetch HTML, parse basic meta tags and images
    // 2. Try og:image/twitter:image/json-ld first
    // 3. If needed, try srcset / img largest candidate
    // 4. Convert to base64 thumbnail client-side; fallback to server proxy if blocked
    // 5. Save recipe object to store and return it

    const recipeUrl = url;
    let pageHtml = '';
    try {
      const res = await fetch(recipeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENTS.desktop,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      pageHtml = await res.text();
    } catch (err) {
      console.warn('Failed to fetch recipe page', err);
    }

    // Simple metadata extraction (og:image, twitter:image, JSON-LD)
    const candidates: string[] = [];

    try {
      const ogMatch = pageHtml.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (ogMatch && ogMatch[1]) candidates.push(ogMatch[1]);
    } catch (e) {}

    try {
      const twMatch = pageHtml.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
      if (twMatch && twMatch[1]) candidates.push(twMatch[1]);
    } catch (e) {}

    try {
      const ldMatches = pageHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of ldMatches) {
        try {
          const data = JSON.parse(m[1]);
          const findImage = (obj: any): string | undefined => {
            if (!obj || typeof obj !== 'object') return undefined;
            if (obj['@type'] === 'Recipe' || obj['@type'] === 'ImageObject') {
              if (typeof obj.image === 'string' && (obj.image.startsWith('http://') || obj.image.startsWith('https://'))) {
                return obj.image;
              }
              if (obj.image && typeof obj.image === 'object') {
                if (obj.image.url && typeof obj.image.url === 'string') return obj.image.url;
                if (Array.isArray(obj.image) && obj.image.length > 0) {
                  const firstImage = typeof obj.image[0] === 'string' ? obj.image[0] : obj.image[0]?.url;
                  if (firstImage && (firstImage.startsWith('http://') || firstImage.startsWith('https://'))) return firstImage;
                }
              }
            }
            for (const k in obj) {
              if (typeof obj[k] === 'object') {
                const found = findImage(obj[k]);
                if (found) return found;
              }
            }
            return undefined;
          };
          const found = findImage(data);
          if (found) candidates.push(found);
        } catch (e) {
          // ignore json parse
        }
      }
    } catch (e) {}

    // Parse <img> tags and srcset fallback
    try {
      const imgMatches = [...pageHtml.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
      for (const im of imgMatches) {
        if (im && (im.startsWith('http://') || im.startsWith('https://'))) candidates.push(im);
      }
    } catch (e) {}

    // De-dup and pick best candidate (prefer og/twitter/jsonld)
    const uniqueCandidates = Array.from(new Set(candidates));
    const chosen = uniqueCandidates[0] ?? undefined;

    // Convert to thumbnail when possible
    let thumbnailDataUri: string | undefined = undefined;
    if (chosen) {
      try {
        thumbnailDataUri = await convertImageToBase64(chosen, recipeUrl);
      } catch (e) {
        console.warn('convertImageToBase64 failed', e);
      }
    }

    const newRecipe: Recipe = {
      id: Date.now().toString(),
      url: recipeUrl,
      name: '',
      category: suggestedCategory ?? 'Main Course',
      imageUri: thumbnailDataUri,
      createdAt: Date.now()
    };

    setRecipes(prev => {
      const updated = [...prev, newRecipe];
      persist(updated);
      return updated;
    });
    return newRecipe;
  }, [persist]);

  // Minimal image conversion utility - keep this small and safe
  const convertImageToBase64 = async (imageUrl: string, pageUrl?: string): Promise<string | undefined> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const ua = domainUserAgentCache.get(new URL(imageUrl).hostname) ?? 'desktop';

      const res = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENTS[ua],
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          ...(pageUrl ? { Referer: pageUrl } : {})
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        // simple retry on 503/429
        if (res.status === 503 || res.status === 429) {
          for (let i = 0; i < 3; i++) {
            await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
            const r2 = await fetch(imageUrl, { method: 'GET', headers: { 'User-Agent': USER_AGENTS[ua], ...(pageUrl ? { Referer: pageUrl } : {}) } });
            if (r2.ok) {
              const blob = await r2.blob();
              const reader = new FileReader();
              return new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          }
        }
        return undefined;
      }

      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) return undefined;
      const blob = await res.blob();
      const reader = new FileReader();
      return new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('convertImageToBase64 error', e);
      return undefined;
    }
  };

  const updateRecipe = useCallback((r: Recipe) => {
    setRecipes(prev => {
      const updated = prev.map(existing => existing.id === r.id ? r : existing);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const removeRecipe = useCallback((id: string) => {
    setRecipes(prev => {
      const updated = prev.filter(r => r.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const reextractImagesForAll = useCallback(async () => {
    setRecipes(prev => {
      const updated = [...prev];
      Promise.all(updated.map(async r => {
        if (r.url) {
          const newImage = await convertImageToBase64(r.url, r.url).catch(() => undefined);
          if (newImage) {
            r.imageUri = newImage;
          }
        }
      })).then(() => {
        persist(updated);
      });
      return updated;
    });
  }, [persist]);

  const getImageFailures = useCallback(async (): Promise<any[]> => {
    try {
      const raw = await AsyncStorage.getItem(IMAGE_FAILURES_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed loading image failures', e);
    }
    return [];
  }, []);

  const clearImageFailures = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(IMAGE_FAILURES_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed clearing image failures', e);
    }
  }, []);

  const getRecipesByCategory = useCallback((category: RecipeCategory): Recipe[] => {
    return recipes.filter(recipe => recipe.category === category);
  }, [recipes]);

  return {
    recipes,
    addRecipeFromUrl,
    updateRecipe,
    removeRecipe,
    getRecipesByCategory,
    reextractImagesForAll,
    getImageFailures,
    clearImageFailures
  };
});
