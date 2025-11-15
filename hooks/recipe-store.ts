import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Recipe, RecipeCategory } from '@/types';
import { useAuth } from './auth-store';

const RECIPES_STORAGE_KEY = 'meal-planner-recipes';
const IMAGE_FAILURES_STORAGE_KEY = 'meal-planner-image-failures';

const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
};

const domainUserAgentCache = new Map<string, 'desktop' | 'mobile'>();

interface ImageFetchFailure {
  recipeUrl: string;
  imageUrl: string;
  httpStatus?: number;
  responseHeaders?: Record<string, string>;
  timeUtc: string;
  userAgentUsed: string;
  refererUsed?: string;
  retryCount: number;
  errorMessage: string;
}

export const [RecipeContext, useRecipes] = createContextHook(() => {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecipes = useCallback(async () => {
    try {
      setIsLoading(true);
      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const storedRecipes = await AsyncStorage.getItem(storageKey);
      if (storedRecipes) {
        const parsedRecipes = JSON.parse(storedRecipes);
        console.log(`📊 Loading ${parsedRecipes.length} recipes from storage`);
        
        parsedRecipes.forEach((recipe: Recipe) => {
          if (recipe.imageUri) {
            console.log(`✅ Recipe "${recipe.name}" has imageUri: ${recipe.imageUri.substring(0, 50)}...`);
          } else {
            console.log(`⚠️ Recipe "${recipe.name}" has NO imageUri`);
          }
        });
        
        setRecipes(parsedRecipes);
        
        const recipesWithImages = parsedRecipes.filter((r: Recipe) => r.imageUri).length;
        const recipesWithoutImages = parsedRecipes.filter((r: Recipe) => !r.imageUri).length;
        console.log(`📊 Loaded ${parsedRecipes.length} recipes: ${recipesWithImages} with images, ${recipesWithoutImages} without`);
      } else {
        setRecipes([]);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadRecipes();
    } else {
      setRecipes([]);
      setIsLoading(false);
    }
  }, [user, loadRecipes]);

  const saveRecipes = useCallback(async (updatedRecipes: Recipe[]) => {
    try {
      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const jsonString = JSON.stringify(updatedRecipes);
      await AsyncStorage.setItem(storageKey, jsonString);
      setRecipes(updatedRecipes);
    } catch (error) {
      console.error('Failed to save recipes:', error);
      throw error;
    }
  }, [user?.id]);

  const getMultipleFallbackImages = useCallback((recipeName: string, category: string): string[] => {
    const cleanName = recipeName
      .replace(/recipe/gi, '')
      .replace(/easy/gi, '')
      .replace(/best/gi, '')
      .replace(/homemade/gi, '')
      .replace(/delicious/gi, '')
      .replace(/quick/gi, '')
      .replace(/simple/gi, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(' ')
      .slice(0, 3)
      .join(' ');
    
    const timestamp = Date.now().toString().slice(-4);
    const searchTerm = encodeURIComponent(cleanName);
    const categoryTerm = encodeURIComponent(category.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, ''));
    
    return [
      `https://source.unsplash.com/featured/400x300/?${searchTerm},food,recipe,dish&sig=${timestamp}`,
      `https://source.unsplash.com/featured/400x300/?${categoryTerm},food,cooking&sig=${timestamp + 1}`,
      `https://source.unsplash.com/featured/400x300/?food,cooking,recipe&sig=${timestamp + 2}`,
      `https://source.unsplash.com/featured/400x300/?meal,dish,cuisine&sig=${timestamp + 3}`,
      `https://source.unsplash.com/featured/400x300/?kitchen,cooking,chef&sig=${timestamp + 4}`
    ];
  }, []);

  const generateFallbackImage = useCallback(async (recipeName: string, category: string): Promise<string> => {
    console.log(`🎨 Generating fallback image URL for "${recipeName}" in category "${category}"`);
    const fallbackUrls = getMultipleFallbackImages(recipeName, category);
    console.log(`✅ Using Unsplash fallback URL: ${fallbackUrls[0]}`);
    return fallbackUrls[0];
  }, [getMultipleFallbackImages]);

  const logImageFailure = useCallback(async (failure: ImageFetchFailure) => {
    try {
      const storageKey = `${IMAGE_FAILURES_STORAGE_KEY}-${user?.id}`;
      const storedFailures = await AsyncStorage.getItem(storageKey);
      const failures: ImageFetchFailure[] = storedFailures ? JSON.parse(storedFailures) : [];
      failures.push(failure);
      await AsyncStorage.setItem(storageKey, JSON.stringify(failures));
      console.log('📝 Logged image fetch failure:', failure);
    } catch (error) {
      console.error('Failed to log image failure:', error);
    }
  }, [user?.id]);

  const getImageFailures = useCallback(async (): Promise<ImageFetchFailure[]> => {
    try {
      const storageKey = `${IMAGE_FAILURES_STORAGE_KEY}-${user?.id}`;
      const storedFailures = await AsyncStorage.getItem(storageKey);
      return storedFailures ? JSON.parse(storedFailures) : [];
    } catch (error) {
      console.error('Failed to get image failures:', error);
      return [];
    }
  }, [user?.id]);

  const clearImageFailures = useCallback(async () => {
    try {
      const storageKey = `${IMAGE_FAILURES_STORAGE_KEY}-${user?.id}`;
      await AsyncStorage.removeItem(storageKey);
      console.log('✅ Cleared all image failure logs');
    } catch (error) {
      console.error('Failed to clear image failures:', error);
    }
  }, [user?.id]);

  const convertImageToBase64 = useCallback(async (imageUrl: string, pageUrl?: string): Promise<string | undefined> => {
    const maxRetries = 4;
    const baseDelays = [500, 1000, 2000, 4000];
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    let attemptCount = 0;
    let lastStatus: number | undefined;
    let lastError: string | undefined;
    let lastHeaders: Record<string, string> = {};
    
    let domain: string | undefined;
    try {
      domain = new URL(imageUrl).hostname;
    } catch (e) {
      console.log(`⚠️ Failed to parse image URL domain`);
    }
    
    const getCachedUserAgent = (): 'desktop' | 'mobile' => {
      if (domain && domainUserAgentCache.has(domain)) {
        const cached = domainUserAgentCache.get(domain)!;
        console.log(`✅ Using cached User-Agent for ${domain}: ${cached}`);
        return cached;
      }
      return 'desktop';
    };
    
    const getAlternateUserAgent = (current: 'desktop' | 'mobile'): 'desktop' | 'mobile' => {
      return current === 'desktop' ? 'mobile' : 'desktop';
    };
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attemptCount = attempt + 1;
      try {
        console.log(`🔄 Converting image to base64 (attempt ${attempt + 1}/${maxRetries + 1}): ${imageUrl.substring(0, 80)}...`);
        console.log(`🔗 Using page URL as Referer: ${pageUrl || 'not provided'}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const currentUAType = getCachedUserAgent();
        const headers: Record<string, string> = {
          'User-Agent': USER_AGENTS[currentUAType],
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        };
        
        if (pageUrl) {
          try {
            const pageOrigin = new URL(pageUrl).origin;
            headers['Referer'] = pageOrigin;
            console.log(`✅ Set Referer to origin: ${pageOrigin}`);
          } catch (e) {
            console.log(`⚠️ Failed to parse page URL, skipping Referer`);
          }
        }
        
        console.log(`📱 Using User-Agent: ${currentUAType}`);
        
        const response = await fetch(imageUrl, {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        lastStatus = response.status;
        response.headers.forEach((value, key) => {
          lastHeaders[key] = value;
        });
        
        if (!response.ok) {
          const status = response.status;
          lastError = `HTTP ${status}`;
          console.log(`❌ Failed to fetch image: HTTP ${status}`);
          
          if (status === 503 && attempt === 0 && domain) {
            const alternateUAType = getAlternateUserAgent(currentUAType);
            console.log(`🔄 HTTP 503: Immediately retrying with alternate User-Agent: ${alternateUAType}`);
            
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);
            
            const retryHeaders: Record<string, string> = {
              'User-Agent': USER_AGENTS[alternateUAType],
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            };
            
            if (pageUrl) {
              try {
                const pageOrigin = new URL(pageUrl).origin;
                retryHeaders['Referer'] = pageOrigin;
              } catch (e) {
                // Ignore
              }
            }
            
            try {
              const retryResponse = await fetch(imageUrl, {
                method: 'GET',
                headers: retryHeaders,
                signal: retryController.signal
              });
              
              clearTimeout(retryTimeoutId);
              
              if (retryResponse.ok) {
                lastStatus = retryResponse.status;
                lastHeaders = {};
                retryResponse.headers.forEach((value, key) => {
                  lastHeaders[key] = value;
                });
                console.log(`✅ Success with alternate User-Agent ${alternateUAType}, caching for domain ${domain}`);
                domainUserAgentCache.set(domain, alternateUAType);
                
                const retryContentType = retryResponse.headers.get('content-type');
                if (!retryContentType || !retryContentType.startsWith('image/')) {
                  console.log(`❌ Invalid or missing content-type: ${retryContentType || 'none'}`);
                  return undefined;
                }
                
                const retryContentLength = retryResponse.headers.get('content-length');
                const retryContentSize = retryContentLength ? parseInt(retryContentLength, 10) : 0;
                
                if (retryContentSize > 0 && retryContentSize > MAX_FILE_SIZE) {
                  console.log(`❌ Image too large: ${(retryContentSize / 1024 / 1024).toFixed(2)}MB (max 10MB)`);
                  return undefined;
                }
                
                if (retryContentSize > 0 && retryContentSize < 1024) {
                  console.log(`❌ Content too small: ${retryContentLength} bytes (minimum 1024)`);
                  return undefined;
                }
                
                const blob = await retryResponse.blob();
                
                if (blob.size > MAX_FILE_SIZE) {
                  console.log(`❌ Downloaded blob too large: ${(blob.size / 1024 / 1024).toFixed(2)}MB (max 10MB)`);
                  return undefined;
                }
                
                if (blob.size < 1024) {
                  console.log(`❌ Blob size too small: ${blob.size} bytes (minimum 1024)`);
                  return undefined;
                }
                
                return new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64String = reader.result as string;
                    console.log(`✅ Successfully converted image to base64 (${base64String.length} chars)`);
                    resolve(base64String);
                  };
                  reader.onerror = () => {
                    console.log(`❌ Failed to convert blob to base64`);
                    reject(new Error('Failed to convert blob to base64'));
                  };
                  reader.readAsDataURL(blob);
                });
              } else {
                console.log(`❌ Alternate User-Agent also failed: HTTP ${retryResponse.status}`);
                clearTimeout(retryTimeoutId);
              }
            } catch (retryError: any) {
              console.log(`❌ Alternate User-Agent fetch error:`, retryError.message || retryError);
              clearTimeout(retryTimeoutId);
            }
          }
          
          if ((status === 503 || status === 429) && attempt < maxRetries) {
            const jitter = 0.8 + Math.random() * 0.4;
            const delay = Math.round(baseDelays[attempt] * jitter);
            console.log(`⏳ Retry ${attempt + 1}/${maxRetries}: HTTP ${status} - waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          return undefined;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          console.log(`❌ Invalid or missing content-type: ${contentType || 'none'}`);
          return undefined;
        }
        
        const contentLength = response.headers.get('content-length');
        const contentSize = contentLength ? parseInt(contentLength, 10) : 0;
        
        if (contentSize > 0 && contentSize > MAX_FILE_SIZE) {
          console.log(`❌ Image too large: ${(contentSize / 1024 / 1024).toFixed(2)}MB (max 10MB)`);
          return undefined;
        }
        
        if (contentSize > 0 && contentSize < 1024) {
          console.log(`❌ Content too small: ${contentLength} bytes (minimum 1024)`);
          return undefined;
        }
        
        const blob = await response.blob();
        
        if (blob.size > MAX_FILE_SIZE) {
          console.log(`❌ Downloaded blob too large: ${(blob.size / 1024 / 1024).toFixed(2)}MB (max 10MB)`);
          return undefined;
        }
        
        if (blob.size < 1024) {
          console.log(`❌ Blob size too small: ${blob.size} bytes (minimum 1024)`);
          return undefined;
        }
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            console.log(`✅ Successfully converted image to base64 (${base64String.length} chars)`);
            resolve(base64String);
          };
          reader.onerror = () => {
            console.log(`❌ Failed to convert blob to base64`);
            reject(new Error('Failed to convert blob to base64'));
          };
          reader.readAsDataURL(blob);
        });
      } catch (error: any) {
        lastError = error.message || String(error);
        console.log(`❌ Error converting image to base64 (attempt ${attempt + 1}):`, error.message || error);
        
        if (attempt < maxRetries) {
          const jitter = 0.8 + Math.random() * 0.4;
          const delay = Math.round(baseDelays[attempt] * jitter);
          console.log(`⏳ Retry ${attempt + 1}/${maxRetries}: Error - waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return undefined;
      }
    }
    
    console.log(`❌ All ${maxRetries + 1} attempts failed for image: ${imageUrl.substring(0, 80)}...`);
    
    await logImageFailure({
      recipeUrl: pageUrl || 'unknown',
      imageUrl,
      httpStatus: lastStatus,
      responseHeaders: Object.keys(lastHeaders).length > 0 ? lastHeaders : undefined,
      timeUtc: new Date().toISOString(),
      userAgentUsed: USER_AGENTS[getCachedUserAgent()],
      refererUsed: pageUrl,
      retryCount: attemptCount,
      errorMessage: lastError || 'Unknown error after all retries'
    });
    
    return undefined;
  }, [logImageFailure]);

  const extractRecipeImage = useCallback(async (recipeName: string, recipeUrl: string, retryCount: number = 1): Promise<string | undefined> => {
    console.log(`🖼️ Starting image extraction for "${recipeName}"`);
    
    try {
      console.log(`📥 Fetching webpage HTML from: ${recipeUrl}`);
      const webpageController = new AbortController();
      const webpageTimeoutId = setTimeout(() => webpageController.abort(), 8000);
      
      const webpageResponse = await fetch(recipeUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: webpageController.signal
      });
      
      clearTimeout(webpageTimeoutId);
      
      if (!webpageResponse.ok) {
        console.log(`❌ Failed to fetch webpage: ${webpageResponse.status}`);
        return undefined;
      }
      
      const webpageHtml = await webpageResponse.text();
      console.log(`✅ Successfully fetched webpage HTML (${webpageHtml.length} chars)`);
      
      const imageUrls: string[] = [];
      
      const ogImageMatch = webpageHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (ogImageMatch && ogImageMatch[1]) {
        const imageUrl = ogImageMatch[1];
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          console.log(`✅ Found og:image: ${imageUrl}`);
          imageUrls.push(imageUrl);
        }
      }
      
      const twitterImageMatch = webpageHtml.match(/<meta\s+(?:name|property)="twitter:image"\s+content="([^"]+)"/i);
      if (twitterImageMatch && twitterImageMatch[1]) {
        const imageUrl = twitterImageMatch[1];
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          console.log(`✅ Found twitter:image: ${imageUrl}`);
          if (!imageUrls.includes(imageUrl)) {
            imageUrls.push(imageUrl);
          }
        }
      }
      
      if (imageUrls.length === 0) {
        console.log(`⚠️ No og:image or twitter:image found in HTML`);
        return undefined;
      }
      
      for (const imageUrl of imageUrls) {
        const base64Image = await convertImageToBase64(imageUrl, recipeUrl);
        if (base64Image) {
          return base64Image;
        }
      }
      
      console.log(`⚠️ All image URLs failed to convert to base64`);
      return undefined;
    } catch (error) {
      console.log(`❌ Error extracting image from webpage:`, error);
      return undefined;
    }
  }, [convertImageToBase64]);

  const extractRecipeContent = useCallback(async (recipeName: string, recipeUrl: string): Promise<{
    ingredients?: string;
    nutritionalFacts?: string;
    times?: string;
    instructions?: string;
    imageUrl?: string;
    category?: RecipeCategory;
  } | undefined> => {
    try {
      console.log(`🔍 Extracting complete recipe content for "${recipeName}" from ${recipeUrl}`);
      
      const webpageController = new AbortController();
      const webpageTimeoutId = setTimeout(() => webpageController.abort(), 10000);
      
      let webpageHtml: string;
      try {
        const webpageResponse = await fetch(recipeUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: webpageController.signal
        });
        
        clearTimeout(webpageTimeoutId);
        
        if (!webpageResponse.ok) {
          console.log(`❌ Failed to fetch webpage: ${webpageResponse.status}`);
          return undefined;
        }
        
        webpageHtml = await webpageResponse.text();
        console.log(`✅ Successfully fetched webpage HTML (${webpageHtml.length} chars)`);
      } catch (fetchError) {
        console.log(`❌ Error fetching webpage:`, fetchError);
        return undefined;
      }
      
      console.log(`🤖 Analyzing HTML content with AI for complete recipe extraction...`);
      const aiController = new AbortController();
      const aiTimeoutId = setTimeout(() => aiController.abort(), 20000);
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: aiController.signal,
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `🚨 ULTRA-PRECISE RECIPE DATA EXTRACTOR & CATEGORIZER 🚨

You are an expert recipe parser with ENHANCED categorization capabilities. Your task is to analyze the provided recipe web page and extract 6 sections:

🎯 EXTRACT THESE 6 FIELDS:
1. **INGREDIENTS** - Complete list with exact measurements
2. **NUTRITIONAL FACTS** - Calories, protein, carbs, fat, servings, etc.
3. **PREP/COOK/TOTAL TIME** - In minutes if available
4. **INSTRUCTIONS** - Step-by-step cooking directions with checkboxes
5. **MAIN RECIPE IMAGE** - Primary food photo URL
6. **CATEGORY** - EXACTLY ONE of: Breakfast, Appetizer, Salads & Soups, Main Course, Desserts

🔍 EXTRACTION PRIORITY:
1. JSON-LD structured data (highest priority)
2. Recipe schema markup (schema.org/Recipe)
3. Recipe card sections
4. Ingredient/instruction lists
5. Meta tags for images
6. Page title and content for categorization

✅ WHAT TO EXTRACT:
- Ingredients: Each ingredient on its own line with exact measurements
- Nutritional Facts: Calories, servings, protein, carbs, fat, fiber, sugar, sodium
- Times: Prep time, cook time, total time (convert to minutes)
- Instructions: Each step clearly numbered and actionable
- Image: Main recipe photo showing the finished dish (og:image, twitter:image, or largest food image)
- Category: Based on recipe analysis using strict rules below

🍲 CATEGORIZATION RULES (FOLLOW EXACTLY):
1. **Soups & Salads** (HIGHEST PRIORITY - check first):
   - ANY mention of: soup, stew, chili, bisque, chowder, broth, stock, gazpacho, minestrone, pho, ramen, miso
   - ANY mention of: salad, caesar, cobb, coleslaw, slaw, greens, lettuce
   - Liquid-based dishes served in bowls
   - Even if hearty (beef stew = Soups & Salads, NOT Main Course)

2. **Desserts** (SECOND PRIORITY):
   - Sweet dishes: cake, pie, cookie, ice cream, pudding, chocolate, candy, brownie
   - Baked sweets: muffins (sweet), pastries, tarts, custard

3. **Breakfast** (THIRD PRIORITY):
   - Morning foods: pancakes, waffles, eggs, oatmeal, cereal, toast
   - Breakfast-specific items: breakfast sandwich, morning smoothie

4. **Appetizer** (FOURTH PRIORITY):
   - Small plates: dips, spreads, wings, sliders, bruschetta, tapas
   - Finger foods and starters

5. **Main Course** (DEFAULT):
   - Everything else: meat dishes, pasta, pizza, casseroles, entrees

❌ WHAT TO IGNORE:
- Blog stories, personal anecdotes, introductions
- Ads, affiliate links, social media buttons
- Comments, reviews, ratings
- Equipment lists, serving suggestions (unless part of instructions)
- Author bios, related recipes

📝 REQUIRED OUTPUT FORMAT:
INGREDIENTS:
- [ingredient with exact measurement]
- [ingredient with exact measurement]

NUTRITIONAL FACTS:
Calories: [number per serving]
Servings: [number]
Prep Time: [minutes]
Cook Time: [minutes]
Total Time: [minutes]
Protein: [amount]
Carbs: [amount]
Fat: [amount]
[other nutrition facts if available]

TIMES:
Prep Time: [X minutes]
Cook Time: [X minutes]
Total Time: [X minutes]

INSTRUCTIONS:
☐ 1. [clear, actionable step]
☐ 2. [clear, actionable step]
☐ 3. [clear, actionable step]

IMAGE: [direct URL to main recipe photo]

CATEGORY: [Breakfast|Appetizer|Salads & Soups|Main Course|Desserts]

🚨 CRITICAL RULES:
- Extract ONLY the 6 fields above
- Use exact text from the webpage
- If a field is missing, write "Not available"
- Focus on JSON-LD/structured data first
- Instructions must be numbered with checkboxes (☐)
- Image must be the main recipe photo (not ads/icons)
- Category must be EXACTLY one of the 5 options
- Soup/stew/chili = Soups & Salads (NEVER Main Course)`
            },
            {
              role: 'user',
              content: `🎯 EXTRACT COMPLETE RECIPE DATA FROM HTML

Recipe Name: "${recipeName}"
Webpage URL: ${recipeUrl}

📋 HTML CONTENT TO ANALYZE:
${webpageHtml.substring(0, 80000)}

🔍 CRITICAL EXTRACTION TASK:
1. Scan the ENTIRE HTML content above for recipe data
2. Extract ALL 6 required fields: ingredients, nutritional facts, times, instructions, image, and category
3. Focus on structured data (JSON-LD, schema.org) first - look for recipe objects
4. Use exact text from the webpage - do not summarize or modify
5. Number instruction steps sequentially with checkboxes (☐ 1. ☐ 2. etc.)
6. Find the main recipe image URL (og:image, twitter:image, or main food photo)
7. Categorize using the strict rules: Soups & Salads takes priority over everything

🍲 CATEGORIZATION FOR "${recipeName}":
- If recipe contains ANY soup/stew/chili/broth words → Soups & Salads
- If sweet/dessert → Desserts
- If breakfast food → Breakfast
- If small plate/appetizer → Appetizer
- Otherwise → Main Course

✅ SUCCESS: Return all 6 fields in the exact format specified
❌ FAILURE: Return "Error: No recipe data detected on page." if no recipe found

Be extremely thorough - scan every section, every JSON-LD block, every schema markup.`
            }
          ]
        })
      });
      
      clearTimeout(aiTimeoutId);
      
      if (!response.ok) {
        console.log(`❌ AI API error for recipe extraction: ${response.status}`);
        return undefined;
      }
      
      const data = await response.json();
      if (!data?.completion) {
        console.log(`❌ No completion in AI response`);
        return undefined;
      }
      
      const result = data.completion.trim();
      console.log(`🤖 AI recipe extraction result for "${recipeName}": ${result.substring(0, 800)}...`);
      
      const extractedData: {
        ingredients?: string;
        nutritionalFacts?: string;
        times?: string;
        instructions?: string;
        imageUrl?: string;
        category?: RecipeCategory;
      } = {};
      
      const lines = result.split('\n');
      let currentSection: string | null = null;
      let sectionContent: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const upperLine = line.toUpperCase();
        
        if (upperLine.match(/^[A-Z][A-Z ]*:/) && !line.startsWith(' ')) {
          if (currentSection && sectionContent.length > 0) {
            const content = sectionContent.join('\n').trim();
            if (currentSection === 'INGREDIENTS') {
              extractedData.ingredients = content;
            } else if (currentSection === 'NUTRITIONAL' || currentSection === 'NUTRITION') {
              extractedData.nutritionalFacts = content;
            } else if (currentSection === 'TIMES' || currentSection === 'TIME') {
              extractedData.times = content;
            } else if (currentSection === 'INSTRUCTIONS' || currentSection === 'DIRECTIONS') {
              extractedData.instructions = content;
            }
          }
          
          const colonIndex = line.indexOf(':');
          const header = line.substring(0, colonIndex).toUpperCase().trim();
          const valueAfterColon = line.substring(colonIndex + 1).trim();
          
          if (header === 'IMAGE') {
            const imageUrl = valueAfterColon;
            if (imageUrl && imageUrl !== 'Not available' && imageUrl !== 'NONE' && 
                (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
              console.log(`✅ Found IMAGE in AI response: ${imageUrl}`);
              extractedData.imageUrl = imageUrl;
            } else {
              console.log(`⚠️ Invalid or missing IMAGE in AI response: ${imageUrl}`);
            }
            currentSection = null;
            sectionContent = [];
          } else if (header === 'CATEGORY') {
            const category = valueAfterColon;
            const validCategories: RecipeCategory[] = ['Breakfast', 'Appetizer', 'Salads & Soups', 'Main Course', 'Desserts'];
            if (validCategories.includes(category as RecipeCategory)) {
              console.log(`✅ Found CATEGORY in AI response: ${category}`);
              extractedData.category = category as RecipeCategory;
            } else {
              console.log(`⚠️ Invalid CATEGORY in AI response: ${category}`);
            }
            currentSection = null;
            sectionContent = [];
          } else {
            currentSection = header;
            sectionContent = valueAfterColon ? [valueAfterColon] : [];
          }
        } else if (currentSection) {
          sectionContent.push(line);
        }
      }
      
      if (currentSection && sectionContent.length > 0) {
        const content = sectionContent.join('\n').trim();
        if (currentSection === 'INGREDIENTS') {
          extractedData.ingredients = content;
        } else if (currentSection === 'NUTRITIONAL' || currentSection === 'NUTRITION') {
          extractedData.nutritionalFacts = content;
        } else if (currentSection === 'TIMES' || currentSection === 'TIME') {
          extractedData.times = content;
        } else if (currentSection === 'INSTRUCTIONS' || currentSection === 'DIRECTIONS') {
          extractedData.instructions = content;
        }
      }
      
      console.log(`✅ Successfully extracted recipe content for "${recipeName}"`, {
        hasIngredients: !!extractedData.ingredients,
        hasNutrition: !!extractedData.nutritionalFacts,
        hasTimes: !!extractedData.times,
        hasInstructions: !!extractedData.instructions,
        hasImage: !!extractedData.imageUrl,
        category: extractedData.category
      });
      
      return extractedData;
      
    } catch (error) {
      console.log(`❌ Error extracting recipe content for "${recipeName}":`, error);
      return undefined;
    }
  }, []);

  const addRecipe = useCallback(async (recipe: Omit<Recipe, 'id' | 'createdAt'>) => {
    try {
      console.log('📝 Adding recipe:', {
        name: recipe.name,
        category: recipe.category,
        hasUrl: !!recipe.url,
        hasImage: !!recipe.imageUri,
        hasContent: !!recipe.content
      });
      
      let finalRecipe = { ...recipe };
      if (recipe.url) {
        console.log('🔍 FORCING complete recipe content extraction for recipe with URL...');
        try {
          const extractedContent = await extractRecipeContent(recipe.name, recipe.url);
          
          if (extractedContent) {
            if (extractedContent.category) {
              finalRecipe.category = extractedContent.category;
              console.log(`🎯 AI updated category to: ${extractedContent.category}`);
            }
            
            let content = '';
            
            if (extractedContent.ingredients) {
              content += `**Ingredients:**\n${extractedContent.ingredients}\n\n`;
            }
            
            if (extractedContent.nutritionalFacts) {
              content += `**Nutritional Facts:**\n${extractedContent.nutritionalFacts}\n\n`;
            }
            
            if (extractedContent.times) {
              content += `**Times:**\n${extractedContent.times}\n\n`;
            }
            
            if (extractedContent.instructions) {
              content += `**Instructions:**\n${extractedContent.instructions}\n\n`;
            }
            
            finalRecipe.content = content.trim();
            
            if (extractedContent.imageUrl) {
              const imageUrl = extractedContent.imageUrl.trim();
              if (imageUrl.startsWith('data:image/')) {
                console.log(`✅ Using base64 image data directly: ${imageUrl.substring(0, 50)}...`);
                finalRecipe.imageUri = imageUrl;
              } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                console.log(`🔄 Converting extracted image URL to base64: ${imageUrl.substring(0, 80)}...`);
                const base64Image = await convertImageToBase64(imageUrl, recipe.url);
                if (base64Image) {
                  console.log(`✅ Successfully converted image to base64`);
                  finalRecipe.imageUri = base64Image;
                } else {
                  console.log(`⚠️ Failed to convert image, using fallback...`);
                  finalRecipe.imageUri = await generateFallbackImage(recipe.name, finalRecipe.category);
                }
              } else {
                console.log(`⚠️ Invalid image URL format, using fallback...`);
                finalRecipe.imageUri = await generateFallbackImage(recipe.name, finalRecipe.category);
              }
            } else {
              console.log('⚠️ No image found in extraction, using fallback...');
              finalRecipe.imageUri = await generateFallbackImage(recipe.name, finalRecipe.category);
            }
          } else {
            console.log('⚠️ Recipe content extraction failed, using fallback image...');
            finalRecipe.imageUri = await generateFallbackImage(recipe.name, recipe.category);
          }
        } catch (error) {
          console.log('⚠️ Error during recipe content extraction, using fallback:', error);
          finalRecipe.imageUri = await generateFallbackImage(recipe.name, recipe.category);
        }
      }
      
      const newRecipe: Recipe = {
        ...finalRecipe,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      };
      
      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const storedRecipes = await AsyncStorage.getItem(storageKey);
      const currentRecipes = storedRecipes ? JSON.parse(storedRecipes) : [];
      
      const existingRecipe = currentRecipes.find((r: Recipe) => r.url === newRecipe.url);
      if (existingRecipe) {
        console.log('⚠️ Recipe already exists, skipping duplicate');
        return false;
      }
      
      const updatedRecipes = [...currentRecipes, newRecipe];
      await saveRecipes(updatedRecipes);
      console.log('✅ Recipe added successfully with guaranteed image');
      return true;
    } catch (error) {
      console.error('Failed to add recipe:', error);
      return false;
    }
  }, [user?.id, saveRecipes, extractRecipeContent, generateFallbackImage]);

  const updateRecipe = useCallback(async (updatedRecipe: Recipe) => {
    try {
      const updatedRecipes = recipes.map(recipe => 
        recipe.id === updatedRecipe.id ? updatedRecipe : recipe
      );
      await saveRecipes(updatedRecipes);
      return true;
    } catch (error) {
      console.error('Failed to update recipe:', error);
      return false;
    }
  }, [recipes, saveRecipes]);

  const updateRecipeStepProgress = useCallback(async (recipeId: string, stepProgress: { [stepIndex: number]: boolean }) => {
    try {
      const updatedRecipes = recipes.map(recipe => 
        recipe.id === recipeId 
          ? { ...recipe, stepProgress }
          : recipe
      );
      await saveRecipes(updatedRecipes);
      return true;
    } catch (error) {
      console.error('Failed to update recipe step progress:', error);
      return false;
    }
  }, [recipes, saveRecipes]);

  const deleteRecipe = useCallback(async (recipeId: string) => {
    try {
      const recipeToDelete = recipes.find(recipe => recipe.id === recipeId);
      if (!recipeToDelete) {
        return false;
      }
      
      const updatedRecipes = recipes.filter(recipe => recipe.id !== recipeId);
      await saveRecipes(updatedRecipes);
      return true;
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      return false;
    }
  }, [recipes, saveRecipes]);

  const toggleFavorite = useCallback(async (recipeId: string) => {
    try {
      const updatedRecipes = recipes.map(recipe => 
        recipe.id === recipeId 
          ? { ...recipe, isFavorite: !recipe.isFavorite }
          : recipe
      );
      await saveRecipes(updatedRecipes);
      return true;
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      return false;
    }
  }, [recipes, saveRecipes]);

  const changeRecipeCategory = useCallback(async (recipeId: string, newCategory: RecipeCategory) => {
    try {
      const updatedRecipes = recipes.map(recipe => 
        recipe.id === recipeId 
          ? { ...recipe, category: newCategory }
          : recipe
      );
      await saveRecipes(updatedRecipes);
      return true;
    } catch (error) {
      console.error('Failed to change recipe category:', error);
      return false;
    }
  }, [recipes, saveRecipes]);

  const getRecipesByCategory = useCallback((category: RecipeCategory) => {
    return recipes.filter(recipe => recipe.category === category);
  }, [recipes]);

  const debugStorage = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('All AsyncStorage keys:', allKeys);
      
      const recipeKeys = allKeys.filter(key => key.includes('meal-planner-recipes'));
      console.log('Recipe storage keys:', recipeKeys);
      
      for (const key of recipeKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`Storage ${key}:`, value);
      }
    } catch (error) {
      console.error('Debug storage error:', error);
    }
  }, []);

  const reExtractImages = useCallback(async () => {
    try {
      console.log('🔄 Starting image re-extraction for recipes without images...');
      
      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const storedRecipes = await AsyncStorage.getItem(storageKey);
      const currentRecipes = storedRecipes ? JSON.parse(storedRecipes) : [];
      
      const recipesWithoutImages = currentRecipes.filter((recipe: Recipe) => recipe.url && !recipe.imageUri);
      console.log(`📊 Found ${recipesWithoutImages.length} recipes without images`);
      
      if (recipesWithoutImages.length === 0) {
        console.log('✅ All recipes already have images');
        return { success: 0, failed: 0 };
      }
      
      let successCount = 0;
      let failedCount = 0;
      let workingRecipes = [...currentRecipes];
      
      for (let i = 0; i < recipesWithoutImages.length; i++) {
        const recipe = recipesWithoutImages[i];
        console.log(`🔍 [${i + 1}/${recipesWithoutImages.length}] Re-extracting image for: "${recipe.name}"`);
        
        try {
          const imageUri = await extractRecipeImage(recipe.name, recipe.url!, 2);
          
          if (imageUri) {
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Successfully extracted image for: "${recipe.name}"`);
            successCount++;
          } else {
            console.log(`⚠️ Extraction failed, generating fallback for: "${recipe.name}"`);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Generated fallback image for: "${recipe.name}"`);
            successCount++;
          }
        } catch (error) {
          try {
            console.log(`⚠️ Error occurred, generating fallback for: "${recipe.name}"`, error);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Generated fallback after error for: "${recipe.name}"`);
            successCount++;
          } catch (fallbackError) {
            failedCount++;
            console.log(`❌ [${i + 1}/${recipesWithoutImages.length}] Complete failure for: "${recipe.name}"`, fallbackError);
          }
        }
        
        await saveRecipes(workingRecipes);
        
        if (i < recipesWithoutImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`🎉 Image re-extraction complete: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('❌ Error during image re-extraction:', error);
      return { success: 0, failed: 0 };
    }
  }, [user?.id, extractRecipeImage, saveRecipes, generateFallbackImage]);

  const forceReExtractAllImages = useCallback(async () => {
    try {
      console.log('🚀 FORCE re-extracting images for ALL recipes with URLs...');
      
      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const storedRecipes = await AsyncStorage.getItem(storageKey);
      const currentRecipes = storedRecipes ? JSON.parse(storedRecipes) : [];
      
      const recipesWithUrls = currentRecipes.filter((recipe: Recipe) => recipe.url);
      console.log(`📊 Found ${recipesWithUrls.length} recipes with URLs to re-extract`);
      
      if (recipesWithUrls.length === 0) {
        console.log('✅ No recipes with URLs found');
        return { success: 0, failed: 0 };
      }
      
      let successCount = 0;
      let failedCount = 0;
      let workingRecipes = [...currentRecipes];
      
      for (let i = 0; i < recipesWithUrls.length; i++) {
        const recipe = recipesWithUrls[i];
        console.log(`🔍 [${i + 1}/${recipesWithUrls.length}] FORCE re-extracting image for: "${recipe.name}"`);
        
        try {
          const imageUri = await extractRecipeImage(recipe.name, recipe.url!, 3);
          
          if (imageUri) {
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Successfully FORCE extracted image for: "${recipe.name}"`);
            successCount++;
          } else {
            console.log(`⚠️ FORCE extraction failed, generating fallback for: "${recipe.name}"`);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Generated fallback after FORCE extraction for: "${recipe.name}"`);
            successCount++;
          }
        } catch (error) {
          try {
            console.log(`⚠️ FORCE extraction error, generating fallback for: "${recipe.name}"`, error);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Generated fallback after FORCE error for: "${recipe.name}"`);
            successCount++;
          } catch (fallbackError) {
            failedCount++;
            console.log(`❌ [${i + 1}/${recipesWithUrls.length}] Complete FORCE failure for: "${recipe.name}"`, fallbackError);
          }
        }
        
        await saveRecipes(workingRecipes);
        
        if (i < recipesWithUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      console.log(`🎉 FORCE image re-extraction complete: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('❌ Error during FORCE image re-extraction:', error);
      return { success: 0, failed: 0 };
    }
  }, [user?.id, extractRecipeImage, saveRecipes, generateFallbackImage]);

  const contextValue = useMemo(() => ({
    recipes,
    isLoading,
    addRecipe,
    updateRecipe,
    updateRecipeStepProgress,
    deleteRecipe,
    toggleFavorite,
    changeRecipeCategory,
    getRecipesByCategory,
    refreshRecipes: loadRecipes,
    debugStorage,
    extractRecipeImage,
    extractRecipeContent,
    reExtractImages,
    forceReExtractAllImages,
    generateFallbackImage,
    convertImageToBase64,
    getImageFailures,
    clearImageFailures,
  }), [recipes, isLoading, addRecipe, updateRecipe, updateRecipeStepProgress, deleteRecipe, toggleFavorite, changeRecipeCategory, getRecipesByCategory, loadRecipes, debugStorage, extractRecipeImage, extractRecipeContent, reExtractImages, forceReExtractAllImages, generateFallbackImage, convertImageToBase64, getImageFailures, clearImageFailures]);

  return contextValue;
});
