import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Recipe, RecipeCategory } from '@/types';
import { useAuth } from './auth-store';

const RECIPES_STORAGE_KEY = 'meal-planner-recipes';

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
        setRecipes(parsedRecipes);
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

  // Multiple fallback image sources for maximum reliability
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
      // Primary: Specific recipe search
      `https://source.unsplash.com/featured/400x300/?${searchTerm},food,recipe,dish&sig=${timestamp}`,
      // Secondary: Category-based search
      `https://source.unsplash.com/featured/400x300/?${categoryTerm},food,cooking&sig=${timestamp + 1}`,
      // Tertiary: Generic food search
      `https://source.unsplash.com/featured/400x300/?food,cooking,recipe&sig=${timestamp + 2}`,
      // Quaternary: Meal-based search
      `https://source.unsplash.com/featured/400x300/?meal,dish,cuisine&sig=${timestamp + 3}`,
      // Final fallback: Kitchen/cooking theme
      `https://source.unsplash.com/featured/400x300/?kitchen,cooking,chef&sig=${timestamp + 4}`
    ];
  }, []);

  // Test if an image URL is actually loadable
  const testImageUrl = useCallback(async (imageUrl: string, timeout: number = 3000): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(imageUrl, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        return contentType ? contentType.startsWith('image/') : false;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Search for recipe images using AI with multiple strategies
  const searchRecipeImages = useCallback(async (recipeName: string): Promise<string | undefined> => {
    try {
      console.log(`🔍 AI searching for recipe images: "${recipeName}"`);
      
      const cleanName = recipeName
        .replace(/recipe/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `🚨 ULTRA-AGGRESSIVE RECIPE CONTENT EXTRACTOR 🚨

You are the MOST PRECISE recipe content extractor with ENHANCED SCRAPING CAPABILITIES. Your job is to find and extract the COMPLETE recipe from any webpage, filtering out all filler content.

🎯 MISSION: Extract ONLY the actual recipe content with MAXIMUM ACCURACY

🔍 ENHANCED EXTRACTION STRATEGY:
1. SCAN ENTIRE WEBPAGE for recipe content
2. LOOK FOR structured data (JSON-LD, microdata)
3. IDENTIFY recipe cards, recipe sections
4. EXTRACT from recipe plugins/widgets
5. PARSE ingredient lists and instruction blocks
6. IGNORE all non-recipe content

✅ EXTRACT (MANDATORY):
- Complete ingredients list with EXACT measurements
- Step-by-step cooking instructions (numbered sequentially)
- Cooking time, prep time, servings if available
- Temperature settings and cooking methods
- Any special notes, tips, or variations

❌ IGNORE (FILTER OUT COMPLETELY):
- Author bio, personal stories, blog content
- Advertisements, social media links, affiliate links
- Comments, reviews, ratings, user feedback
- Navigation menus, headers, footers
- "Pin this recipe" or sharing buttons
- Nutritional disclaimers or legal text
- Related recipes or suggestions
- Website navigation elements
- Popup content or subscription prompts

📝 ULTRA-STRICT FORMAT:
INGREDIENTS:
- [ingredient with exact measurement and preparation notes]
- [ingredient with exact measurement and preparation notes]

INSTRUCTIONS:
1. [detailed, actionable cooking step with temperatures/times]
2. [detailed, actionable cooking step with temperatures/times]
3. [detailed, actionable cooking step with temperatures/times]

NOTES: [cooking tips, temperature guidelines, timing notes, variations]

🚨 CRITICAL REQUIREMENTS:
- Extract ONLY the recipe content, ignore ALL filler
- Make each instruction step EXTREMELY clear and actionable
- Include EXACT measurements, temperatures, and timing
- Number ALL instruction steps sequentially (1, 2, 3...)
- Focus ONLY on the cooking process, not stories or ads`
            },
            {
              role: 'user',
              content: `🚨 ULTRA-AGGRESSIVE IMAGE SEARCH MISSION

Recipe: "${cleanName}"

🔍 SEARCH STRATEGY:
1. Search for exact recipe name: "${cleanName}"
2. Search for similar dishes and variations
3. Search for main ingredients
4. Search for food category/cuisine type
5. Search for ANY related food images

🎯 CRITICAL MISSION:
- Find ANY food-related image for "${cleanName}"
- Be extremely aggressive and creative
- Try multiple websites and sources
- Use different search terms and variations
- Look for similar dishes if exact match not found
- Find ingredient photos if no dish photos exist
- Even find cartoon/illustrated food if needed

🚨 DO NOT RETURN "NONE" - Find SOMETHING food-related!

Search everywhere: recipe sites, food blogs, restaurants, social media, stock photos, Wikipedia, YouTube thumbnails, grocery stores, food delivery apps.

Return ANY food image URL you can find.`
            }
          ]
        })
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`❌ AI image search API error: ${response.status}`);
        return undefined;
      }
      
      const data = await response.json();
      if (!data?.completion) {
        console.log(`❌ No completion in AI image search response`);
        return undefined;
      }
      
      const result = data.completion.trim();
      const imageLine = result.split('\n').find((line: string) => line.toUpperCase().startsWith('IMAGE:'));
      
      if (imageLine) {
        const imageUrl = imageLine.replace(/IMAGE:/i, '').trim();
        
        if (imageUrl !== 'NONE' && imageUrl.length > 10 && 
            (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
          
          // Test if image is loadable
          const isLoadable = await testImageUrl(imageUrl, 2000);
          if (isLoadable) {
            console.log(`✅ AI found recipe image: ${imageUrl}`);
            return imageUrl;
          } else {
            console.log(`❌ AI image not loadable: ${imageUrl}`);
          }
        }
      }
      
      console.log(`❌ AI image search failed for "${recipeName}"`);
      return undefined;
    } catch (error) {
      console.log(`❌ Error in AI image search for "${recipeName}":`, error);
      return undefined;
    }
  }, [testImageUrl]);

  // Generate a guaranteed fallback image with multiple attempts
  const generateFallbackImage = useCallback(async (recipeName: string, category: string): Promise<string> => {
    console.log(`🎨 Generating fallback image for "${recipeName}" in category "${category}"`);
    
    const fallbackUrls = getMultipleFallbackImages(recipeName, category);
    
    // Try each fallback URL until we find one that works
    for (let i = 0; i < fallbackUrls.length; i++) {
      const url = fallbackUrls[i];
      console.log(`🧪 Testing fallback image ${i + 1}/${fallbackUrls.length}: ${url}`);
      
      const isLoadable = await testImageUrl(url, 2000);
      if (isLoadable) {
        console.log(`✅ Fallback image ${i + 1} works: ${url}`);
        return url;
      } else {
        console.log(`❌ Fallback image ${i + 1} failed: ${url}`);
      }
    }
    
    // If all fallbacks fail, return the first one anyway (Unsplash usually works)
    console.log(`⚠️ All fallback tests failed, using first fallback anyway`);
    return fallbackUrls[0];
  }, [getMultipleFallbackImages, testImageUrl]);

  // Aggressive image search as final fallback
  const aggressiveImageSearch = useCallback(async (recipeName: string): Promise<string | undefined> => {
    try {
      console.log(`🚀 Aggressive image search for: "${recipeName}"`);
      
      const cleanName = recipeName
        .replace(/recipe/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an aggressive recipe image finder. Your job is to find ANY food-related image for a recipe, even if it\'s not perfect. Be extremely creative and persistent.\n\n🎯 MISSION: Find ANY food image related to the recipe\n\n✅ ACCEPTABLE IMAGES:\n- Any food photo that resembles the dish\n- Similar dishes from the same category\n- Generic food photos if specific dish not found\n- Stock photos of food (as last resort)\n- Any edible item that\'s remotely related\n\n🔍 SEARCH EVERYWHERE:\n- Recipe websites (AllRecipes, Food Network, etc.)\n- Food blogs and cooking sites\n- Restaurant websites\n- Food photography sites\n- Stock photo sites (if needed)\n- Social media food posts\n\n🚨 CRITICAL: Do NOT return NONE. Find SOMETHING food-related.\n\nFormat: IMAGE: [any food-related image URL]\n\nBe extremely aggressive - find ANY food image even if it\'s not perfect.'
            },
            {
              role: 'user',
              content: `AGGRESSIVE SEARCH: Find ANY food-related image for: "${cleanName}"\n\nBe extremely aggressive and creative. Find ANY image that shows:\n- The specific dish "${cleanName}"\n- Similar dishes or ingredients\n- Generic food from the same category\n- ANY edible item remotely related\n\nDo NOT return NONE. Find SOMETHING food-related even if it\'s not perfect.\n\nSearch everywhere: recipe sites, food blogs, restaurants, stock photos, social media.\n\nReturn ANY food image URL you can find.`
            }
          ]
        })
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`❌ Aggressive search API error: ${response.status}`);
        return undefined;
      }
      
      const data = await response.json();
      if (!data?.completion) {
        console.log(`❌ No completion in aggressive search response`);
        return undefined;
      }
      
      const result = data.completion.trim();
      const imageLine = result.split('\n').find((line: string) => line.toUpperCase().startsWith('IMAGE:'));
      
      if (imageLine) {
        const imageUrl = imageLine.replace(/IMAGE:/i, '').trim();
        
        if (imageUrl !== 'NONE' && imageUrl.length > 10 && 
            (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
          
          // Test if image is loadable
          try {
            const testController = new AbortController();
            const testTimeoutId = setTimeout(() => testController.abort(), 3000);
            
            const testResponse = await fetch(imageUrl, { 
              method: 'HEAD',
              signal: testController.signal
            });
            
            clearTimeout(testTimeoutId);
            
            if (testResponse.ok) {
              const contentType = testResponse.headers.get('content-type');
              if (contentType && contentType.startsWith('image/')) {
                console.log(`✅ Aggressive search found: ${imageUrl}`);
                return imageUrl;
              }
            }
          } catch (testError) {
            console.log(`❌ Aggressive search result not loadable: ${testError}`);
          }
        }
      }
      
      console.log(`❌ Aggressive search failed for "${recipeName}"`);
      return undefined;
    } catch (error) {
      console.log(`❌ Error in aggressive search for "${recipeName}":`, error);
      return undefined;
    }
  }, []);

  // Extract complete recipe content with enhanced parsing and categorization
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
      
      // Fetch the webpage HTML
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
      
      // Use AI to extract the 5 required fields + category
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
      
      // Enhanced parsing of AI response
      const extractedData: {
        ingredients?: string;
        nutritionalFacts?: string;
        times?: string;
        instructions?: string;
        imageUrl?: string;
        category?: RecipeCategory;
      } = {};
      
      // More robust parsing - handle both section headers and single-line fields
      const lines = result.split('\n');
      let currentSection: string | null = null;
      let sectionContent: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const upperLine = line.toUpperCase();
        
        // Check if this is a section header (INGREDIENTS:, INSTRUCTIONS:, etc.)
        if (upperLine.match(/^[A-Z][A-Z ]*:/) && !line.startsWith(' ')) {
          // Save previous section if exists
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
          
          // Start new section
          const colonIndex = line.indexOf(':');
          const header = line.substring(0, colonIndex).toUpperCase().trim();
          const valueAfterColon = line.substring(colonIndex + 1).trim();
          
          // Handle single-line fields (IMAGE: url, CATEGORY: name)
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
            // Multi-line section (INGREDIENTS, INSTRUCTIONS, etc.)
            currentSection = header;
            sectionContent = valueAfterColon ? [valueAfterColon] : [];
          }
        } else if (currentSection) {
          // Add to current section
          sectionContent.push(line);
        }
      }
      
      // Save last section if exists
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

  // Extract recipe image from URL with retry mechanism and Google Images fallback
  const extractRecipeImage = useCallback(async (recipeName: string, recipeUrl: string, retryCount: number = 3): Promise<string | undefined> => {
    let attempts = 0;
    const maxAttempts = retryCount + 1;
    
    // First, try to extract from the recipe webpage
    while (attempts < maxAttempts) {
      try {
        console.log(`🔍 [Attempt ${attempts + 1}/${maxAttempts}] Extracting image for "${recipeName}" from ${recipeUrl}`);
        
        // Step 1: Fetch the actual webpage HTML content with shorter timeout for speed
        console.log(`📥 Fetching webpage HTML from: ${recipeUrl}`);
        const webpageController = new AbortController();
        const webpageTimeoutId = setTimeout(() => webpageController.abort(), 6000); // Reduced to 6s for speed
        
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
            throw new Error(`HTTP ${webpageResponse.status}`);
          }
          
          webpageHtml = await webpageResponse.text();
          console.log(`✅ Successfully fetched webpage HTML (${webpageHtml.length} chars)`);
        } catch (fetchError) {
          console.log(`❌ Error fetching webpage:`, fetchError);
          throw fetchError;
        }
        
        // Step 2: Use AI to analyze the actual HTML and extract the recipe image with shorter timeout
        console.log(`🤖 Analyzing HTML content with AI for image extraction...`);
        const aiController = new AbortController();
        const aiTimeoutId = setTimeout(() => aiController.abort(), 10000); // Reduced to 10s for speed
        
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
                content: `You are an ULTRA-AGGRESSIVE recipe image extractor with SOUP DETECTION priority. Your job is to analyze HTML content and extract the main recipe image URL while detecting soup recipes.\n\n🎯 CRITICAL MISSION: Find the EXACT recipe image URL from the HTML\n\n🍲 SOUP DETECTION (HIGHEST PRIORITY):\nFirst, scan the HTML for ANY soup-related keywords: soup, soups, soupy, stew, stews, stewed, chili, chilis, chile, chilli, bisque, bisques, chowder, chowders, broth, broths, stock, stocks, pho, ramen, miso, gazpacho, minestrone, bouillabaisse, gumbo, borscht, consommé, vichyssoise, tom yum, laksa, pozole, menudo, curry soup, coconut soup, noodle soup, chicken soup, beef soup, vegetable soup, tomato soup, mushroom soup, onion soup, french onion soup, clam chowder, corn chowder, seafood chowder, wonton soup, egg drop soup, lentil soup, split pea soup, butternut squash soup, potato soup, leek soup, carrot soup, seafood soup, fish soup, bone broth, vegetable broth, chicken broth, beef broth, turkey soup, cabbage soup, celery soup, pumpkin soup, matzo ball soup, chicken noodle, hot and sour soup, cream soup, pureed soup, clear soup, bean soup, black bean soup, white bean soup, navy bean soup, tortilla soup, albondigas, cioppino, mulligatawny\n\nIf ANY soup keyword found, this is a SOUP RECIPE and must be categorized as Salads & Soups.\n\n🔍 IMAGE EXTRACTION PRIORITY ORDER:\n1. META TAGS: <meta property="og:image" content="..."> (HIGHEST PRIORITY)\n2. TWITTER CARDS: <meta name="twitter:image" content="...">\n3. RECIPE SCHEMA: JSON-LD structured data with "image" property\n4. MAIN IMG TAGS: <img> with recipe-related alt text and large dimensions\n5. HERO IMAGES: Large featured images near recipe title\n6. ANY FOOD IMAGE: If no perfect match, find any food-related image\n\n✅ VALID IMAGE CRITERIA:\n- Direct HTTP/HTTPS image URL from the HTML\n- Shows food, dish, or recipe-related content\n- High resolution (preferably 300px+ width)\n- From recipe website domain or trusted CDN\n- Common formats: .jpg, .jpeg, .png, .webp\n\n❌ REJECT THESE:\n- Logos, icons, social buttons\n- Author/chef profile photos (unless no other option)\n- Advertisement images\n- Navigation/UI elements\n- Favicon or small icons\n\n🚨 CRITICAL: Be extremely aggressive in finding images. Scan the ENTIRE HTML for ANY food-related image. Even if it's not perfect, find SOMETHING food-related.\n\nRespond with ONLY:\nIMAGE: [exact direct image URL from HTML]\n\nIf absolutely no food-related image found:\nIMAGE: NONE`
              },
              {
                role: 'user',
                content: `🎯 EXTRACT RECIPE IMAGE FROM HTML CONTENT (Attempt ${attempts + 1})\n\nRecipe Name: "${recipeName}"\nWebpage URL: ${recipeUrl}\n\n📋 HTML CONTENT TO ANALYZE:\n${webpageHtml.substring(0, 50000)}\n\n🔍 CRITICAL TASK:\n1. Scan the ENTIRE HTML content above for ANY food-related image\n2. Find the main recipe image that shows the finished "${recipeName}" dish\n3. If no perfect match, find ANY food-related image from the page\n4. Extract the direct image URL from the HTML\n5. Prioritize og:image meta tags, then twitter:image, then recipe schema, then main img tags\n6. Be EXTREMELY aggressive - find ANY food image even if not perfect\n\n✅ SUCCESS: Return the exact image URL from the HTML\n❌ FAILURE: Return "NONE" only if absolutely NO food images exist anywhere\n\nBe extremely aggressive - find ANY food image if the perfect recipe image isn't available. Scan every img tag, every meta tag, every schema markup.`
              }
            ]
          })
        });
        
        clearTimeout(aiTimeoutId);
        
        if (!response.ok) {
          console.log(`⚠️ AI API error for image extraction: ${response.status}`);
          throw new Error(`AI API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data?.completion) {
          console.log(`⚠️ No completion in AI response`);
          throw new Error('No AI completion');
        }
        
        const result = data.completion.trim();
        console.log(`🤖 AI image extraction result for "${recipeName}": ${result}`);
        
        const imageLine = result.split('\n').find((line: string) => line.toUpperCase().startsWith('IMAGE:'));
        
        if (imageLine) {
          const imageUrl = imageLine.replace(/IMAGE:/i, '').trim();
          console.log(`🔍 Extracted image URL: "${imageUrl}"`);
          
          if (imageUrl !== 'NONE' && imageUrl.length > 10 && 
              (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) &&
              !imageUrl.toLowerCase().includes('favicon') &&
              !imageUrl.toLowerCase().includes('sprite') &&
              !imageUrl.toLowerCase().includes('button') &&
              !imageUrl.toLowerCase().includes('arrow')) {
            
            // Test if image is actually loadable with shorter timeout
            try {
              console.log(`🧪 Testing extracted image URL: ${imageUrl}`);
              const testController = new AbortController();
              const testTimeoutId = setTimeout(() => testController.abort(), 2000); // Reduced to 2s for speed
              
              const testResponse = await fetch(imageUrl, { 
                method: 'HEAD',
                signal: testController.signal
              });
              
              clearTimeout(testTimeoutId);
              
              if (testResponse.ok) {
                const contentType = testResponse.headers.get('content-type');
                if (contentType && contentType.startsWith('image/')) {
                  console.log(`✅ Successfully extracted and verified recipe image: ${imageUrl}`);
                  return imageUrl;
                } else {
                  console.log(`❌ URL is not an image: ${contentType}`);
                }
              } else {
                console.log(`❌ Image URL not accessible: ${testResponse.status}`);
              }
            } catch (testError) {
              console.log(`❌ Error testing image URL:`, testError);
            }
          } else {
            console.log(`❌ Invalid or filtered image URL: "${imageUrl}"`);
          }
        } else {
          console.log(`❌ No IMAGE: line found in AI response`);
        }
        
        // If we reach here, this attempt failed
        throw new Error('No valid image found in this attempt');
        
      } catch (error) {
        attempts++;
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`⏰ Image extraction timeout for "${recipeName}" (attempt ${attempts})`);
        } else {
          console.log(`❌ Error extracting image for "${recipeName}" (attempt ${attempts}):`, error);
        }
        
        // If this was the last attempt, break and try Google Images
        if (attempts >= maxAttempts) {
          console.log(`💀 All ${maxAttempts} webpage attempts failed for "${recipeName}", trying Google Images...`);
          break;
        }
        
        // Wait before retry (shorter delay for speed)
        console.log(`🔄 Retrying image extraction for "${recipeName}" in 500ms...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // If webpage extraction failed, try AI image search as fallback
    console.log(`🔍 Webpage extraction failed, trying AI image search for "${recipeName}"...`);
    const aiImageUrl = await searchRecipeImages(recipeName);
    
    if (aiImageUrl) {
      console.log(`✅ Found image via AI search for "${recipeName}": ${aiImageUrl}`);
      return aiImageUrl;
    }
    
    // If AI search also failed, try one more aggressive search
    console.log(`🔍 AI search failed, trying aggressive search for "${recipeName}"...`);
    const aggressiveImageUrl = await aggressiveImageSearch(recipeName);
    
    if (aggressiveImageUrl) {
      console.log(`✅ Found image via aggressive search for "${recipeName}": ${aggressiveImageUrl}`);
      return aggressiveImageUrl;
    }
    
    console.log(`❌ All extraction methods failed for "${recipeName}"`);
    return undefined;
  }, [searchRecipeImages, aggressiveImageSearch]);

  const addRecipe = useCallback(async (recipe: Omit<Recipe, 'id' | 'createdAt'>) => {
    try {
      console.log('📝 Adding recipe:', {
        name: recipe.name,
        category: recipe.category,
        hasUrl: !!recipe.url,
        hasImage: !!recipe.imageUri,
        hasContent: !!recipe.content
      });
      
      // FORCE complete recipe extraction for ALL URL recipes
      let finalRecipe = { ...recipe };
      if (recipe.url) {
        console.log('🔍 FORCING complete recipe content extraction for recipe with URL...');
        try {
          const extractedContent = await extractRecipeContent(recipe.name, recipe.url);
          
          if (extractedContent) {
            // Update category if AI provided a better one
            if (extractedContent.category) {
              finalRecipe.category = extractedContent.category;
              console.log(`🎯 AI updated category to: ${extractedContent.category}`);
            }
            
            // Build the complete recipe content with all extracted fields
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
              // Instructions should already have checkboxes from AI
              content += `**Instructions:**\n${extractedContent.instructions}\n\n`;
            }
            
            finalRecipe.content = content.trim();
            
            // Use extracted image or fallback
            if (extractedContent.imageUrl) {
              console.log(`🖼️ AI extracted image URL: ${extractedContent.imageUrl}`);
              // Test if the extracted image is actually loadable
              try {
                const testResponse = await fetch(extractedContent.imageUrl, { method: 'HEAD' });
                if (testResponse.ok) {
                  const contentType = testResponse.headers.get('content-type');
                  if (contentType && contentType.startsWith('image/')) {
                    finalRecipe.imageUri = extractedContent.imageUrl;
                    console.log(`✅ Successfully extracted and verified recipe image: ${extractedContent.imageUrl}`);
                    console.log(`📸 Recipe "${recipe.name}" now has imageUri: ${finalRecipe.imageUri}`);
                  } else {
                    console.log(`⚠️ Extracted URL is not an image (${contentType}), generating fallback...`);
                    finalRecipe.imageUri = await generateFallbackImage(recipe.name, finalRecipe.category);
                    console.log(`📸 Recipe "${recipe.name}" using fallback imageUri: ${finalRecipe.imageUri}`);
                  }
                } else {
                  console.log(`⚠️ Extracted image not loadable (HTTP ${testResponse.status}), generating fallback...`);
                  finalRecipe.imageUri = await generateFallbackImage(recipe.name, finalRecipe.category);
                  console.log(`📸 Recipe "${recipe.name}" using fallback imageUri: ${finalRecipe.imageUri}`);
                }
              } catch (err) {
                console.log(`⚠️ Error testing extracted image:`, err);
                console.log('⚠️ Generating fallback...');
                finalRecipe.imageUri = await generateFallbackImage(recipe.name, finalRecipe.category);
                console.log(`📸 Recipe "${recipe.name}" using fallback imageUri: ${finalRecipe.imageUri}`);
              }
            } else {
              console.log('⚠️ No image found in extraction, generating fallback...');
              finalRecipe.imageUri = await generateFallbackImage(recipe.name, finalRecipe.category);
              console.log(`📸 Recipe "${recipe.name}" using fallback imageUri: ${finalRecipe.imageUri}`);
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
      
      // Generate a more unique ID to avoid conflicts
      const newRecipe: Recipe = {
        ...finalRecipe,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      };
      
      // Get the latest recipes from storage to avoid conflicts
      const storageKey = `${RECIPES_STORAGE_KEY}-${user?.id}`;
      const storedRecipes = await AsyncStorage.getItem(storageKey);
      const currentRecipes = storedRecipes ? JSON.parse(storedRecipes) : [];
      
      // Check for duplicates by URL to avoid adding the same recipe twice
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

  // Re-extract images for recipes that don't have them
  const reExtractImages = useCallback(async () => {
    try {
      console.log('🔄 Starting image re-extraction for recipes without images...');
      
      // Get fresh recipes from storage
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
      let workingRecipes = [...currentRecipes]; // Working copy that gets updated
      
      for (let i = 0; i < recipesWithoutImages.length; i++) {
        const recipe = recipesWithoutImages[i];
        console.log(`🔍 [${i + 1}/${recipesWithoutImages.length}] Re-extracting image for: "${recipe.name}"`);
        
        try {
          const imageUri = await extractRecipeImage(recipe.name, recipe.url!, 2); // 2 retries for re-extraction
          
          if (imageUri) {
            // Update the recipe with the new image in the working copy
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Successfully extracted image for: "${recipe.name}"`);
            console.log(`   Image URL: ${imageUri.substring(0, 100)}...`);
            successCount++;
          } else {
            // If extraction fails, generate a fallback image
            console.log(`⚠️ Extraction failed, generating fallback for: "${recipe.name}"`);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Generated fallback image for: "${recipe.name}"`);
            console.log(`   Fallback URL: ${fallbackImage.substring(0, 100)}...`);
            successCount++; // Count fallback as success since recipe now has an image
          }
        } catch (error) {
          // Even on error, try to generate a fallback
          try {
            console.log(`⚠️ Error occurred, generating fallback for: "${recipe.name}"`, error);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithoutImages.length}] Generated fallback after error for: "${recipe.name}"`);
            successCount++; // Count fallback as success
          } catch (fallbackError) {
            failedCount++;
            console.log(`❌ [${i + 1}/${recipesWithoutImages.length}] Complete failure for: "${recipe.name}"`, fallbackError);
          }
        }
        
        // Save after EACH update so changes persist
        await saveRecipes(workingRecipes);
        
        // Shorter delay between requests for speed
        if (i < recipesWithoutImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 500ms to 200ms
        }
      }
      
      console.log(`🎉 Image re-extraction complete: ${successCount} success, ${failedCount} failed`);
      console.log(`📊 Final check: ${workingRecipes.filter((r: Recipe) => r.imageUri).length} recipes now have images`);
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('❌ Error during image re-extraction:', error);
      return { success: 0, failed: 0 };
    }
  }, [user?.id, extractRecipeImage, saveRecipes, generateFallbackImage]);

  // Force re-extract images for ALL recipes (including ones that already have images)
  const forceReExtractAllImages = useCallback(async () => {
    try {
      console.log('🚀 FORCE re-extracting images for ALL recipes with URLs...');
      
      // Get fresh recipes from storage
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
      let workingRecipes = [...currentRecipes]; // Working copy that gets updated
      
      for (let i = 0; i < recipesWithUrls.length; i++) {
        const recipe = recipesWithUrls[i];
        console.log(`🔍 [${i + 1}/${recipesWithUrls.length}] FORCE re-extracting image for: "${recipe.name}"`);
        
        try {
          const imageUri = await extractRecipeImage(recipe.name, recipe.url!, 3); // 3 retries for force extraction
          
          if (imageUri) {
            // Update the recipe with the new image in the working copy
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Successfully FORCE extracted image for: "${recipe.name}"`);
            console.log(`   Image URL: ${imageUri.substring(0, 100)}...`);
            successCount++;
          } else {
            // If extraction fails, generate a fallback image
            console.log(`⚠️ FORCE extraction failed, generating fallback for: "${recipe.name}"`);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Generated fallback after FORCE extraction for: "${recipe.name}"`);
            console.log(`   Fallback URL: ${fallbackImage.substring(0, 100)}...`);
            successCount++; // Count fallback as success
          }
        } catch (error) {
          // Even on error, try to generate a fallback
          try {
            console.log(`⚠️ FORCE extraction error, generating fallback for: "${recipe.name}"`, error);
            const fallbackImage = await generateFallbackImage(recipe.name, recipe.category);
            workingRecipes = workingRecipes.map(r => 
              r.id === recipe.id ? { ...r, imageUri: fallbackImage } : r
            );
            console.log(`✅ [${i + 1}/${recipesWithUrls.length}] Generated fallback after FORCE error for: "${recipe.name}"`);
            successCount++; // Count fallback as success
          } catch (fallbackError) {
            failedCount++;
            console.log(`❌ [${i + 1}/${recipesWithUrls.length}] Complete FORCE failure for: "${recipe.name}"`, fallbackError);
          }
        }
        
        // Save after EACH update so changes persist
        await saveRecipes(workingRecipes);
        
        // Shorter delay between requests for speed
        if (i < recipesWithUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Slightly longer delay for force extraction
        }
      }
      
      console.log(`🎉 FORCE image re-extraction complete: ${successCount} success, ${failedCount} failed`);
      console.log(`📊 Final check: ${workingRecipes.filter((r: Recipe) => r.imageUri).length} recipes now have images`);
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
  }), [recipes, isLoading, addRecipe, updateRecipe, updateRecipeStepProgress, deleteRecipe, toggleFavorite, changeRecipeCategory, getRecipesByCategory, loadRecipes, debugStorage, extractRecipeImage, extractRecipeContent, reExtractImages, forceReExtractAllImages, generateFallbackImage]);

  return contextValue;
});