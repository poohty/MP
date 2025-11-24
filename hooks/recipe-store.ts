import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Recipe, RecipeCategory } from '@/types';
import { useAuth } from './auth-store';

const RECIPES_STORAGE_KEY = 'meal-planner-recipes';

const DEFAULT_THUMBNAIL_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

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
  }, [user?.id, saveRecipes, extractRecipeContent, generateFallbackImage, generateAiThumbnail, convertImageToBase64]);

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
    generateAiThumbnail,
    convertImageToBase64,
  }), [recipes, isLoading, addRecipe, updateRecipe, updateRecipeStepProgress, deleteRecipe, toggleFavorite, changeRecipeCategory, getRecipesByCategory, loadRecipes, debugStorage, extractRecipeImage, extractRecipeContent, reExtractImages, forceReExtractAllImages, generateFallbackImage, generateAiThumbnail, convertImageToBase64]);

  return contextValue;
});
