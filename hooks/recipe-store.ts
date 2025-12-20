import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { Recipe, RecipeCategory } from '@/types';
import { useAuth } from './auth-store';
import { supabase } from '@/lib/supabase';

const RECIPES_STORAGE_KEY = 'meal-planner-recipes';

const DEFAULT_THUMBNAIL_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

const [RecipeContext, useRecipes] = createContextHook(() => {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecipesFromSupabase = useCallback(async (ownerUserId: string): Promise<Recipe[]> => {
    try {
      console.log(`📥 Loading recipes from Supabase for user: ${ownerUserId}`);
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase loadRecipes error:', JSON.stringify(error, null, 2));
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        console.error('❌ Error hint:', error.hint);
        return [];
      }

      const recipes = (data || []).map((row: any) => ({
        ...row.data_json,
        id: row.id,
      })) as Recipe[];

      console.log(`✅ Loaded ${recipes.length} recipes from Supabase`);
      return recipes;
    } catch (error) {
      console.error('❌ Failed to load recipes from Supabase:', error);
      return [];
    }
  }, []);

  const syncRecipeToSupabase = useCallback(async (recipe: Recipe, ownerUserId: string) => {
    try {
      if (!ownerUserId) {
        console.error('❌ syncRecipeToSupabase called without ownerUserId', { recipeId: recipe.id });
        return;
      }

      const { error } = await supabase
        .from('recipes')
        .upsert(
          {
            id: recipe.id,
            owner_user_id: ownerUserId,
            name: recipe.name,
            category: recipe.category,
            data_json: recipe,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('❌ Supabase syncRecipe error:', JSON.stringify(error, null, 2));
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        console.error('❌ Error hint:', error.hint);
      } else {
        console.log('✅ Synced recipe to Supabase', recipe.id, ownerUserId);
      }
    } catch (error) {
      console.error('❌ Failed to sync recipe to Supabase:', error);
    }
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!user?.id) {
        setRecipes([]);
        return;
      }

      const supabaseRecipes = await loadRecipesFromSupabase(user.id);
      
      if (supabaseRecipes.length > 0) {
        console.log(`📊 Loaded ${supabaseRecipes.length} recipes from Supabase`);
        setRecipes(supabaseRecipes);
        
        const storageKey = `${RECIPES_STORAGE_KEY}-${user.id}`;
        await AsyncStorage.setItem(storageKey, JSON.stringify(supabaseRecipes));
      } else {
        console.log('📦 No recipes in Supabase, checking AsyncStorage for legacy data...');
        const storageKey = `${RECIPES_STORAGE_KEY}-${user.id}`;
        const storedRecipes = await AsyncStorage.getItem(storageKey);
        if (storedRecipes) {
          const parsedRecipes = JSON.parse(storedRecipes);
          console.log(`📊 Loaded ${parsedRecipes.length} recipes from local storage, syncing to Supabase...`);
          
          const recipesWithOwner = parsedRecipes.map((recipe: Recipe) => ({
            ...recipe,
            ownerUserId: user.id
          }));
          
          setRecipes(recipesWithOwner);
          
          for (const recipe of recipesWithOwner) {
            await syncRecipeToSupabase(recipe, user.id);
          }
        } else {
          setRecipes([]);
        }
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, loadRecipesFromSupabase, syncRecipeToSupabase]);

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
      const recipesWithOwner = updatedRecipes.map(recipe => ({
        ...recipe,
        ownerUserId: recipe.ownerUserId || user?.id
      }));

      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const jsonString = JSON.stringify(recipesWithOwner);
      await AsyncStorage.setItem(storageKey, jsonString);
      setRecipes(recipesWithOwner);
      
      if (user?.id) {
        for (const recipe of recipesWithOwner) {
          await syncRecipeToSupabase(recipe, recipe.ownerUserId || user.id);
        }
      }
    } catch (error) {
      console.error('Failed to save recipes:', error);
      throw error;
    }
  }, [user?.id, syncRecipeToSupabase]);

  const generateAiThumbnail = useCallback(async (recipeName: string, category: string): Promise<string> => {
    console.log(`🎨 Rork AI thumbnail generation for "${recipeName}" in category "${category}"`);

    try {
      const safeName = (recipeName || "").toString().trim();
      const safeCategory = (category || "").toString().trim();

      // Build the prompt using ONLY text (no URLs, no image data)
      const promptText = safeCategory
        ? `Photorealistic, high-quality food photography of a dish called "${safeName}", in the "${safeCategory}" category. Bright natural lighting, shallow depth of field, appetizing, realistic.`
        : `Photorealistic, high-quality food photography of a dish called "${safeName}". Bright natural lighting, shallow depth of field, appetizing, realistic.`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("https://toolkit.rork.com/images/generate/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: promptText,
          size: "1024x1024",
        }),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        const b64 = data?.image?.base64Data;
        const mimeType = data?.image?.mimeType || "image/png";

        if (b64 && typeof b64 === "string" && b64.length > 100) {
          const dataUri = b64.startsWith("data:")
            ? b64
            : `data:${mimeType};base64,${b64}`;
          console.log(`✅ AI-generated thumbnail created (${dataUri.length} chars)`);
          return dataUri;
        } else {
          console.warn("⚠️ AI response did not contain a usable base64 image");
        }
      } else {
        console.warn(`⚠️ Rork AI image generation failed: HTTP ${response.status}`);
      }
    } catch (error: any) {
      console.warn("⚠️ Rork AI image generation error:", error?.message || error);
    }

    // If we reach this point, AI generation failed
    console.log(`❌ AI generation completely failed for "${recipeName}", returning empty string`);
    return "";
  }, []);

  const generateFallbackImage = useCallback(async (recipeName: string, category: string): Promise<string> => {
    console.log(`🎨 Fallback image requested for "${recipeName}"`);

    try {
      const aiThumbnail = await generateAiThumbnail(recipeName, category);
      if (aiThumbnail && aiThumbnail.startsWith("data:")) {
        console.log(`✅ Using AI-generated thumbnail for "${recipeName}"`);
        return aiThumbnail;
      }
      console.log(`⚠️ AI thumbnail was missing or not a data URI for "${recipeName}", using built-in placeholder.`);
    } catch (error) {
      console.warn(`⚠️ Error during AI fallback generation for "${recipeName}", using built-in placeholder:`, error);
    }

    console.log(`❌ Using DEFAULT_THUMBNAIL_DATA_URI for "${recipeName}"`);
    return DEFAULT_THUMBNAIL_DATA_URI;
  }, [generateAiThumbnail]);

  const convertImageToBase64 = useCallback(async (imageUrl: string, recipeName?: string, category?: string): Promise<string | undefined> => {
    try {
      console.log(`🔄 Converting image to base64: ${imageUrl.substring(0, 80)}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': imageUrl,
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`❌ Failed to fetch image: HTTP ${response.status} ${response.statusText}`);
        if (recipeName && category && (response.status === 503 || response.status === 403 || response.status >= 400)) {
          console.log(`🎨 HTTP ${response.status} detected, generating AI thumbnail instead...`);
          const aiThumbnail = await generateAiThumbnail(recipeName, category);
          if (aiThumbnail && aiThumbnail.startsWith('data:')) {
            console.log(`✅ Replaced failed HTTP ${response.status} image with AI thumbnail`);
            return aiThumbnail;
          }
        }
        return undefined;
      }
      
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      if (!contentType.startsWith('image/')) {
        console.log(`❌ Invalid content-type: ${contentType}`);
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
      console.log(`❌ Error converting image to base64:`, error.message || error);
      if (recipeName && category && error.message) {
        console.log(`🎨 Fetch error detected, generating AI thumbnail instead...`);
        const aiThumbnail = await generateAiThumbnail(recipeName, category);
        if (aiThumbnail && aiThumbnail.startsWith('data:')) {
          console.log(`✅ Replaced failed fetch with AI thumbnail`);
          return aiThumbnail;
        }
      }
      return undefined;
    }
  }, [generateAiThumbnail]);

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
        const base64Image = await convertImageToBase64(imageUrl, recipeName, 'Main Course');
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
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    calories?: string;
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
      
      interface ScrapedRecipeMeta {
        prepTime?: string;
        cookTime?: string;
        totalTime?: string;
        calories?: string;
        nutritionalFacts?: string;
        instructions?: string;
      }
      
      const scrapedMeta: ScrapedRecipeMeta = {};

      const normalizeInstructionText = (text: string): string => {
        return (text || '').toString().replace(/\s+/g, ' ').trim();
      };

      const buildCheckboxSteps = (steps: string[]): string => {
        const cleaned = steps
          .map(s => normalizeInstructionText(s))
          .filter(s => s.length > 0);

        if (!cleaned.length) return '';

        return cleaned.map((s, idx) => `☐ ${idx + 1}. ${s}`).join('\n');
      };

      const extractRecipeInstructionsFromJsonLd = (recipeItem: any): string => {
        const raw = recipeItem?.recipeInstructions;
        if (!raw) return '';

        const steps: string[] = [];

        const pushStep = (value: any) => {
          if (!value) return;
          if (typeof value === 'string') {
            steps.push(value);
            return;
          }
          if (typeof value === 'object') {
            const textCandidate = value.text ?? value.name ?? value.description;
            if (typeof textCandidate === 'string') {
              steps.push(textCandidate);
              return;
            }

            if (Array.isArray(value.itemListElement)) {
              for (const el of value.itemListElement) pushStep(el);
              return;
            }
          }
        };

        if (typeof raw === 'string') {
          const split = raw
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);
          return buildCheckboxSteps(split);
        }

        if (Array.isArray(raw)) {
          for (const entry of raw) pushStep(entry);
          return buildCheckboxSteps(steps);
        }

        if (typeof raw === 'object') {
          pushStep(raw);
          return buildCheckboxSteps(steps);
        }

        return '';
      };
      
      function convertIsoDurationToReadable(duration: string): string {
        try {
          const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
          if (!match) return duration;
          const [, days, hours, minutes, seconds] = match;
          const parts: string[] = [];
          if (days) parts.push(`${days} day${days === '1' ? '' : 's'}`);
          if (hours) parts.push(`${hours} hour${hours === '1' ? '' : 's'}`);
          if (minutes) parts.push(`${minutes} minute${minutes === '1' ? '' : 's'}`);
          if (seconds) parts.push(`${seconds} second${seconds === '1' ? '' : 's'}`);
          return parts.join(' ') || duration;
        } catch {
          return duration;
        }
      }
      
      console.log('🔍 Attempting to extract structured data from HTML (JSON-LD/schema.org)...');
      
      const ldJsonBlocks = webpageHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
      
      for (const block of ldJsonBlocks) {
        const jsonMatch = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (!jsonMatch) continue;
        const jsonText = jsonMatch[1].trim();
        try {
          const parsed = JSON.parse(jsonText);
          
          const candidates = Array.isArray(parsed) ? parsed : [parsed];
          
          for (const item of candidates) {
            if (!item || typeof item !== 'object') continue;
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            if (!types || !types.some((t: any) => typeof t === 'string' && t.toLowerCase() === 'recipe')) {
              continue;
            }
            
            console.log('✅ Found Recipe schema in JSON-LD');
            
            if (!scrapedMeta.instructions) {
              const instructionsFromJsonLd = extractRecipeInstructionsFromJsonLd(item);
              if (instructionsFromJsonLd) {
                scrapedMeta.instructions = instructionsFromJsonLd;
                console.log(`  Instructions: extracted ${instructionsFromJsonLd.split('\n').length} lines from JSON-LD`);
              }
            }

            if (typeof item.prepTime === 'string' && !scrapedMeta.prepTime) {
              scrapedMeta.prepTime = convertIsoDurationToReadable(item.prepTime);
              console.log(`  Prep Time: ${scrapedMeta.prepTime}`);
            }
            if (typeof item.cookTime === 'string' && !scrapedMeta.cookTime) {
              scrapedMeta.cookTime = convertIsoDurationToReadable(item.cookTime);
              console.log(`  Cook Time: ${scrapedMeta.cookTime}`);
            }
            if (typeof item.totalTime === 'string' && !scrapedMeta.totalTime) {
              scrapedMeta.totalTime = convertIsoDurationToReadable(item.totalTime);
              console.log(`  Total Time: ${scrapedMeta.totalTime}`);
            }
            
            if (item.nutrition && typeof item.nutrition === 'object') {
              const nutrition = item.nutrition;
              if (typeof nutrition.calories === 'string' && !scrapedMeta.calories) {
                scrapedMeta.calories = nutrition.calories.trim();
                console.log(`  Calories: ${scrapedMeta.calories}`);
              }
              
              const nutritionLines: string[] = [];
              for (const key of Object.keys(nutrition)) {
                const value = nutrition[key];
                if (!value || typeof value !== 'string') continue;
                nutritionLines.push(`${key}: ${value}`);
              }
              if (nutritionLines.length && !scrapedMeta.nutritionalFacts) {
                scrapedMeta.nutritionalFacts = nutritionLines.join('\n');
                console.log(`  Nutrition Facts: ${nutritionLines.length} fields`);
              }
            }
          }
        } catch (jsonError) {
          console.log('⚠️ Failed to parse JSON-LD block:', jsonError);
        }
      }
      
      if (scrapedMeta.prepTime || scrapedMeta.cookTime || scrapedMeta.totalTime || scrapedMeta.calories) {
        console.log('✅ Successfully extracted structured recipe metadata from HTML');
      } else {
        console.log('⚠️ No structured recipe metadata found in HTML, will rely on AI extraction');
      }
      
      console.log(`🤖 Analyzing HTML content with AI for complete recipe extraction...`);
      const aiController = new AbortController();
      const aiTimeoutId = setTimeout(() => aiController.abort(), 25000);
      
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
              content: `🚨 STRICT JSON RECIPE EXTRACTOR 🚨

You are an expert recipe parser. Extract recipe data from HTML and return ONLY valid JSON.

CRITICAL: For instructions, you MUST copy them word-for-word from the source HTML/JSON-LD. Do NOT summarize, do NOT paraphrase, do NOT reorder, do NOT merge steps, and do NOT omit warnings/notes/parenthetical details. Preserve punctuation and wording exactly as written on the page.

🎯 REQUIRED OUTPUT FORMAT (STRICT JSON):
{
  "ingredients": "one ingredient per line",
  "instructions": "one step per line with checkboxes",
  "times": "formatted human-readable summary of times",
  "prepTime": "prep time only, human-readable like '15 minutes'",
  "cookTime": "cook time only, human-readable like '30 minutes'",
  "totalTime": "total time only, human-readable like '45 minutes'",
  "nutritionalFacts": "multi-line nutrition summary",
  "calories": "calories only, like '320 kcal' or '320'",
  "category": "one of: Breakfast, Appetizer, Salads & Soups, Main Course, Desserts",
  "imageUrl": "direct image URL if available"
}

🔍 EXTRACTION PRIORITY:
1. JSON-LD structured data (highest priority - look for @type:Recipe)
2. Recipe schema markup (schema.org/Recipe)
3. Recipe card sections
4. Meta tags

🍲 CATEGORIZATION RULES:
1. Soups & Salads: soup, stew, chili, salad (HIGHEST PRIORITY)
2. Desserts: cake, pie, cookie, sweet
3. Breakfast: eggs, pancakes, waffles
4. Appetizer: dips, wings, small plates
5. Main Course: everything else

⚠️ CRITICAL RULES:
- Return ONLY valid JSON, NO markdown, NO backticks, NO extra text
- If a field is missing, set it to empty string ""
- All values must be strings
- Instructions must have checkboxes like "☐ 1. Step text" (but the step text itself must be copied verbatim from the page; only add the checkbox + numbering prefix)
- Times must be human-readable (not ISO durations)
- Category must be exactly one of the 5 options

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
              content: `Extract recipe data from this HTML and return ONLY valid JSON.

Recipe Name: "${recipeName}"
URL: ${recipeUrl}

HTML:
${webpageHtml.substring(0, 80000)}

⚠️ RETURN ONLY JSON - NO MARKDOWN, NO BACKTICKS, NO EXTRA TEXT

Example output:
{"ingredients":"1 cup flour\\n2 eggs\\n1/2 tsp salt","instructions":"☐ 1. Mix flour\\n☐ 2. Add eggs","times":"Prep: 10 min, Cook: 20 min","prepTime":"10 minutes","cookTime":"20 minutes","totalTime":"30 minutes","nutritionalFacts":"Calories: 250\\nProtein: 8g","calories":"250","category":"Main Course","imageUrl":"https://example.com/image.jpg"}

Extract all fields. If missing, use empty string. Convert ISO durations to readable format.`
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
      
      let result = data.completion.trim();
      console.log(`🤖 AI recipe extraction result for "${recipeName}": ${result.substring(0, 400)}...`);
      
      const extractedData: {
        ingredients?: string;
        nutritionalFacts?: string;
        times?: string;
        instructions?: string;
        imageUrl?: string;
        category?: RecipeCategory;
        prepTime?: string;
        cookTime?: string;
        totalTime?: string;
        calories?: string;
      } = {};
      
      try {
        if (result.startsWith('```json')) {
          result = result.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (result.startsWith('```')) {
          result = result.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const jsonData = JSON.parse(result);
        console.log('✅ Successfully parsed JSON response from AI');
        
        if (jsonData.ingredients && typeof jsonData.ingredients === 'string') {
          extractedData.ingredients = jsonData.ingredients;
        }
        if (jsonData.instructions && typeof jsonData.instructions === 'string') {
          extractedData.instructions = jsonData.instructions;
        }
        if (jsonData.nutritionalFacts && typeof jsonData.nutritionalFacts === 'string') {
          extractedData.nutritionalFacts = jsonData.nutritionalFacts;
        }
        if (jsonData.times && typeof jsonData.times === 'string') {
          extractedData.times = jsonData.times;
        }
        if (jsonData.prepTime && typeof jsonData.prepTime === 'string') {
          extractedData.prepTime = jsonData.prepTime;
        }
        if (jsonData.cookTime && typeof jsonData.cookTime === 'string') {
          extractedData.cookTime = jsonData.cookTime;
        }
        if (jsonData.totalTime && typeof jsonData.totalTime === 'string') {
          extractedData.totalTime = jsonData.totalTime;
        }
        if (jsonData.calories && typeof jsonData.calories === 'string') {
          extractedData.calories = jsonData.calories;
        }
        if (jsonData.imageUrl && typeof jsonData.imageUrl === 'string' && 
            (jsonData.imageUrl.startsWith('http://') || jsonData.imageUrl.startsWith('https://'))) {
          extractedData.imageUrl = jsonData.imageUrl;
        }
        if (jsonData.category && typeof jsonData.category === 'string') {
          const validCategories: RecipeCategory[] = ['Breakfast', 'Appetizer', 'Salads & Soups', 'Main Course', 'Desserts'];
          if (validCategories.includes(jsonData.category as RecipeCategory)) {
            extractedData.category = jsonData.category as RecipeCategory;
          }
        }
      } catch {
        console.log('⚠️ Failed to parse JSON from AI, falling back to text parsing');
        
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
                extractedData.imageUrl = imageUrl;
              }
              currentSection = null;
              sectionContent = [];
            } else if (header === 'CATEGORY') {
              const category = valueAfterColon;
              const validCategories: RecipeCategory[] = ['Breakfast', 'Appetizer', 'Salads & Soups', 'Main Course', 'Desserts'];
              if (validCategories.includes(category as RecipeCategory)) {
                extractedData.category = category as RecipeCategory;
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
      }
      
      extractedData.prepTime = scrapedMeta.prepTime || extractedData.prepTime;
      extractedData.cookTime = scrapedMeta.cookTime || extractedData.cookTime;
      extractedData.totalTime = scrapedMeta.totalTime || extractedData.totalTime;
      extractedData.calories = scrapedMeta.calories || extractedData.calories;
      if (scrapedMeta.nutritionalFacts && !extractedData.nutritionalFacts) {
        extractedData.nutritionalFacts = scrapedMeta.nutritionalFacts;
      }
      if (scrapedMeta.instructions) {
        extractedData.instructions = scrapedMeta.instructions;
      }
      
      if (!extractedData.prepTime && extractedData.times) {
        const prepMatch = extractedData.times.match(/prep\s*(?:time)?\s*[:\-]?\s*([^\n,]+)/i);
        if (prepMatch && prepMatch[1]) {
          extractedData.prepTime = prepMatch[1].trim();
        }
      }
      
      if (!extractedData.cookTime && extractedData.times) {
        const cookMatch = extractedData.times.match(/cook\s*(?:time)?\s*[:\-]?\s*([^\n,]+)/i);
        if (cookMatch && cookMatch[1]) {
          extractedData.cookTime = cookMatch[1].trim();
        }
      }
      
      if (!extractedData.totalTime && extractedData.times) {
        const totalMatch = extractedData.times.match(/total\s*(?:time)?\s*[:\-]?\s*([^\n,]+)/i);
        if (totalMatch && totalMatch[1]) {
          extractedData.totalTime = totalMatch[1].trim();
        }
      }
      
      if (!extractedData.calories && extractedData.nutritionalFacts) {
        const caloriesMatch =
          extractedData.nutritionalFacts.match(/calories?\s*[:\-]?\s*([^\n,]+)/i) ||
          extractedData.nutritionalFacts.match(/(\d+)\s*calories\b/i);
        
        if (caloriesMatch && caloriesMatch[1]) {
          extractedData.calories = caloriesMatch[1].trim();
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

  const addRecipe = useCallback(async (recipe: Omit<Recipe, 'id' | 'createdAt'>, ownerUserId?: string) => {
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
            
            // Persist structured time/nutrition fields
            if (extractedContent.prepTime) {
              finalRecipe.prepTime = extractedContent.prepTime;
            }
            if (extractedContent.cookTime) {
              finalRecipe.cookTime = extractedContent.cookTime;
            }
            if (extractedContent.totalTime) {
              finalRecipe.totalTime = extractedContent.totalTime;
            }
            if (extractedContent.calories) {
              finalRecipe.calories = extractedContent.calories;
            }
            if (extractedContent.nutritionalFacts) {
              finalRecipe.nutritionalInfo = extractedContent.nutritionalFacts;
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
                const base64Image = await convertImageToBase64(imageUrl, recipe.name, finalRecipe.category);
                if (base64Image && base64Image.startsWith('data:')) {
                  console.log(`✅ Successfully converted/generated image`);
                  finalRecipe.imageUri = base64Image;
                } else {
                  console.log(`⚠️ Image conversion failed, generating AI fallback...`);
                  const aiFallback = await generateAiThumbnail(recipe.name, finalRecipe.category);
                  finalRecipe.imageUri = aiFallback || await generateFallbackImage(recipe.name, finalRecipe.category);
                }
              } else {
                console.log(`⚠️ Invalid image URL format, generating AI fallback...`);
                const aiFallback = await generateAiThumbnail(recipe.name, finalRecipe.category);
                finalRecipe.imageUri = aiFallback || await generateFallbackImage(recipe.name, finalRecipe.category);
              }
            } else {
              console.log('⚠️ No image found in extraction, generating AI fallback...');
              const aiFallback = await generateAiThumbnail(recipe.name, finalRecipe.category);
              finalRecipe.imageUri = aiFallback || await generateFallbackImage(recipe.name, finalRecipe.category);
            }
          } else {
            console.log('⚠️ Recipe content extraction failed, generating AI fallback...');
            const aiFallback = await generateAiThumbnail(recipe.name, recipe.category);
            finalRecipe.imageUri = aiFallback || await generateFallbackImage(recipe.name, recipe.category);
          }
        } catch (error) {
          console.log('⚠️ Error during recipe content extraction, generating AI fallback:', error);
          const aiFallback = await generateAiThumbnail(recipe.name, recipe.category);
          finalRecipe.imageUri = aiFallback || await generateFallbackImage(recipe.name, recipe.category);
        }
      }
      
      const newRecipe: Recipe = {
        ...finalRecipe,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: Date.now(),
        ownerUserId: recipe.ownerUserId || ownerUserId || user?.id,
      };
      
      newRecipe.ownerUserId = newRecipe.ownerUserId || user?.id;
      
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
      
      if (user?.id) {
        await syncRecipeToSupabase(newRecipe, user.id);
      }
      
      console.log('✅ Recipe added successfully with guaranteed image');
      return true;
    } catch (error) {
      console.error('Failed to add recipe:', error);
      return false;
    }
  }, [user?.id, saveRecipes, syncRecipeToSupabase, extractRecipeContent, generateFallbackImage, generateAiThumbnail, convertImageToBase64]);

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
          
          if (imageUri && imageUri.startsWith('data:')) {
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Successfully extracted image for: "${recipe.name}"`);
            successCount++;
          } else {
            console.log(`⚠️ Extraction failed or returned invalid data, generating AI fallback for: "${recipe.name}"`);
            const aiFallback = await generateAiThumbnail(recipe.name, recipe.category);
            const finalImage = aiFallback || await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: finalImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Generated AI/fallback image for: "${recipe.name}"`);
            successCount++;
          }
        } catch (error) {
          try {
            console.log(`⚠️ Error occurred, generating AI fallback for: "${recipe.name}"`, error);
            const aiFallback = await generateAiThumbnail(recipe.name, recipe.category);
            const finalImage = aiFallback || await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: finalImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Generated AI/fallback after error for: "${recipe.name}"`);
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
  }, [user?.id, extractRecipeImage, saveRecipes, generateFallbackImage, generateAiThumbnail]);

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
          
          if (imageUri && imageUri.startsWith('data:')) {
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Successfully FORCE extracted image for: "${recipe.name}"`);
            successCount++;
          } else {
            console.log(`⚠️ FORCE extraction failed, generating AI fallback for: "${recipe.name}"`);
            const aiFallback = await generateAiThumbnail(recipe.name, recipe.category);
            const finalImage = aiFallback || await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: finalImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Generated AI/fallback after FORCE extraction for: "${recipe.name}"`);
            successCount++;
          }
        } catch (error) {
          try {
            console.log(`⚠️ FORCE extraction error, generating AI fallback for: "${recipe.name}"`, error);
            const aiFallback = await generateAiThumbnail(recipe.name, recipe.category);
            const finalImage = aiFallback || await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: finalImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Generated AI/fallback after FORCE error for: "${recipe.name}"`);
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
  }, [user?.id, extractRecipeImage, saveRecipes, generateFallbackImage, generateAiThumbnail]);

  const importBookmarksWithRetry = useCallback(async (bookmarks: {
    name: string;
    url: string;
    category: RecipeCategory;
    imageUri?: string;
    content?: string;
  }[]) => {
    console.log(`🚀 Starting bulk import of ${bookmarks.length} bookmarks with automatic retry`);
    
    const importedRecipes: Recipe[] = [];
    const recipesNeedingImageRetry: Recipe[] = [];
    const recipesWithPlaceholderOnly: string[] = [];
    
    // Phase 1: Import all recipes
    for (let i = 0; i < bookmarks.length; i++) {
      const bookmark = bookmarks[i];
      console.log(`📥 [${i + 1}/${bookmarks.length}] Importing: "${bookmark.name}"`);
      
      try {
        const recipeToAdd: Omit<Recipe, 'id' | 'createdAt'> = {
          name: bookmark.name.trim(),
          category: bookmark.category,
          url: bookmark.url,
          imageUri: bookmark.imageUri || undefined,
          content: bookmark.content || undefined,
        };
        
        const success = await addRecipe(recipeToAdd);
        
        if (success) {
          const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
          const storedRecipes = await AsyncStorage.getItem(storageKey);
          const currentRecipes = storedRecipes ? JSON.parse(storedRecipes) : [];
          const newRecipe = currentRecipes.find((r: Recipe) => r.url === bookmark.url);
          
          if (newRecipe) {
            importedRecipes.push(newRecipe);
            console.log(`✅ [${i + 1}/${bookmarks.length}] Successfully imported: "${bookmark.name}"`);
          }
        }
      } catch (error) {
        console.error(`❌ [${i + 1}/${bookmarks.length}] Error importing "${bookmark.name}":`, error);
      }
    }
    
    console.log(`📊 Phase 1 complete: Imported ${importedRecipes.length} recipes`);
    
    // Phase 2: Identify recipes with no/invalid imageUri
    for (const recipe of importedRecipes) {
      const uri = (recipe.imageUri ?? '').toString().trim();
      const isValid = uri.length >= 20 && 
                     (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'));
      
      if (!isValid) {
        console.log(`🔄 Recipe "${recipe.name}" needs image retry (invalid/missing imageUri)`);
        recipesNeedingImageRetry.push(recipe);
      }
    }
    
    console.log(`📊 Found ${recipesNeedingImageRetry.length} recipes needing image retry`);
    
    // Phase 3: Automatic retry for recipes with no valid image
    if (recipesNeedingImageRetry.length > 0) {
      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const storedRecipes = await AsyncStorage.getItem(storageKey);
      let workingRecipes = storedRecipes ? JSON.parse(storedRecipes) : [];
      
      for (let i = 0; i < recipesNeedingImageRetry.length; i++) {
        const recipe = recipesNeedingImageRetry[i];
        console.log(`🔄 [${i + 1}/${recipesNeedingImageRetry.length}] Retrying image extraction for: "${recipe.name}"`);
        
        try {
          let finalImageUri: string | undefined;
          
          // Try to extract image from URL
          if (recipe.url) {
            const extractedImage = await extractRecipeImage(recipe.name, recipe.url, 2);
            if (extractedImage && extractedImage.startsWith('data:')) {
              finalImageUri = extractedImage;
              console.log(`✅ Successfully extracted image on retry for: "${recipe.name}"`);
            }
          }
          
          // If extraction failed, try AI thumbnail generation
          if (!finalImageUri) {
            console.log(`🎨 Generating AI thumbnail for: "${recipe.name}"`);
            const aiThumbnail = await generateAiThumbnail(recipe.name, recipe.category);
            
            if (aiThumbnail && aiThumbnail.startsWith('data:')) {
              finalImageUri = aiThumbnail;
              console.log(`✅ Generated AI thumbnail for: "${recipe.name}"`);
            } else {
              // Last resort: use placeholder
              finalImageUri = DEFAULT_THUMBNAIL_DATA_URI;
              recipesWithPlaceholderOnly.push(recipe.name);
              console.log(`⚠️ Using placeholder for: "${recipe.name}"`);
            }
          }
          
          // Update recipe with new imageUri
          workingRecipes = workingRecipes.map((r: Recipe) => 
            r.id === recipe.id ? { ...r, imageUri: finalImageUri } : r
          );
          
          await saveRecipes(workingRecipes);
        } catch (error) {
          console.error(`❌ Error during retry for "${recipe.name}":`, error);
          // Use placeholder as fallback
          workingRecipes = workingRecipes.map((r: Recipe) => 
            r.id === recipe.id ? { ...r, imageUri: DEFAULT_THUMBNAIL_DATA_URI } : r
          );
          recipesWithPlaceholderOnly.push(recipe.name);
          await saveRecipes(workingRecipes);
        }
        
        // Small delay between retries
        if (i < recipesNeedingImageRetry.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    console.log(`🎉 Bulk import complete:`);
    console.log(`   - Total imported: ${importedRecipes.length}`);
    console.log(`   - Images retried: ${recipesNeedingImageRetry.length}`);
    console.log(`   - Placeholder only: ${recipesWithPlaceholderOnly.length}`);
    
    return {
      imported: importedRecipes.length,
      retried: recipesNeedingImageRetry.length,
      placeholderOnly: recipesWithPlaceholderOnly,
    };
  }, [user?.id, addRecipe, saveRecipes, extractRecipeImage, generateAiThumbnail]);

  const updateRecipeImage = useCallback(async (recipeId: string, newImageUri: string) => {
    try {
      const updatedRecipes = recipes.map(recipe => 
        recipe.id === recipeId ? { ...recipe, imageUri: newImageUri } : recipe
      );
      await saveRecipes(updatedRecipes);
      return true;
    } catch (error) {
      console.error('Failed to update recipe image:', error);
      return false;
    }
  }, [recipes, saveRecipes]);

  const importRecipeFromFriend = useCallback(async (sourceRecipe: Recipe, currentUserId: string) => {
    try {
      const importedRecipe: Omit<Recipe, 'id' | 'createdAt'> = {
        name: sourceRecipe.name,
        category: sourceRecipe.category,
        imageUri: sourceRecipe.imageUri,
        url: sourceRecipe.url,
        content: sourceRecipe.content,
        prepTime: sourceRecipe.prepTime,
        cookTime: sourceRecipe.cookTime,
        totalTime: sourceRecipe.totalTime,
        calories: sourceRecipe.calories,
        nutritionalInfo: sourceRecipe.nutritionalInfo,
        isFavorite: false,
        ownerUserId: currentUserId,
        importedFromUserId: sourceRecipe.ownerUserId,
      };

      const success = await addRecipe(importedRecipe, currentUserId);
      return success;
    } catch (error) {
      console.error('Failed to import recipe from friend:', error);
      return false;
    }
  }, [addRecipe]);

  const getRecipesForUser = useCallback(async (ownerUserId: string): Promise<Recipe[]> => {
    try {
      console.log(`🔍 Getting recipes for user: ${ownerUserId}`);
      const recipes = await loadRecipesFromSupabase(ownerUserId);
      console.log(`✅ Found ${recipes.length} recipes for user ${ownerUserId}`);
      return recipes;
    } catch (error) {
      console.error('Failed to get recipes for user:', error);
      return [];
    }
  }, [loadRecipesFromSupabase]);

  const debugSupabaseRecipesForUser = useCallback(async (ownerUserId: string) => {
    console.log('🐛 DEBUG: Checking Supabase recipes for', ownerUserId);

    const { data, error } = await supabase
      .from('recipes')
      .select('id, owner_user_id, name, category, created_at')
      .eq('owner_user_id', ownerUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('🐛 DEBUG Supabase error:', error);
      return;
    }

    console.log('🐛 DEBUG Supabase recipe count:', data?.length || 0);
    console.log('🐛 DEBUG Supabase rows:', data);
  }, []);

  return {
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
    generateAiThumbnail,
    convertImageToBase64,
    importBookmarksWithRetry,
    updateRecipeImage,
    importRecipeFromFriend,
    getRecipesForUser,
    loadRecipesFromSupabase,
    syncRecipeToSupabase,
    debugSupabaseRecipesForUser,
  };
});

export { RecipeContext, useRecipes };
