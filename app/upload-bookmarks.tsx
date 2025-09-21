import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useRecipes } from '@/hooks/recipe-store';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import GradientBackground from '@/components/GradientBackground';
import { Upload, FileText, CheckCircle } from 'lucide-react-native';
import { Recipe, RecipeCategory } from '@/types';

interface ParsedBookmark {
  name: string;
  url: string;
  category: string;
  imageUri?: string;
  content?: string;
}

export default function UploadBookmarksScreen() {
  const { addRecipe, refreshRecipes } = useRecipes();
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedBookmarks, setParsedBookmarks] = useState<ParsedBookmark[]>([]);
  const [processingStatus, setProcessingStatus] = useState('');

  const parseBookmarkFile = async (fileContent: string): Promise<ParsedBookmark[]> => {
    try {
      // Parse HTML bookmark file
      const potentialRecipes: { name: string; url: string }[] = [];
      
      // Extract all anchor tags with href attributes - improved regex
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      let match;
      
      while ((match = linkRegex.exec(fileContent)) !== null) {
        const url = match[1];
        const name = match[2].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        
        // EXTREMELY lenient URL filtering - include almost everything
        if (url && name && url.startsWith('http') && name.length > 2 && 
            !url.includes('javascript:') && !url.includes('mailto:') && 
            !url.includes('tel:') && !url.includes('#') && 
            !name.toLowerCase().includes('bookmark') && 
            !name.toLowerCase().includes('folder')) {
          console.log(`📋 Found link: "${name}" - ${url}`);
          potentialRecipes.push({ name, url });
        }
      }
      
      console.log(`🔍 Found ${potentialRecipes.length} total links to analyze`);
      
      // Process ALL recipes with improved logic - no skipping based on URL patterns
      const bookmarks: ParsedBookmark[] = [];
      const failedRecipes: string[] = [];
      const processedUrls = new Set<string>(); // Prevent duplicates
      
      for (let i = 0; i < potentialRecipes.length; i++) {
        const { name, url } = potentialRecipes[i];
        
        // Skip duplicates
        if (processedUrls.has(url)) {
          console.log(`⏭️ [${i + 1}/${potentialRecipes.length}] Skipping duplicate URL: "${name}"`);
          continue;
        }
        processedUrls.add(url);
        
        console.log(`🚀 [${i + 1}/${potentialRecipes.length}] Processing: "${name}"`);
        
        try {
          setProcessingStatus(`Processing ${i + 1}/${potentialRecipes.length}: ${name.substring(0, 30)}...`);
          
          // Try fallback validation first for speed, then AI for accuracy
          let recipeData: { isRecipe: boolean; category?: string; imageUri?: string; content?: string } | null = null;
          
          // First try fallback validation for known recipe sites
          const fallbackValidation = validateRecipeByUrl(name, url);
          if (fallbackValidation.isRecipe) {
            console.log(`🔄 [${i + 1}/${potentialRecipes.length}] Using fallback for: "${name}" -> ${fallbackValidation.category}`);
            recipeData = fallbackValidation;
            
            // For fallback recipes, still try to get AI content and image with retry
            try {
              console.log(`🤖 [${i + 1}/${potentialRecipes.length}] Getting AI content and image for fallback recipe: "${name}"`);
              const aiResult = await fetchRecipeContentWithRetry(name, url, 2); // 2 retries
              if (aiResult.isRecipe) {
                // Merge AI data with fallback data, prioritizing AI image extraction
                recipeData = {
                  ...recipeData,
                  imageUri: aiResult.imageUri, // Always use AI-extracted image if available
                  content: aiResult.content || recipeData.content,
                  category: aiResult.category || recipeData.category
                };
                console.log(`✅ [${i + 1}/${potentialRecipes.length}] Enhanced fallback with AI data: "${name}"${aiResult.imageUri ? ' (with extracted image)' : ' (no image found)'}`);
              }
            } catch {
              console.log(`⚠️ [${i + 1}/${potentialRecipes.length}] AI enhancement failed for fallback, using fallback only: "${name}"`);
            }
          } else {
            // If fallback fails, try AI with retries
            try {
              console.log(`🤖 [${i + 1}/${potentialRecipes.length}] AI processing for: "${name}"`);
              const aiResult = await fetchRecipeContentWithRetry(name, url, 2); // 2 retries
              
              if (aiResult.isRecipe) {
                recipeData = aiResult;
                console.log(`✅ [${i + 1}/${potentialRecipes.length}] AI success: "${name}" -> ${aiResult.category}${aiResult.imageUri ? ' (with image)' : ''}`);
              } else {
                console.log(`❌ [${i + 1}/${potentialRecipes.length}] AI rejected: "${name}"`);
              }
            } catch (aiError) {
              console.log(`⚠️ [${i + 1}/${potentialRecipes.length}] AI error: "${name}"`, aiError);
            }
          }
          
          // Add recipe if validated by either method
          if (recipeData?.isRecipe && recipeData.category) {
            console.log(`✅ [${i + 1}/${potentialRecipes.length}] Recipe accepted: "${name}" -> ${recipeData.category}`);
            bookmarks.push({ 
              name: name.trim(), 
              url, 
              category: recipeData.category,
              imageUri: recipeData.imageUri,
              content: recipeData.content
            });
          } else {
            console.log(`❌ [${i + 1}/${potentialRecipes.length}] Recipe rejected: "${name}"`);
            failedRecipes.push(name);
          }
        } catch (error) {
          console.error(`⚠️ [${i + 1}/${potentialRecipes.length}] Critical error processing "${name}":`, error);
          failedRecipes.push(name);
        }
        
        // Minimal delay between requests for speed
        if (i < potentialRecipes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms
        }
      }
      
      console.log(`🎉 PARSING COMPLETE: ${bookmarks.length}/${potentialRecipes.length} recipes processed`);
      console.log(`✅ Successful recipes (${bookmarks.length}): ${bookmarks.map(b => `"${b.name}" (${b.category})`).join(', ')}`);
      if (failedRecipes.length > 0) {
        console.log(`❌ Failed recipes (${failedRecipes.length}): ${failedRecipes.join(', ')}`);
      }
      
      return bookmarks;
    } catch (error) {
      console.error('Error parsing bookmark file:', error);
      throw new Error('Failed to parse bookmark file');
    }
  };

  const isLikelyRecipeUrl = (url: string): boolean => {
    const recipeKeywords = [
      'recipe', 'cooking', 'food', 'kitchen', 'chef', 'meal', 'dish', 'eat',
      'allrecipes', 'foodnetwork', 'epicurious', 'tasty', 'buzzfeed',
      'delish', 'recipetineats', 'simplyrecipes', 'tasteofhome',
      'food.com', 'yummly', 'cookinglight', 'eatingwell', 'myrecipes',
      'pillsbury', 'bettycrocker', 'kingarthurbaking', 'seriouseats',
      'thekitchn', 'bonappetit', 'foodandwine', 'saveur', 'cookstr',
      'genius-kitchen', 'cdkitchen', 'cooks.com', 'recipe.com',
      'martha', 'williams-sonoma', 'foodblog', 'blog', 'homemade',
      'baking', 'cook', 'kitchen', 'dinner', 'lunch', 'breakfast'
    ];
    
    const urlLower = url.toLowerCase();
    return recipeKeywords.some(keyword => urlLower.includes(keyword));
  };

  // Test if an image URL is actually loadable using fetch HEAD request
  const testImageUrl = async (imageUrl: string): Promise<boolean> => {
    try {
      // Use fetch with HEAD method to test if image exists without downloading it
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced to 3 seconds
      
      const response = await fetch(imageUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const isImage = contentType && contentType.startsWith('image/');
        return !!isImage;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  // Get a recipe-specific placeholder image using Unsplash search with better uniqueness
  const getRecipeSpecificPlaceholder = (recipeName: string, category: string): string => {
    // Clean up recipe name for better search
    const cleanName = recipeName
      .replace(/recipe/gi, '')
      .replace(/easy/gi, '')
      .replace(/best/gi, '')
      .replace(/homemade/gi, '')
      .replace(/delicious/gi, '')
      .replace(/quick/gi, '')
      .replace(/simple/gi, '')
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .trim()
      .split(' ')
      .slice(0, 2) // Take first 2 words for more specific search
      .join(' ');
    
    // Create a unique search term with recipe name and add randomness to avoid duplicates
    const timestamp = Date.now().toString().slice(-4); // Last 4 digits for uniqueness
    const searchTerm = encodeURIComponent(`${cleanName} food recipe dish`);
    
    // Use Unsplash search API with recipe-specific terms and size parameters
    return `https://source.unsplash.com/featured/400x300/?${searchTerm}&sig=${timestamp}`;
  };

  // Search for specific recipe images from web sources
  const searchSpecificRecipeImage = async (recipeName: string, category: string, originalUrl: string): Promise<string> => {
    try {
      // Clean up recipe name for better search
      const cleanName = recipeName
        .replace(/recipe/gi, '')
        .replace(/easy/gi, '')
        .replace(/best/gi, '')
        .replace(/homemade/gi, '')
        .replace(/delicious/gi, '')
        .replace(/quick/gi, '')
        .replace(/simple/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
        .trim();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
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
              content: 'You are a recipe image finder. Find REAL recipe photos from cooking websites.\n\n🎯 MISSION: Find actual recipe photos from reputable cooking websites\n\n✅ SEARCH FOR:\n- Real recipe photos from AllRecipes, Food Network, Epicurious, etc.\n- Images showing the finished "${cleanName}" dish\n- High-quality food photography\n- Direct image URLs from recipe websites\n\n❌ AVOID:\n- Stock photos or generic images\n- AI-generated images\n- Images that don\'t match the specific recipe\n- Low-quality or blurry images\n\n🔍 SEARCH STRATEGY:\n1. Look for "${cleanName}" on major recipe sites\n2. Find the main recipe photo\n3. Extract the direct image URL\n4. Verify it shows the actual dish\n\nFormat: IMAGE: [direct image URL from recipe website]\n\nIf no suitable real recipe photo found: IMAGE: NONE'
            },
            {
              role: 'user',
              content: `Find a REAL recipe photo for: "${cleanName}"\n\nOriginal recipe URL: ${originalUrl}\nCategory: ${category}\n\nSearch for actual recipe photos from cooking websites that show this specific dish: "${cleanName}"\n\nThe image should be:\n- From a real recipe website\n- Showing the finished "${cleanName}" dish\n- High quality food photography\n- A direct image URL\n\nDo not use generic stock photos or AI-generated images.`
            }
          ]
        })
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return getRecipeSpecificPlaceholder(recipeName, category);
      }
      
      const data = await response.json();
      if (!data?.completion) {
        return getRecipeSpecificPlaceholder(recipeName, category);
      }
      
      const result = data.completion.trim();
      const imageLine = result.split('\n').find((line: string) => line.toUpperCase().startsWith('IMAGE:'));
      
      if (imageLine) {
        const imageUrl = imageLine.replace(/IMAGE:/i, '').trim();
        
        if (imageUrl !== 'NONE' && imageUrl.length > 10 && 
            (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) &&
            !imageUrl.toLowerCase().includes('stock') &&
            !imageUrl.toLowerCase().includes('shutterstock') &&
            !imageUrl.toLowerCase().includes('getty')) {
          
          const isLoadable = await testImageUrl(imageUrl);
          if (isLoadable) {
            console.log(`🖼️ Found recipe-specific image for "${recipeName}": ${imageUrl.substring(0, 60)}...`);
            return imageUrl;
          }
        }
      }
      
      console.log(`⚠️ No specific recipe image found for "${recipeName}", using placeholder`);
      return getRecipeSpecificPlaceholder(recipeName, category);
    } catch (error) {
      console.log(`❌ Error searching for recipe image for "${recipeName}", using placeholder`);
      return getRecipeSpecificPlaceholder(recipeName, category);
    }
  };

  const validateRecipeByUrl = (name: string, url: string): { isRecipe: boolean; category?: string; imageUri?: string; content?: string } => {
    const urlLower = url.toLowerCase();
    const nameLower = name.toLowerCase();
    
    // Strong recipe indicators in URL
    const strongRecipeIndicators = [
      '/recipe/', '/recipes/', 'recipe-', 'recipe_', '/r/',
      'how-to-make', 'how-to-cook', '/dish/', '/food/',
      '/cooking/', '/baking/', '/meal/', '/dinner/', '/lunch/',
      '/breakfast/', '/dessert/', '/appetizer/', '/soup/', '/salad/'
    ];
    
    // Comprehensive recipe site domains
    const recipeSites = [
      'allrecipes', 'foodnetwork', 'epicurious', 'tasty', 'delish',
      'recipetineats', 'simplyrecipes', 'tasteofhome', 'food.com',
      'yummly', 'cookinglight', 'eatingwell', 'myrecipes', 'pillsbury',
      'bettycrocker', 'kingarthur', 'seriouseats', 'thekitchn',
      'bonappetit', 'foodandwine', 'martha', 'williams-sonoma',
      'foodblog', 'blog', 'cooking', 'kitchen', 'chef', 'recipe',
      'minimalistbaker', 'sallysbakingaddiction', 'joyfoodsunshine',
      'cafedelites', 'damndelicious', 'therecipecritic', 'gimmesomeoven',
      'budgetbytes', 'skinnytaste', 'cookieandkate', 'loveandlemons',
      'pinterest', 'instagram', 'facebook', 'youtube'
    ];
    
    // Enhanced category keywords
    const dessertKeywords = [
      'dessert', 'cake', 'cookie', 'pie', 'sweet', 'chocolate', 'ice-cream', 
      'pudding', 'tart', 'brownie', 'muffin', 'cupcake', 'candy', 'fudge', 
      'cheesecake', 'tiramisu', 'frosting', 'icing', 'pastry', 'donut', 
      'cobbler', 'crisp', 'mousse', 'truffle', 'macaron', 'gelato', 'sorbet',
      'bread-pudding', 'creme', 'parfait', 'sundae', 'milkshake', 'smoothie-bowl',
      'cookies', 'cakes', 'pies', 'sweets', 'treats', 'baking'
    ];
    
    const appetizerKeywords = [
      'appetizer', 'starter', 'snack', 'dip', 'finger-food', 'wings', 'nachos', 
      'bruschetta', 'tapas', 'hors', 'canapé', 'crostini', 'deviled', 'stuffed', 
      'bites', 'poppers', 'sliders', 'pinwheel', 'roll-up', 'spread', 'chips',
      'hummus', 'guacamole', 'salsa', 'cheese-ball', 'meatball', 'spring-roll',
      'appetizers', 'starters', 'snacks'
    ];
    
    const soupSaladKeywords = [
      'soup', 'salad', 'broth', 'stew', 'chowder', 'bisque', 'gazpacho', 
      'minestrone', 'ramen', 'pho', 'consommé', 'potage', 'bowl', 'caesar', 
      'cobb', 'greek', 'waldorf', 'coleslaw', 'caprese', 'tomato-soup',
      'chicken-soup', 'vegetable-soup', 'potato-soup', 'bean-soup',
      'soups', 'salads', 'broths', 'stews'
    ];
    
    // Exclude obvious non-recipe pages
    const excludeKeywords = [
      '/category/', '/tag/', '/author/', '/search/', '/page/',
      'index.html', 'home.html', 'about.html', 'contact.html',
      'privacy', 'terms', 'sitemap', 'rss', 'feed', '/admin/', '/wp-admin/'
    ];
    
    // Check if it's likely a recipe - be more inclusive
    const hasStrongIndicator = strongRecipeIndicators.some(indicator => urlLower.includes(indicator));
    const isFromRecipeSite = recipeSites.some(site => urlLower.includes(site));
    const hasRecipeKeyword = isLikelyRecipeUrl(url) || nameLower.includes('recipe') || nameLower.includes('cook');
    const isNotExcluded = !excludeKeywords.some(keyword => urlLower.includes(keyword));
    const hasReasonableName = nameLower.length > 2 && nameLower.length < 300;
    
    // ULTRA INCLUSIVE logic - accept almost anything that could remotely be food-related
    if ((hasStrongIndicator || isFromRecipeSite || hasRecipeKeyword || 
         nameLower.includes('recipe') || nameLower.includes('cook') || 
         nameLower.includes('bake') || nameLower.includes('make') ||
         nameLower.includes('easy') || nameLower.includes('homemade') ||
         nameLower.includes('delicious') || nameLower.includes('best') ||
         nameLower.includes('food') || nameLower.includes('dish') ||
         nameLower.includes('meal') || nameLower.includes('dinner') ||
         nameLower.includes('lunch') || nameLower.includes('breakfast') ||
         nameLower.includes('snack') || nameLower.includes('appetizer') ||
         nameLower.includes('dessert') || nameLower.includes('sweet') ||
         nameLower.includes('tasty') || nameLower.includes('yummy') ||
         nameLower.includes('kitchen') || nameLower.includes('chef') ||
         nameLower.includes('cooking') || nameLower.includes('baking') ||
         nameLower.includes('grilled') || nameLower.includes('fried') ||
         nameLower.includes('roasted') || nameLower.includes('steamed') ||
         urlLower.includes('food') || urlLower.includes('recipe') ||
         urlLower.includes('cooking') || urlLower.includes('kitchen')) && 
        isNotExcluded && hasReasonableName) {
      // Enhanced category detection with better keyword matching
      let category: RecipeCategory = 'Main Course';
      const textToCheck = `${nameLower} ${urlLower}`;
      
      // Check for desserts first (most specific) - be more aggressive
      if (dessertKeywords.some(keyword => textToCheck.includes(keyword)) || 
          nameLower.includes('sweet') || nameLower.includes('bake') || 
          urlLower.includes('/dessert') || urlLower.includes('/sweet')) {
        category = 'Desserts';
      }
      // Then soups and salads (check before appetizers to avoid misclassification)
      else if (soupSaladKeywords.some(keyword => textToCheck.includes(keyword)) ||
               urlLower.includes('/soup') || urlLower.includes('/salad')) {
        category = 'Salads & Soups';
      }
      // Then appetizers
      else if (appetizerKeywords.some(keyword => textToCheck.includes(keyword)) ||
               urlLower.includes('/appetizer') || urlLower.includes('/starter')) {
        category = 'Appetizer';
      }
      // Everything else is main course
      
      console.log(`🎯 Fallback validation ACCEPTED: "${name}" -> ${category}`);
      return { isRecipe: true, category };
    }
    
    console.log(`❌ Fallback validation REJECTED: "${name}" -> not a recipe (very rare)`);
    return { isRecipe: false };
  };

  // Wrapper function with retry logic for recipe content fetching
  const fetchRecipeContentWithRetry = async (name: string, url: string, retryCount: number = 2): Promise<{ isRecipe: boolean; category?: string; imageUri?: string; content?: string }> => {
    let attempts = 0;
    const maxAttempts = retryCount + 1;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 [Attempt ${attempts + 1}/${maxAttempts}] Fetching recipe content for: "${name}"`);
        const result = await fetchRecipeContent(name, url);
        
        // If we got a valid result, return it
        if (result.isRecipe || attempts >= maxAttempts - 1) {
          return result;
        }
        
        // If not a recipe and we have more attempts, try again
        throw new Error('Not a recipe, retrying');
      } catch (error) {
        attempts++;
        
        if (attempts >= maxAttempts) {
          console.log(`💀 All ${maxAttempts} attempts failed for "${name}"`);
          return { isRecipe: false };
        }
        
        console.log(`🔄 Retrying recipe content fetch for "${name}" (attempt ${attempts + 1})`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Short delay before retry
      }
    }
    
    return { isRecipe: false };
  };

  const fetchRecipeContent = async (name: string, url: string): Promise<{ isRecipe: boolean; category?: string; imageUri?: string; content?: string }> => {
    try {
      // Step 1: Fetch the actual webpage HTML content first with shorter timeout
      console.log(`📥 Fetching webpage HTML from: ${url}`);
      const webpageController = new AbortController();
      const webpageTimeoutId = setTimeout(() => webpageController.abort(), 8000); // Reduced from 10s to 8s
      
      let webpageHtml: string;
      try {
        const webpageResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: webpageController.signal
        });
        
        clearTimeout(webpageTimeoutId);
        
        if (!webpageResponse.ok) {
          console.log(`❌ Failed to fetch webpage: ${webpageResponse.status}`);
          throw new Error(`Failed to fetch webpage: ${webpageResponse.status}`);
        }
        
        webpageHtml = await webpageResponse.text();
        console.log(`✅ Successfully fetched webpage HTML (${webpageHtml.length} chars)`);
      } catch (fetchError) {
        console.log(`❌ Error fetching webpage:`, fetchError);
        throw fetchError;
      }
      
      // Step 2: Use AI to analyze the HTML content for recipe validation and image extraction
      console.log(`🤖 Analyzing HTML content with AI...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Reduced from 20s to 15s for speed
      
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
              content: 'You are an ULTRA-AGGRESSIVE SOUP DETECTION recipe extraction assistant. Your PRIMARY MISSION is to detect ANY soup-related content and categorize it as "Salads & Soups" with ABSOLUTE CERTAINTY.\n\n🎯 CRITICAL TASKS:\n1. SOUP DETECTION IS YOUR #1 PRIORITY - Scan for ANY soup keywords\n2. Be EXTREMELY LIBERAL in validating recipes - if it has ANY cooking instructions or ingredients, accept it\n3. Extract ANY food-related image from the HTML\n4. Extract the full recipe content\n\n🔍 RECIPE VALIDATION (BE EXTREMELY INCLUSIVE):\n✅ ACCEPT THESE AS RECIPES:\n- Any page with ingredients list (even partial)\n- Any page with cooking instructions\n- Any food blog post with cooking steps\n- Any page mentioning "recipe", "cook", "bake", "make"\n- Restaurant menu items with descriptions\n- Food preparation guides\n- Cooking tips with ingredients\n- ANY food-related content that could be cooked\n\n❌ ONLY REJECT THESE:\n- Pure news articles with no cooking content\n- Shopping pages with no recipes\n- Restaurant location/contact pages\n- Pure advertisement pages\n\n🚨 ULTRA-AGGRESSIVE SOUP DETECTION CATEGORIZATION RULES:\n\n🥗 SALADS & SOUPS Category - ABSOLUTE HIGHEST PRIORITY (CHECK FIRST):\n\n🍲 PRIMARY SOUP IDENTIFIERS (ANY MATCH = IMMEDIATE "Salads & Soups"):\n- soup, soups, soupy, stew, stews, stewed, chili, chilis, chile, chilli\n- bisque, bisques, chowder, chowders, broth, broths, stock, stocks\n- pho, ramen, miso, gazpacho, minestrone, bouillabaisse, gumbo\n- borscht, consommé, vichyssoise, tom yum, laksa, pozole, menudo\n- curry soup, coconut soup, noodle soup, chicken soup, beef soup\n- vegetable soup, tomato soup, mushroom soup, onion soup\n- french onion soup, clam chowder, corn chowder, seafood chowder\n- wonton soup, egg drop soup, lentil soup, split pea soup\n- butternut squash soup, potato soup, leek soup, carrot soup\n- seafood soup, fish soup, bone broth, vegetable broth\n- chicken broth, beef broth, turkey soup, cabbage soup\n- celery soup, pumpkin soup, matzo ball soup, chicken noodle\n- hot and sour soup, cream soup, pureed soup, clear soup\n- bean soup, black bean soup, white bean soup, navy bean soup\n- tortilla soup, albondigas, cioppino, mulligatawny\n\n🍲 COMPOUND SOUP PHRASES (ALSO INSTANT CATEGORIZATION):\n- "hearty" + any soup word, "creamy" + any soup word\n- "homemade" + any soup word, "classic" + any soup word\n- "slow cooker" + soup/stew, "instant pot" + soup/stew\n- "pressure cooker" + soup/stew, "crockpot" + soup/stew\n- "easy" + soup/stew, "quick" + soup/stew\n- "healthy" + soup/stew, "vegetarian" + soup/stew\n- "spicy" + soup/stew/chili, "mild" + soup/stew/chili\n\n🥗 SALAD KEYWORDS (ALSO SALADS & SOUPS):\n- ALL salads (green, pasta, potato, fruit, grain salads)\n- Caesar salad, Greek salad, Cobb salad, coleslaw, slaw\n- Waldorf, nicoise, caprese, tabbouleh, quinoa salad\n- Chicken salad, tuna salad, egg salad, bean salad\n\n🚨 CRITICAL SOUP DETECTION RULES (MANDATORY - NO EXCEPTIONS):\n1. If recipe title contains ANY soup keyword → SALADS & SOUPS (IMMEDIATE)\n2. If recipe description mentions ANY soup keyword → SALADS & SOUPS (IMMEDIATE)\n3. If ingredients list includes "broth", "stock", or "liquid base" → SALADS & SOUPS\n4. Even if soup has meat (beef stew, chicken soup) → STILL SALADS & SOUPS\n5. ALL stews are liquid-based → SALADS & SOUPS (NO EXCEPTIONS)\n6. ALL chili is liquid-based → SALADS & SOUPS (NO EXCEPTIONS)\n7. ALL broths are soups → SALADS & SOUPS (NO EXCEPTIONS)\n8. Any dish with liquid consistency → SALADS & SOUPS\n9. If served in a bowl with a spoon → likely SALADS & SOUPS\n10. If recipe mentions "simmering" or "boiling" liquid → SALADS & SOUPS\n\n🥞 BREAKFAST Category (ONLY IF NO SOUP DETECTED):\n- Pancakes, waffles, French toast, crepes, oatmeal, granola\n- ALL egg dishes (scrambled, fried, poached, omelets, frittatas, quiche)\n- Breakfast sandwiches, breakfast burritos, breakfast wraps\n- Breakfast pastries (muffins, scones, croissants, danish)\n- Smoothie bowls, breakfast bowls, acai bowls\n- Coffee cake, breakfast bread, banana bread\n- Yogurt parfaits, breakfast quinoa\n- Hash browns, breakfast potatoes, home fries\n- Bacon, sausage, breakfast meats\n- Toast variations, bagels with toppings\n- Breakfast casseroles, overnight oats\n\n🍤 APPETIZER Category (ONLY IF NO SOUP DETECTED):\n- Small plates, finger foods, hors d\'oeuvres\n- Dips, spreads, chips with dips\n- Bruschetta, crostini, canapés\n- Wings, sliders, bite-sized items\n- Cheese boards, charcuterie\n- Stuffed mushrooms, deviled eggs\n- Spring rolls, dumplings, tapas\n\n🍖 MAIN COURSE Category (ONLY IF NO SOUP DETECTED):\n- Entrees, dinner dishes, lunch mains (NOT soup-based)\n- Meat dishes (steaks, roasts, grilled meats) - solid preparations\n- Pasta dishes (spaghetti, lasagna, etc.) - NOT soup-like\n- Rice dishes, grain bowls (NOT breakfast bowls)\n- Pizza, burgers, sandwiches (non-breakfast)\n- Casseroles (NOT breakfast casseroles), one-pot meals (NOT soups)\n- Fish and seafood mains (NOT in soup form)\n- Vegetarian/vegan main dishes (NOT soups or breakfast items)\n\n🍰 DESSERTS Category (ONLY IF NO SOUP DETECTED):\n- Cakes, cookies, pies, tarts\n- Ice cream, frozen desserts\n- Puddings, custards, mousses\n- Chocolate desserts, candy\n- Fruit desserts, cobblers\n- Cheesecakes, tiramisu\n\n🚨 ULTRA-STRICT CATEGORIZATION PROTOCOL:\n1. FIRST & MOST IMPORTANT: Scan ENTIRE recipe for ANY soup keywords → SALADS & SOUPS (MANDATORY)\n2. SECOND: Scan for salad keywords → SALADS & SOUPS\n3. THIRD: Check for breakfast foods → BREAKFAST\n4. FOURTH: Check for desserts → DESSERTS\n5. FIFTH: Check for appetizers → APPETIZER\n6. DEFAULT: MAIN COURSE\n\n⚠️ CRITICAL MISTAKES TO AVOID:\n- NEVER put soups in Main Course (even chicken soup, beef stew, chili)\n- NEVER put breakfast items in Main Course\n- NEVER categorize based on single ingredients - look at the whole dish\n- ALWAYS prioritize the dish format over ingredients\n- Soup with meat = Salads & Soups (NOT Main Course)\n- Breakfast dish with meat = Breakfast (NOT Main Course)\n\n🔍 IMAGE EXTRACTION (BE EXTREMELY AGGRESSIVE):\n1. META TAGS: <meta property="og:image" content="..."> (HIGHEST PRIORITY)\n2. TWITTER CARDS: <meta name="twitter:image" content="...">\n3. RECIPE SCHEMA: JSON-LD structured data with "image" property\n4. MAIN IMG TAGS: <img> with ANY food-related alt text\n5. HERO IMAGES: ANY large images on the page\n6. ANY FOOD IMAGE: Find ANY image that could be food-related\n7. FALLBACK: Even generic food images are acceptable\n\n✅ ACCEPT THESE IMAGES:\n- ANY food photos (even if not the exact recipe)\n- Ingredient photos\n- Cooking process photos\n- Restaurant food photos\n- Generic food images\n- Food category images (pasta, pizza, etc.)\n- ANY image that shows edible items\n\n❌ ONLY REJECT THESE IMAGES:\n- Pure logos or text\n- People photos (unless cooking)\n- Kitchen equipment only (no food)\n- Pure advertisement graphics\n\n🚨 CRITICAL: SOUP DETECTION IS THE ABSOLUTE #1 PRIORITY. If there\'s ANY soup-related word ANYWHERE in the recipe, it MUST be "Salads & Soups". NO EXCEPTIONS.\n\nRespond in this EXACT format:\nRECIPE: YES/NO\nCATEGORY: [Breakfast/Appetizer/Salads & Soups/Main Course/Desserts] (only if YES)\nIMAGE: [ANY food-related image URL from HTML] (MANDATORY - find SOMETHING)\nCONTENT: [any cooking-related content found] (only if YES)\n\n⚠️ CRITICAL: Find ANY food image. Do not return IMAGE: NONE unless absolutely no food-related images exist.'
            },
            {
              role: 'user',
              content: `🚨 ULTRA-AGGRESSIVE SOUP DETECTION AND RECIPE ANALYSIS 🚨\n\nURL: ${url}\nTitle: "${name}"\n\n📋 HTML CONTENT TO ANALYZE:\n${webpageHtml.substring(0, 50000)}\n\n🔍 CRITICAL TASKS (SOUP DETECTION FIRST):\n1. SOUP DETECTION IS YOUR #1 PRIORITY - Scan for ANY soup keywords\n2. BE EXTREMELY LIBERAL - Accept as recipe if it has ANY cooking content\n3. Find ANY food-related image from the HTML\n4. If it mentions cooking, ingredients, or food preparation - IT'S A RECIPE\n5. Extract ANY food image - even generic ones are acceptable\n\n🍲 ULTRA-AGGRESSIVE SOUP DETECTION (HIGHEST PRIORITY):\n\nScan the title "${name}" AND entire HTML content for ANY of these soup indicators:\n\n🍲 PRIMARY SOUP KEYWORDS (ANY MATCH = IMMEDIATE "Salads & Soups"):\nsoup, soups, soupy, stew, stews, stewed, chili, chilis, chile, chilli, bisque, bisques, chowder, chowders, broth, broths, stock, stocks, pho, ramen, miso, gazpacho, minestrone, bouillabaisse, gumbo, borscht, consommé, vichyssoise, tom yum, laksa, pozole, menudo, cioppino, mulligatawny, albondigas\n\n🍲 COMPOUND SOUP PHRASES (ANY MATCH = IMMEDIATE "Salads & Soups"):\n"chicken soup", "beef soup", "vegetable soup", "tomato soup", "mushroom soup", "onion soup", "french onion soup", "clam chowder", "corn chowder", "seafood chowder", "wonton soup", "egg drop soup", "lentil soup", "split pea soup", "butternut squash soup", "potato soup", "leek soup", "carrot soup", "seafood soup", "fish soup", "bone broth", "vegetable broth", "chicken broth", "beef broth", "turkey soup", "cabbage soup", "celery soup", "pumpkin soup", "matzo ball soup", "chicken noodle", "hot and sour soup", "cream soup", "pureed soup", "clear soup", "bean soup", "black bean soup", "white bean soup", "navy bean soup", "tortilla soup", "hearty stew", "beef stew", "chicken stew", "vegetable stew", "lamb stew", "pork stew", "turkey chili", "chicken chili", "vegetarian chili", "white chili", "bean chili", "three bean chili", "slow cooker soup", "instant pot soup", "crockpot soup", "pressure cooker soup"\n\n⚠️ CRITICAL INSTRUCTION: If you find ANY of the above keywords or phrases ANYWHERE in the title or HTML content, you MUST immediately categorize as "Salads & Soups" - NO EXCEPTIONS.\n\n🍳 RECIPE VALIDATION (MAXIMUM INCLUSIVITY):\n✅ ACCEPT IF IT HAS ANY OF THESE:\n- Ingredient lists (even partial)\n- Cooking steps or instructions\n- Food preparation mentions\n- Recipe keywords in title or content\n- Cooking methods (bake, fry, boil, etc.)\n- Food blog content\n- Restaurant menu descriptions\n- ANY food-related instructional content\n\n🖼️ IMAGE EXTRACTION (FIND ANYTHING FOOD-RELATED):\n• Scan EVERY <img> tag for ANY food images\n• Check <meta property="og:image"> first\n• Check <meta name="twitter:image">\n• Look for JSON-LD recipe schema images\n• Find ANY large images that could be food\n• Accept ingredient photos, cooking process photos\n• Accept generic food category images\n• Accept restaurant food photos\n• Accept ANY edible item images\n• DO NOT give up - find SOMETHING food-related\n\n✅ ACCEPT THESE IMAGES:\n- Recipe photos (perfect match)\n- Similar dish photos\n- Ingredient photos\n- Cooking process images\n- Generic food category images\n- Restaurant food photos\n- ANY food-related imagery\n\n🚨 ULTRA CRITICAL INSTRUCTIONS:\n- SOUP DETECTION IS YOUR #1 PRIORITY - If ANY soup keyword found, categorize as "Salads & Soups"\n- If there's ANY doubt about being a recipe - ACCEPT IT\n- If there's ANY food image on the page - USE IT\n- Be EXTREMELY generous in your interpretation\n- Find ANY food-related image, even if not perfect\n- Maximum inclusivity for both recipes and images\n\nAnalyze the HTML with SOUP-FIRST PRIORITY and find ANY food-related content and images.`
            }
          ]
        })
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`⚠️ API error (${response.status}) for "${name}"`);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.completion) {
        console.log(`⚠️ Invalid API response for "${name}"`);
        throw new Error('Invalid API response');
      }
      
      const result = data.completion.trim();
      console.log(`🤖 AI result for "${name}": ${result.substring(0, 500)}...`);
      
      // Enhanced response parsing
      const lines = result.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
      const recipeLine = lines.find((line: string) => line.toUpperCase().startsWith('RECIPE:'));
      const categoryLine = lines.find((line: string) => line.toUpperCase().startsWith('CATEGORY:'));
      const imageLine = lines.find((line: string) => line.toUpperCase().startsWith('IMAGE:'));
      const contentIndex = result.toUpperCase().indexOf('CONTENT:');
      
      console.log(`🔍 AI Response parsing for "${name}":`);
      console.log(`   Recipe line: ${recipeLine}`);
      console.log(`   Category line: ${categoryLine}`);
      console.log(`   Image line: ${imageLine}`);
      console.log(`   Has content: ${contentIndex !== -1}`);
      
      if (recipeLine && recipeLine.toUpperCase().includes('YES')) {
        let category: RecipeCategory = 'Main Course';
        if (categoryLine) {
          const extractedCategory = categoryLine.replace(/CATEGORY:/i, '').trim();
          const validCategories: RecipeCategory[] = ['Breakfast', 'Appetizer', 'Salads & Soups', 'Main Course', 'Desserts'];
          if (validCategories.includes(extractedCategory as RecipeCategory)) {
            category = extractedCategory as RecipeCategory;
          } else {
            console.log(`⚠️ Invalid category "${extractedCategory}", using Main Course`);
          }
        }
        
        let imageUri: string | undefined;
        if (imageLine) {
          const extractedImage = imageLine.replace(/IMAGE:/i, '').trim();
          console.log(`🔍 Raw extracted image URL: "${extractedImage}"`);
          
          // Check if AI found a recipe-specific image from the webpage
          if (extractedImage && extractedImage !== 'NONE' && extractedImage.length > 10 &&
              (extractedImage.startsWith('http://') || extractedImage.startsWith('https://')) && 
              !extractedImage.toLowerCase().includes('favicon') &&
              !extractedImage.toLowerCase().includes('sprite') &&
              !extractedImage.toLowerCase().includes('button') &&
              !extractedImage.toLowerCase().includes('arrow') &&
              !extractedImage.toLowerCase().includes('social') &&
              !extractedImage.toLowerCase().includes('share') &&
              !extractedImage.toLowerCase().includes('logo') &&
              !extractedImage.toLowerCase().includes('icon')) {
            
            console.log(`🧪 Testing extracted image URL: ${extractedImage}`);
            const isLoadable = await testImageUrl(extractedImage);
            
            if (isLoadable) {
              console.log(`✅ Using extracted recipe image from webpage: ${extractedImage}`);
              imageUri = extractedImage;
            } else {
              console.log(`❌ Extracted image not loadable: ${extractedImage}`);
              // Don't use fallback - if we can't get the real image, leave it undefined
            }
          } else {
            console.log(`❌ No valid image extracted from webpage HTML`);
            // Don't use fallback - if we can't get the real image, leave it undefined
          }
        } else {
          console.log(`❌ No image line found in AI response`);
          // Don't use fallback - if we can't get the real image, leave it undefined
        }
        
        let content: string | undefined;
        if (contentIndex !== -1) {
          content = result.substring(contentIndex + 8).trim(); // Remove 'CONTENT:' prefix
          if (content && content.length > 20) { // Minimum content length
            console.log(`📝 Extracted recipe content (${content.length} chars)`);
          } else {
            console.log(`⚠️ Content too short, ignoring`);
            content = undefined;
          }
        }
        
        console.log(`✅ AI extracted recipe: "${name}" -> ${category}${imageUri ? ' (with image from webpage)' : ' (no image found)'}${content ? ' (with content)' : ' (no content)'}`);
        return { isRecipe: true, category, imageUri, content };
      } else {
        console.log(`❌ AI rejected recipe: "${name}" - Recipe line: ${recipeLine}`);
        return { isRecipe: false };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`⏰ AI timeout for "${name}"`);
      } else {
        console.log(`⚠️ AI error for "${name}":`, error);
      }
      throw error;
    }
  };

  const handleFileUpload = async () => {
    try {
      setIsProcessing(true);
      setProcessingStatus('Selecting file...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/html', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setIsProcessing(false);
        return;
      }

      const file = result.assets[0];
      setProcessingStatus('Reading bookmark file...');
      
      // Read file content
      let fileContent: string;
      if (Platform.OS === 'web') {
        // For web, we need to handle File object differently
        const response = await fetch(file.uri);
        fileContent = await response.text();
      } else {
        // For mobile, read from file system
        const response = await fetch(file.uri);
        fileContent = await response.text();
      }

      setProcessingStatus('Parsing bookmarks...');
      const bookmarks = await parseBookmarkFile(fileContent);
      
      if (bookmarks.length === 0) {
        Alert.alert(
          'No Recipes Found',
          'No recipe links were found in the bookmark file. Please make sure you uploaded a valid bookmark file with recipe URLs.'
        );
        setIsProcessing(false);
        return;
      }

      setParsedBookmarks(bookmarks);
      setProcessingStatus(`Found ${bookmarks.length} recipes. Ready to import!`);
      
    } catch (error) {
      console.error('Error uploading bookmarks:', error);
      Alert.alert(
        'Upload Error',
        'Failed to process the bookmark file. Please make sure you selected a valid HTML bookmark file.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportBookmarks = async () => {
    try {
      setIsProcessing(true);
      setProcessingStatus('Importing recipes...');
      
      let successCount = 0;
      let failedRecipes: string[] = [];
      const importedRecipes: string[] = [];
      
      console.log(`🚀 Starting import of ${parsedBookmarks.length} recipes`);
      console.log(`📋 Recipes to import: ${parsedBookmarks.map(b => `"${b.name}" (${b.category})`).join(', ')}`);
      
      for (let i = 0; i < parsedBookmarks.length; i++) {
        const bookmark = parsedBookmarks[i];
        setProcessingStatus(`Importing ${i + 1}/${parsedBookmarks.length}: ${bookmark.name.substring(0, 25)}...`);
        console.log(`🔄 [${i + 1}/${parsedBookmarks.length}] Attempting to import: "${bookmark.name}" in category "${bookmark.category}"`);
        
        // Retry logic for import as well
        let importAttempts = 0;
        const maxImportAttempts = 3;
        let importSuccess = false;
        
        while (importAttempts < maxImportAttempts && !importSuccess) {
          try {
            // Ensure we have all required fields with proper typing
            const recipeToAdd: Omit<Recipe, 'id' | 'createdAt'> = {
              name: bookmark.name.trim(),
              category: bookmark.category as RecipeCategory,
              url: bookmark.url,
              imageUri: bookmark.imageUri || undefined,
              content: bookmark.content || undefined,
            };
            
            console.log(`📸 Recipe image data for "${bookmark.name}":`, {
              hasImageUri: !!bookmark.imageUri,
              imageUri: bookmark.imageUri?.substring(0, 100) + '...',
              imageLength: bookmark.imageUri?.length || 0
            });
            
            console.log(`📝 Recipe data to add (attempt ${importAttempts + 1}):`, {
              name: recipeToAdd.name,
              category: recipeToAdd.category,
              hasUrl: !!recipeToAdd.url,
              hasImage: !!recipeToAdd.imageUri,
              hasContent: !!recipeToAdd.content
            });
            
            const success = await addRecipe(recipeToAdd);
            
            if (success) {
              successCount++;
              importedRecipes.push(bookmark.name);
              importSuccess = true;
              console.log(`✅ [${i + 1}/${parsedBookmarks.length}] Successfully imported: "${bookmark.name}" (attempt ${importAttempts + 1})`);
            } else {
              importAttempts++;
              console.log(`❌ [${i + 1}/${parsedBookmarks.length}] Failed to import: "${bookmark.name}" - addRecipe returned false (attempt ${importAttempts})`);
              if (importAttempts < maxImportAttempts) {
                console.log(`🔄 Retrying import for "${bookmark.name}"...`);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          } catch (importError) {
            importAttempts++;
            console.error(`❌ [${i + 1}/${parsedBookmarks.length}] Error importing "${bookmark.name}" (attempt ${importAttempts}):`, importError);
            if (importAttempts < maxImportAttempts) {
              console.log(`🔄 Retrying import for "${bookmark.name}"...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        if (!importSuccess) {
          failedRecipes.push(bookmark.name);
          console.log(`❌ [${i + 1}/${parsedBookmarks.length}] Final failure to import: "${bookmark.name}" after ${maxImportAttempts} attempts`);
        }
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`📊 FINAL Import Summary:`);
      console.log(`✅ Successfully imported (${successCount}): ${importedRecipes.join(', ')}`);
      if (failedRecipes.length > 0) {
        console.log(`❌ Failed to import (${failedRecipes.length}): ${failedRecipes.join(', ')}`);
      }
      
      // Clear processing state before showing alert
      setIsProcessing(false);
      setProcessingStatus('');
      
      // Refresh recipes to ensure they show up in the cook book
      if (successCount > 0) {
        console.log('🔄 UPLOAD: Refreshing recipes after successful import...');
        try {
          await refreshRecipes();
          console.log('✅ UPLOAD: Recipes refreshed successfully');
        } catch (refreshError) {
          console.error('❌ UPLOAD: Error refreshing recipes:', refreshError);
        }
      }
      
      // Show detailed success message
      const skippedCount = parsedBookmarks.length - successCount;
      let message = `🎉 Successfully imported ${successCount} out of ${parsedBookmarks.length} recipe${parsedBookmarks.length !== 1 ? 's' : ''}!`;
      
      if (successCount > 0) {
        message += `\n\n✅ Imported recipes:\n${importedRecipes.slice(0, 5).join('\n')}${importedRecipes.length > 5 ? `\n...and ${importedRecipes.length - 5} more` : ''}`;
        message += `\n\nYou can now find them in the Cook Book tab.`;
      }
      
      if (skippedCount > 0) {
        message += `\n\n⚠️ ${skippedCount} recipe${skippedCount !== 1 ? 's' : ''} could not be imported.`;
        if (failedRecipes.length > 0) {
          message += `\n\n❌ Failed recipes:\n${failedRecipes.slice(0, 3).join('\n')}${failedRecipes.length > 3 ? `\n...and ${failedRecipes.length - 3} more` : ''}`;
        }
      }
      
      // Use setTimeout to ensure the alert shows after state updates
      setTimeout(() => {
        Alert.alert(
          successCount > 0 ? `Import Complete! 🎉` : 'Import Complete',
          message,
          [
            {
              text: successCount > 0 ? 'View Cook Book' : 'OK',
              onPress: () => {
                setParsedBookmarks([]);
                if (successCount > 0) {
                  router.replace('/(tabs)/recipe-book');
                }
              }
            },
            ...(successCount > 0 ? [{
              text: 'Stay Here',
              style: 'cancel' as const,
              onPress: () => {
                setParsedBookmarks([]);
              }
            }] : [])
          ]
        );
      }, 100);
      
    } catch (error) {
      console.error('❌ Critical error importing bookmarks:', error);
      setIsProcessing(false);
      setProcessingStatus('');
      
      setTimeout(() => {
        Alert.alert(
          'Import Error',
          'An unexpected error occurred while importing recipes. Please try again.',
          [{ text: 'OK' }]
        );
      }, 100);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Upload Bookmarks',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
        }} 
      />
      <GradientBackground>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Upload size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Import Cook Book Bookmarks</Text>
          <Text style={styles.description}>
            Upload your browser bookmarks file to automatically import all your saved recipes. 
            The AI will analyze each link, verify it contains a recipe, categorize it appropriately, 
            and generate beautiful food images for each recipe. Non-recipe links will be automatically filtered out.
          </Text>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>How to export bookmarks:</Text>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>1.</Text>
            <Text style={styles.stepText}>Open your browser (Chrome, Firefox, Safari, etc.)</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>2.</Text>
            <Text style={styles.stepText}>Go to Bookmarks → Export Bookmarks</Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={styles.stepNumber}>3.</Text>
            <Text style={styles.stepText}>Save the HTML file and upload it here</Text>
          </View>
        </View>

        {!parsedBookmarks.length ? (
          <Button
            title="Select Bookmark File"
            onPress={handleFileUpload}
            disabled={isProcessing}
            style={styles.uploadButton}
            size="large"
          />
        ) : (
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <CheckCircle size={24} color={Colors.success} />
              <Text style={styles.previewTitle}>
                Found {parsedBookmarks.length} Recipes
              </Text>
            </View>
            
            <ScrollView style={styles.recipeList} nestedScrollEnabled>
              {parsedBookmarks.slice(0, 10).map((bookmark, index) => (
                <View key={index} style={styles.recipeItem}>
                  <FileText size={16} color={Colors.textSecondary} />
                  <View style={styles.recipeInfo}>
                    <Text style={styles.recipeName} numberOfLines={1}>
                      {bookmark.name}
                    </Text>
                    <Text style={styles.recipeCategory}>
                      {bookmark.category}
                    </Text>
                  </View>
                </View>
              ))}
              {parsedBookmarks.length > 10 && (
                <Text style={styles.moreText}>
                  ...and {parsedBookmarks.length - 10} more recipes
                </Text>
              )}
            </ScrollView>
            
            <Button
              title="Import All Recipes"
              onPress={handleImportBookmarks}
              disabled={isProcessing}
              style={styles.importButton}
              size="large"
            />
          </View>
        )}

        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.processingText}>{processingStatus}</Text>
          </View>
        )}
        </ScrollView>
      </GradientBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  instructionsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 8,
    minWidth: 20,
  },
  stepText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  uploadButton: {
    marginBottom: 24,
  },
  previewContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  recipeList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBackground,
  },
  recipeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  recipeCategory: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  moreText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  importButton: {
    marginTop: 8,
  },
  processingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  processingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
});