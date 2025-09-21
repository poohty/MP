import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { useRecipes } from '@/hooks/recipe-store';
import Button from '@/components/Button';
import Input from '@/components/Input';
import DropdownSelect from '@/components/DropdownSelect';
import Colors from '@/constants/colors';
import { RecipeCategory } from '@/types';

export default function AddRecipeUrlScreen() {
  const { addRecipe } = useRecipes();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('Breakfast');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  const categoryOptions = [
    { label: 'Breakfast', value: 'Breakfast' },
    { label: 'Appetizer', value: 'Appetizer' },
    { label: 'Salads & Soups', value: 'Salads & Soups' },
    { label: 'Main Course', value: 'Main Course' },
    { label: 'Desserts', value: 'Desserts' },
  ];

  const validate = () => {
    const newErrors: { name?: string; url?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Recipe name is required';
    }
    
    if (!url.trim()) {
      newErrors.url = 'Recipe URL is required';
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      newErrors.url = 'Please enter a valid URL starting with http:// or https://';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const categorizeRecipeWithAI = async (recipeName: string, recipeUrl: string): Promise<RecipeCategory> => {
    try {
      console.log(`🤖 AI categorizing recipe: "${recipeName}" from ${recipeUrl}`);
      
      // First, fetch the actual webpage HTML content for better categorization
      console.log(`📥 Fetching webpage HTML for categorization from: ${recipeUrl}`);
      const webpageController = new AbortController();
      const webpageTimeoutId = setTimeout(() => webpageController.abort(), 8000);
      
      let webpageHtml: string = '';
      try {
        const webpageResponse = await fetch(recipeUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: webpageController.signal
        });
        
        clearTimeout(webpageTimeoutId);
        
        if (webpageResponse.ok) {
          webpageHtml = await webpageResponse.text();
          console.log(`✅ Successfully fetched webpage HTML for categorization (${webpageHtml.length} chars)`);
        } else {
          console.log(`⚠️ Failed to fetch webpage for categorization: ${webpageResponse.status}`);
        }
      } catch (fetchError) {
        console.log(`⚠️ Error fetching webpage for categorization:`, fetchError);
      }
      
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `🚨 ULTRA-AGGRESSIVE SOUP DETECTION CATEGORIZATION EXPERT 🚨

You are the MOST AGGRESSIVE soup detection AI with ZERO TOLERANCE for miscategorization. Your PRIMARY MISSION is to detect ANY soup-related content and categorize it as "Salads & Soups" with ABSOLUTE CERTAINTY.

🎯 MANDATORY SOUP-FIRST CATEGORIZATION PROTOCOL:

🥗 SALADS & SOUPS Category - ABSOLUTE HIGHEST PRIORITY (CHECK FIRST):

🚨 ULTRA-AGGRESSIVE SOUP DETECTION KEYWORDS (ANY SINGLE MATCH = SALADS & SOUPS):

🍲 PRIMARY SOUP IDENTIFIERS (INSTANT CATEGORIZATION):
- soup, soups, soupy, stew, stews, stewed, chili, chilis, chile, chilli
- bisque, bisques, chowder, chowders, broth, broths, stock, stocks
- pho, ramen, miso, gazpacho, minestrone, bouillabaisse, gumbo
- borscht, consommé, vichyssoise, tom yum, laksa, pozole, menudo
- curry soup, coconut soup, noodle soup, chicken soup, beef soup
- vegetable soup, tomato soup, mushroom soup, onion soup
- french onion soup, clam chowder, corn chowder, seafood chowder
- wonton soup, egg drop soup, lentil soup, split pea soup
- butternut squash soup, potato soup, leek soup, carrot soup
- seafood soup, fish soup, bone broth, vegetable broth
- chicken broth, beef broth, turkey soup, cabbage soup
- celery soup, pumpkin soup, matzo ball soup, chicken noodle
- hot and sour soup, cream soup, pureed soup, clear soup
- bean soup, black bean soup, white bean soup, navy bean soup
- tortilla soup, albondigas, cioppino, mulligatawny

🍲 COMPOUND SOUP PHRASES (ALSO INSTANT CATEGORIZATION):
- "hearty" + any soup word, "creamy" + any soup word
- "homemade" + any soup word, "classic" + any soup word
- "slow cooker" + soup/stew, "instant pot" + soup/stew
- "pressure cooker" + soup/stew, "crockpot" + soup/stew
- "easy" + soup/stew, "quick" + soup/stew
- "healthy" + soup/stew, "vegetarian" + soup/stew
- "spicy" + soup/stew/chili, "mild" + soup/stew/chili

🍲 LIQUID-BASED DISH INDICATORS (ALSO SALADS & SOUPS):
- Any dish described as "liquid-based", "brothy", "simmered"
- Dishes served "in a bowl", "ladled", "spooned"
- Recipes mentioning "simmer", "boil", "liquid consistency"
- Dishes with "broth as base", "stock as foundation"
- Any recipe where liquid is the primary component

🚨 CRITICAL SOUP DETECTION RULES (MANDATORY - NO EXCEPTIONS):
1. If recipe title contains ANY soup keyword → SALADS & SOUPS (IMMEDIATE)
2. If recipe description mentions ANY soup keyword → SALADS & SOUPS (IMMEDIATE)
3. If ingredients list includes "broth", "stock", or "liquid base" → SALADS & SOUPS
4. Even if soup has meat (beef stew, chicken soup) → STILL SALADS & SOUPS
5. ALL stews are liquid-based → SALADS & SOUPS (NO EXCEPTIONS)
6. ALL chili is liquid-based → SALADS & SOUPS (NO EXCEPTIONS)
7. ALL broths are soups → SALADS & SOUPS (NO EXCEPTIONS)
8. Any dish with liquid consistency → SALADS & SOUPS
9. If served in a bowl with a spoon → likely SALADS & SOUPS
10. If recipe mentions "simmering" or "boiling" liquid → SALADS & SOUPS

🥗 SALAD KEYWORDS (ALSO SALADS & SOUPS):
- salad, salads, caesar, greek salad, cobb, coleslaw, slaw
- pasta salad, potato salad, fruit salad, grain salad, quinoa salad
- waldorf, nicoise, caprese, tabbouleh, chicken salad, tuna salad

🥞 BREAKFAST Category (ONLY IF NO SOUP DETECTED):
- Pancakes, waffles, French toast, crepes, oatmeal, granola
- Egg dishes, omelets, frittatas, breakfast sandwiches
- Muffins, scones, breakfast pastries, smoothie bowls

🍰 DESSERTS Category (ONLY IF NO SOUP DETECTED):
- Cakes, cookies, pies, ice cream, puddings, custards
- Chocolate desserts, sweet treats, fruit desserts

🍤 APPETIZER Category (ONLY IF NO SOUP DETECTED):
- Small plates, finger foods, dips, spreads, wings, sliders
- Bruschetta, crostini, deviled eggs, spring rolls

🍖 MAIN COURSE Category (ONLY IF NO SOUP DETECTED):
- Solid entrees (NOT liquid-based), meat dishes, pasta (NOT soup-like)
- Pizza, burgers, casseroles, grilled/roasted/baked dishes

🚨 ULTRA-STRICT CATEGORIZATION PRIORITY (FOLLOW EXACTLY):
1. FIRST & MOST IMPORTANT: Scan ENTIRE recipe for ANY soup keywords → SALADS & SOUPS (MANDATORY)
2. SECOND: Scan for salad keywords → SALADS & SOUPS
3. THIRD: Check for breakfast foods → BREAKFAST
4. FOURTH: Check for desserts → DESSERTS
5. FIFTH: Check for appetizers → APPETIZER
6. DEFAULT: MAIN COURSE

🚨 CRITICAL: SOUP DETECTION IS THE ABSOLUTE #1 PRIORITY. If there's ANY soup-related word ANYWHERE in the recipe, it MUST be "Salads & Soups". NO EXCEPTIONS.`
            },
            {
              role: 'user',
              content: `🚨 ULTRA-AGGRESSIVE SOUP DETECTION MISSION 🚨

Recipe Name: "${recipeName}"
Recipe URL: ${recipeUrl}

${webpageHtml ? `📋 WEBPAGE CONTENT FOR ANALYSIS:
${webpageHtml.substring(0, 50000)}

` : ''}🔍 MANDATORY SOUP-FIRST ANALYSIS PROTOCOL (FOLLOW EXACTLY):

🚨 STEP 1: ULTRA-AGGRESSIVE SOUP DETECTION SCAN (ABSOLUTE HIGHEST PRIORITY)

Scan recipe name "${recipeName}" AND entire webpage content for ANY of these soup indicators:

🍲 PRIMARY SOUP KEYWORDS (ANY MATCH = IMMEDIATE "Salads & Soups"):
soup, soups, soupy, stew, stews, stewed, chili, chilis, chile, chilli, bisque, bisques, chowder, chowders, broth, broths, stock, stocks, pho, ramen, miso, gazpacho, minestrone, bouillabaisse, gumbo, borscht, consommé, vichyssoise, tom yum, laksa, pozole, menudo, cioppino, mulligatawny, albondigas

🍲 COMPOUND SOUP PHRASES (ANY MATCH = IMMEDIATE "Salads & Soups"):
"chicken soup", "beef soup", "vegetable soup", "tomato soup", "mushroom soup", "onion soup", "french onion soup", "clam chowder", "corn chowder", "seafood chowder", "wonton soup", "egg drop soup", "lentil soup", "split pea soup", "butternut squash soup", "potato soup", "leek soup", "carrot soup", "seafood soup", "fish soup", "bone broth", "vegetable broth", "chicken broth", "beef broth", "turkey soup", "cabbage soup", "celery soup", "pumpkin soup", "matzo ball soup", "chicken noodle", "hot and sour soup", "cream soup", "pureed soup", "clear soup", "bean soup", "black bean soup", "white bean soup", "navy bean soup", "tortilla soup", "hearty stew", "beef stew", "chicken stew", "vegetable stew", "lamb stew", "pork stew", "turkey chili", "chicken chili", "vegetarian chili", "white chili", "bean chili", "three bean chili", "slow cooker soup", "instant pot soup", "crockpot soup", "pressure cooker soup"

🍲 LIQUID-BASED INDICATORS (ANY MATCH = IMMEDIATE "Salads & Soups"):
"liquid-based", "brothy", "simmered", "served in a bowl", "ladled", "spooned", "simmer", "boil", "liquid consistency", "broth as base", "stock as foundation", "liquid is the primary component"

⚠️ CRITICAL INSTRUCTION: If you find ANY of the above keywords or phrases ANYWHERE in the recipe name or webpage content, you MUST immediately return "Salads & Soups" - NO EXCEPTIONS, NO FURTHER ANALYSIS NEEDED.

🚨 STEP 2: SALAD DETECTION (ONLY IF NO SOUP FOUND)
Scan for: salad, salads, caesar, greek salad, cobb, coleslaw, slaw, pasta salad, potato salad, fruit salad, grain salad, quinoa salad, waldorf, nicoise, caprese, tabbouleh, chicken salad, tuna salad
If found → return "Salads & Soups"

🚨 STEP 3: BREAKFAST DETECTION (ONLY IF NO SOUP/SALAD FOUND)
Scan for: pancake, waffle, french toast, oatmeal, granola, breakfast, egg, omelet, muffin, scone
If found → return "Breakfast"

🚨 STEP 4: DESSERT DETECTION (ONLY IF NO SOUP/SALAD/BREAKFAST FOUND)
Scan for: cake, cookie, pie, dessert, sweet, chocolate, pudding, ice cream
If found → return "Desserts"

🚨 STEP 5: APPETIZER DETECTION (ONLY IF NONE OF THE ABOVE FOUND)
Scan for: appetizer, dip, wings, slider, bruschetta, tapas
If found → return "Appetizer"

🚨 STEP 6: DEFAULT (ONLY IF NONE OF THE ABOVE FOUND)
Return "Main Course"

🚨 MANDATORY SOUP EXAMPLES (MUST FOLLOW EXACTLY):
- "Hearty Beef Stew" → Salads & Soups (contains 'stew')
- "Chicken Noodle Soup" → Salads & Soups (contains 'soup')
- "Turkey Chili Recipe" → Salads & Soups (contains 'chili')
- "Creamy Tomato Bisque" → Salads & Soups (contains 'bisque')
- "Clam Chowder" → Salads & Soups (contains 'chowder')
- "Chicken Broth" → Salads & Soups (contains 'broth')
- "Vietnamese Pho" → Salads & Soups (contains 'pho')
- "Ramen Bowl" → Salads & Soups (contains 'ramen')
- "Vegetable Stew" → Salads & Soups (contains 'stew')
- "White Bean Chili" → Salads & Soups (contains 'chili')
- "Mushroom Soup" → Salads & Soups (contains 'soup')
- "Beef and Barley Soup" → Salads & Soups (contains 'soup')
- "Lentil Stew" → Salads & Soups (contains 'stew')
- "Chicken Stock" → Salads & Soups (contains 'stock')
- "Easy Chicken Soup" → Salads & Soups (contains 'soup')
- "Homemade Vegetable Soup" → Salads & Soups (contains 'soup')
- "Slow Cooker Beef Stew" → Salads & Soups (contains 'stew')
- "Instant Pot Chili" → Salads & Soups (contains 'chili')
- "Creamy Mushroom Bisque" → Salads & Soups (contains 'bisque')
- "Seafood Chowder Recipe" → Salads & Soups (contains 'chowder')

🎯 CRITICAL ANALYSIS FOR "${recipeName}":

Your PRIMARY MISSION is to detect if this recipe is soup-related. Scan the recipe name "${recipeName}" character by character for ANY soup keywords. If you find even ONE soup-related word, immediately categorize as "Salads & Soups".

Do NOT consider the protein content, cooking method, or heartiness - if it contains ANY soup keyword, it goes to "Salads & Soups" category.

Return ONLY ONE category: Breakfast, Appetizer, Salads & Soups, Main Course, or Desserts

🚨 REMEMBER: SOUP DETECTION IS YOUR #1 PRIORITY. If there's ANY soup-related word, return "Salads & Soups" immediately.`
            }
          ]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const aiCategory = data.completion?.trim();
        
        // Validate AI response and clean it up
        let cleanCategory = aiCategory?.replace(/[^a-zA-Z0-9\s&]/g, '').trim();
        
        // Handle common variations
        if (cleanCategory?.toLowerCase().includes('soup') || cleanCategory?.toLowerCase().includes('salad')) {
          cleanCategory = 'Salads & Soups';
        } else if (cleanCategory?.toLowerCase().includes('appetizer')) {
          cleanCategory = 'Appetizer';
        } else if (cleanCategory?.toLowerCase().includes('breakfast')) {
          cleanCategory = 'Breakfast';
        } else if (cleanCategory?.toLowerCase().includes('dessert')) {
          cleanCategory = 'Desserts';
        } else if (cleanCategory?.toLowerCase().includes('main')) {
          cleanCategory = 'Main Course';
        }
        
        const validCategories: RecipeCategory[] = ['Breakfast', 'Appetizer', 'Salads & Soups', 'Main Course', 'Desserts'];
        if (validCategories.includes(cleanCategory as RecipeCategory)) {
          console.log(`✅ AI categorized "${recipeName}" as: ${cleanCategory}`);
          return cleanCategory as RecipeCategory;
        } else {
          console.log(`⚠️ AI returned invalid category: ${aiCategory}, using manual categorization`);
        }
      } else {
        console.log(`❌ AI categorization API error: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error in AI categorization:`, error);
    }
    
    // Fallback to manual categorization
    return manualCategorization(recipeName);
  };
  
  const manualCategorization = (recipeName: string): RecipeCategory => {
    const name = recipeName.toLowerCase();
    
    // ULTRA-HIGH PRIORITY SOUP KEYWORDS - ALWAYS categorize as Salads & Soups
    const soupKeywords = [
      // Core soup words
      'soup', 'bisque', 'chowder', 'broth', 'stew', 'chili',
      // International soups
      'pho', 'ramen', 'minestrone', 'gazpacho', 'consommé', 'vichyssoise',
      'bouillabaisse', 'gumbo', 'borscht', 'miso soup',
      // Specific soup types
      'tomato soup', 'chicken soup', 'beef soup', 'vegetable soup', 'beef stew',
      'lentil soup', 'split pea', 'mushroom soup', 'curry soup', 'cream soup',
      'coconut soup', 'french onion soup', 'clam chowder', 'corn chowder',
      'wonton soup', 'noodle soup', 'bean soup', 'potato soup', 'corn soup',
      'seafood soup', 'turkey soup', 'onion soup', 'cabbage soup', 'leek soup',
      'butternut squash soup', 'pumpkin soup', 'carrot soup', 'celery soup',
      'chicken noodle', 'vegetable broth', 'bone broth', 'stock soup',
      // Stew variations
      'chicken stew', 'lamb stew', 'pork stew', 'vegetable stew',
      // Chili variations
      'turkey chili', 'chicken chili', 'vegetarian chili', 'white chili',
      'bean chili', 'three bean chili'
    ];
    
    // 1. SOUPS FIRST - ABSOLUTE HIGHEST PRIORITY to avoid miscategorization
    const hasSoupKeyword = soupKeywords.some(keyword => {
      // Strategy 1: Exact substring match
      if (name.includes(keyword)) return true;
      
      // Strategy 2: Remove spaces and check ("chicken soup" → "chickensoup")
      if (name.includes(keyword.replace(/\s+/g, ''))) return true;
      
      // Strategy 3: Check individual words
      const nameWords = name.split(/\s+/);
      const keywordWords = keyword.split(/\s+/);
      
      // Check if all keyword words appear in recipe name
      if (keywordWords.every(kw => nameWords.some(nw => nw.includes(kw)))) return true;
      
      // Strategy 4: Partial word matching for compound words
      if (keywordWords.length === 1) {
        const keywordRoot = keywordWords[0];
        if (nameWords.some(word => word.includes(keywordRoot) && word.length > keywordRoot.length)) {
          return true;
        }
      }
      
      return false;
    });
    
    if (hasSoupKeyword) {
      console.log(`🥗 SOUP DETECTED - Categorized as Salads & Soups due to soup keyword in: "${recipeName}"`);
      return 'Salads & Soups';
    }
    
    // Salad keywords
    const saladKeywords = [
      'salad', 'caesar', 'greek salad', 'cobb', 'coleslaw', 'slaw'
    ];
    
    // 2. SALADS - also high priority for Salads & Soups category
    const hasSaladKeyword = saladKeywords.some(keyword => {
      return name.includes(keyword) || 
             name.includes(keyword.replace(/\s+/g, '')) ||
             name.split(/\s+/).some(word => word.includes(keyword));
    });
    
    if (hasSaladKeyword) {
      console.log(`🥗 SALAD DETECTED - Categorized as Salads & Soups due to salad keyword in: "${recipeName}"`);
      return 'Salads & Soups';
    }
    
    // Breakfast keywords (most specific first)
    const breakfastKeywords = [
      'pancake', 'waffle', 'french toast', 'crepe', 'oatmeal', 'granola', 'muesli',
      'breakfast', 'morning', 'brunch', 'egg', 'omelet', 'frittata', 'scrambled',
      'muffin', 'scone', 'croissant', 'smoothie bowl', 'breakfast bowl',
      'coffee cake', 'breakfast bread', 'yogurt parfait', 'hash brown',
      'bacon', 'sausage breakfast', 'breakfast burrito', 'breakfast sandwich'
    ];
    
    // 3. BREAKFAST - very specific timing
    if (breakfastKeywords.some(keyword => name.includes(keyword))) {
      console.log(`🥞 Categorized as Breakfast due to breakfast keyword in: "${recipeName}"`);
      return 'Breakfast';
    }
    
    // Dessert keywords
    const dessertKeywords = [
      'cake', 'cookie', 'pie', 'tart', 'ice cream', 'dessert', 'sweet',
      'chocolate', 'pudding', 'custard', 'mousse', 'cheesecake', 'tiramisu',
      'brownie', 'candy', 'fudge', 'cobbler', 'crisp'
    ];
    
    // 4. DESSERTS - clear category
    if (dessertKeywords.some(keyword => name.includes(keyword))) {
      console.log(`🍰 Categorized as Desserts due to dessert keyword in: "${recipeName}"`);
      return 'Desserts';
    }
    
    // Appetizer keywords
    const appetizerKeywords = [
      'appetizer', 'dip', 'spread', 'bruschetta', 'crostini', 'canapé',
      'wings', 'slider', 'bite', 'finger food', 'hors d\'oeuvre',
      'deviled egg', 'stuffed mushroom', 'spring roll', 'dumpling'
    ];
    
    // 5. APPETIZERS - small plates
    if (appetizerKeywords.some(keyword => name.includes(keyword))) {
      console.log(`🍤 Categorized as Appetizer due to appetizer keyword in: "${recipeName}"`);
      return 'Appetizer';
    }
    
    // Default to Main Course
    return 'Main Course';
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setIsLoading(true);
    try {
      // Use AI to categorize the recipe
      const aiCategory = await categorizeRecipeWithAI(name.trim(), url.trim());
      
      await addRecipe({
        name: name.trim(),
        category: aiCategory,
        url: url.trim(),
      });
      
      Alert.alert('Success', `Recipe added successfully and categorized as "${aiCategory}"`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving recipe URL:', error);
      Alert.alert('Error', 'Failed to save recipe URL');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Add Recipe URL' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Add a link to a recipe from your favorite website
          </Text>
        </View>
        
        <Input
          label="Recipe Name"
          placeholder="Enter recipe name"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />
        
        <Input
          label="Recipe URL"
          placeholder="https://example.com/recipe"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          error={errors.url}
        />
        
        <DropdownSelect
          label="Category"
          options={categoryOptions}
          selectedValue={category}
          onSelect={(value) => setCategory(value as RecipeCategory)}
        />
        
        <Button
          title="Save Recipe"
          onPress={handleSave}
          isLoading={isLoading}
          style={styles.saveButton}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  infoContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 32,
  },
});