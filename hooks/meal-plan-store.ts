import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { MealPlan, MealPlanRecipe, Recipe, RecipeCategory, GroceryList } from '@/types';
import { useAuth } from './auth-store';
import { useRecipes } from './recipe-store';

const MEAL_PLANS_STORAGE_KEY = 'meal-planner-meal-plans';

const [MealPlanContext, useMealPlans] = createContextHook(() => {
  const { user } = useAuth();
  const { recipes, getRecipesByCategory } = useRecipes();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [currentMealPlan, setCurrentMealPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMealPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedMealPlans = await AsyncStorage.getItem(`${MEAL_PLANS_STORAGE_KEY}-${user?.id}`);
      if (storedMealPlans) {
        const parsedMealPlans = JSON.parse(storedMealPlans);
        // Migrate old meal plans to new structure
        const migratedMealPlans = parsedMealPlans.map((plan: any) => {
          // Check if this is an old format meal plan
          if (plan.mainCourses && plan.mainCourses.length > 0 && !plan.mainCourses[0].recipe) {
            return {
              ...plan,
              breakfast: plan.breakfast ? plan.breakfast.map((recipe: any) => ({ recipe, multiplier: 1 })) : [],
              mainCourses: plan.mainCourses.map((recipe: any) => ({ recipe, multiplier: 1 })),
              appetizers: plan.appetizers.map((recipe: any) => ({ recipe, multiplier: 1 })),
              saladsAndSoups: plan.saladsAndSoups.map((recipe: any) => ({ recipe, multiplier: 1 })),
              desserts: plan.desserts.map((recipe: any) => ({ recipe, multiplier: 1 })),
            };
          }
          // Add breakfast array if it doesn't exist (for older meal plans)
          if (!plan.breakfast) {
            plan.breakfast = [];
          }
          return plan;
        });
        setMealPlans(migratedMealPlans);
      }
    } catch (error) {
      console.error('Failed to load meal plans:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      loadMealPlans();
    } else {
      setMealPlans([]);
      setIsLoading(false);
    }
  }, [user, loadMealPlans]);



  const saveMealPlans = useCallback(async (updatedMealPlans: MealPlan[]) => {
    try {
      await AsyncStorage.setItem(
        `${MEAL_PLANS_STORAGE_KEY}-${user?.id}`,
        JSON.stringify(updatedMealPlans)
      );
      setMealPlans(updatedMealPlans);
    } catch (error) {
      console.error('Failed to save meal plans:', error);
    }
  }, [user?.id]);

  // Function to get random recipes with favorite prioritization
  const getRandomRecipes = useCallback((category: RecipeCategory, count: number, excludeIds: string[] = []) => {
    const categoryRecipes = getRecipesByCategory(category).filter(
      recipe => !excludeIds.includes(recipe.id)
    );
    
    // If we don't have enough recipes, return all available ones
    if (categoryRecipes.length <= count) {
      return categoryRecipes;
    }
    
    // Separate favorites and non-favorites
    const favorites = categoryRecipes.filter(recipe => recipe.isFavorite);
    const nonFavorites = categoryRecipes.filter(recipe => !recipe.isFavorite);
    
    // Create a weighted pool: favorites get 2-3x more chances
    const weightedPool: Recipe[] = [];
    
    // Add favorites multiple times to increase their selection probability
    favorites.forEach(recipe => {
      weightedPool.push(recipe, recipe, recipe); // 3x weight for favorites
    });
    
    // Add non-favorites once
    nonFavorites.forEach(recipe => {
      weightedPool.push(recipe);
    });
    
    // Shuffle the weighted pool
    const shuffled = [...weightedPool].sort(() => 0.5 - Math.random());
    
    // Select unique recipes from the shuffled pool
    const selected: Recipe[] = [];
    const selectedIds = new Set<string>();
    
    for (const recipe of shuffled) {
      if (!selectedIds.has(recipe.id) && selected.length < count) {
        selected.push(recipe);
        selectedIds.add(recipe.id);
      }
    }
    
    // If we still need more recipes and haven't used all available ones
    if (selected.length < count) {
      for (const recipe of categoryRecipes) {
        if (!selectedIds.has(recipe.id) && selected.length < count) {
          selected.push(recipe);
          selectedIds.add(recipe.id);
        }
      }
    }
    
    return selected;
  }, [getRecipesByCategory]);

  const generateMealPlan = useCallback((
    breakfastCount: number,
    mainCourseCount: number,
    appetizerCount: number,
    saladsAndSoupsCount: number,
    dessertCount: number,
    includedRecipeIds: string[] = []
  ) => {
    try {
      // First, get the specifically included recipes
      const includedRecipes = recipes.filter(recipe => includedRecipeIds.includes(recipe.id));
      
      // Count how many of each category we already have from included recipes
      const includedBreakfast = includedRecipes.filter(r => r.category === 'Breakfast');
      const includedMainCourses = includedRecipes.filter(r => r.category === 'Main Course');
      const includedAppetizers = includedRecipes.filter(r => r.category === 'Appetizer');
      const includedSaladsAndSoups = includedRecipes.filter(r => r.category === 'Salads & Soups');
      const includedDesserts = includedRecipes.filter(r => r.category === 'Desserts');
      
      // Calculate how many more we need to randomly select
      const remainingBreakfast = Math.max(0, breakfastCount - includedBreakfast.length);
      const remainingMainCourses = Math.max(0, mainCourseCount - includedMainCourses.length);
      const remainingAppetizers = Math.max(0, appetizerCount - includedAppetizers.length);
      const remainingSaladsAndSoups = Math.max(0, saladsAndSoupsCount - includedSaladsAndSoups.length);
      const remainingDesserts = Math.max(0, dessertCount - includedDesserts.length);
      
      // Get random recipes for each category, excluding already included ones
      const randomBreakfast = getRandomRecipes(
        'Breakfast',
        remainingBreakfast,
        includedRecipeIds
      );
      
      const randomMainCourses = getRandomRecipes(
        'Main Course',
        remainingMainCourses,
        includedRecipeIds
      );
      
      const randomAppetizers = getRandomRecipes(
        'Appetizer',
        remainingAppetizers,
        includedRecipeIds
      );
      
      const randomSaladsAndSoups = getRandomRecipes(
        'Salads & Soups',
        remainingSaladsAndSoups,
        includedRecipeIds
      );
      
      const randomDesserts = getRandomRecipes(
        'Desserts',
        remainingDesserts,
        includedRecipeIds
      );
      
      // Combine included and random recipes with default multiplier of 1
      const newMealPlan: MealPlan = {
        id: Date.now().toString(),
        breakfast: [...includedBreakfast, ...randomBreakfast].map(recipe => ({ recipe, multiplier: 1 })),
        mainCourses: [...includedMainCourses, ...randomMainCourses].map(recipe => ({ recipe, multiplier: 1 })),
        appetizers: [...includedAppetizers, ...randomAppetizers].map(recipe => ({ recipe, multiplier: 1 })),
        saladsAndSoups: [...includedSaladsAndSoups, ...randomSaladsAndSoups].map(recipe => ({ recipe, multiplier: 1 })),
        desserts: [...includedDesserts, ...randomDesserts].map(recipe => ({ recipe, multiplier: 1 })),
        createdAt: Date.now(),
      };
      
      setCurrentMealPlan(newMealPlan);
      return newMealPlan;
    } catch (error) {
      console.error('Failed to generate meal plan:', error);
      return null;
    }
  }, [recipes, getRandomRecipes]);

  const saveMealPlan = useCallback(async (mealPlan: MealPlan) => {
    try {
      const updatedMealPlans = [mealPlan, ...mealPlans];
      await saveMealPlans(updatedMealPlans);
      return true;
    } catch (error) {
      console.error('Failed to save meal plan:', error);
      return false;
    }
  }, [mealPlans, saveMealPlans]);

  const deleteMealPlan = useCallback(async (mealPlanId: string) => {
    try {
      const updatedMealPlans = mealPlans.filter(plan => plan.id !== mealPlanId);
      await saveMealPlans(updatedMealPlans);
      return true;
    } catch (error) {
      console.error('Failed to delete meal plan:', error);
      return false;
    }
  }, [mealPlans, saveMealPlans]);

  const respinRecipe = useCallback((mealPlanId: string, category: RecipeCategory, recipeIndex: number) => {
    const mealPlan = mealPlans.find(plan => plan.id === mealPlanId);
    if (!mealPlan) return null;

    const categoryKey = category === 'Breakfast' ? 'breakfast' :
                       category === 'Main Course' ? 'mainCourses' :
                       category === 'Appetizer' ? 'appetizers' :
                       category === 'Salads & Soups' ? 'saladsAndSoups' : 'desserts';
    
    const currentRecipes = mealPlan[categoryKey];
    const currentRecipe = currentRecipes[recipeIndex];
    if (!currentRecipe) return null;

    // Get all recipe IDs currently in the meal plan to exclude them
    const usedRecipeIds = [
      ...mealPlan.breakfast.map(mr => mr.recipe.id),
      ...mealPlan.mainCourses.map(mr => mr.recipe.id),
      ...mealPlan.appetizers.map(mr => mr.recipe.id),
      ...mealPlan.saladsAndSoups.map(mr => mr.recipe.id),
      ...mealPlan.desserts.map(mr => mr.recipe.id),
    ];

    // Get a new random recipe from the same category
    const newRecipes = getRandomRecipes(category, 1, usedRecipeIds);
    if (newRecipes.length === 0) {
      // If no new recipes available, get any recipe from the category
      const allCategoryRecipes = getRandomRecipes(category, 1, [currentRecipe.recipe.id]);
      if (allCategoryRecipes.length === 0) return null;
      newRecipes.push(allCategoryRecipes[0]);
    }

    const newMealPlanRecipe: MealPlanRecipe = {
      recipe: newRecipes[0],
      multiplier: currentRecipe.multiplier // Keep the same multiplier
    };

    // Update the meal plan
    const updatedMealPlan = {
      ...mealPlan,
      [categoryKey]: currentRecipes.map((mr, index) => 
        index === recipeIndex ? newMealPlanRecipe : mr
      )
    };

    const updatedMealPlans = mealPlans.map(plan => 
      plan.id === mealPlanId ? updatedMealPlan : plan
    );

    saveMealPlans(updatedMealPlans);
    return updatedMealPlan;
  }, [mealPlans, getRandomRecipes, saveMealPlans]);

  const updateRecipeMultiplier = useCallback((mealPlanId: string, category: RecipeCategory, recipeIndex: number, multiplier: number) => {
    const mealPlan = mealPlans.find(plan => plan.id === mealPlanId);
    if (!mealPlan) return null;

    const categoryKey = category === 'Breakfast' ? 'breakfast' :
                       category === 'Main Course' ? 'mainCourses' :
                       category === 'Appetizer' ? 'appetizers' :
                       category === 'Salads & Soups' ? 'saladsAndSoups' : 'desserts';
    
    const currentRecipes = mealPlan[categoryKey];
    
    const updatedMealPlan = {
      ...mealPlan,
      [categoryKey]: currentRecipes.map((mr, index) => 
        index === recipeIndex ? { ...mr, multiplier } : mr
      )
    };

    const updatedMealPlans = mealPlans.map(plan => 
      plan.id === mealPlanId ? updatedMealPlan : plan
    );

    saveMealPlans(updatedMealPlans);
    return updatedMealPlan;
  }, [mealPlans, saveMealPlans]);

  const generateGroceryList = useCallback(async (mealPlan: MealPlan): Promise<GroceryList | null> => {
    try {
      // Collect all recipes with their multipliers
      const allMealPlanRecipes = [
        ...mealPlan.breakfast,
        ...mealPlan.mainCourses,
        ...mealPlan.appetizers,
        ...mealPlan.saladsAndSoups,
        ...mealPlan.desserts,
      ];

      console.log('Generating grocery list for recipes:', allMealPlanRecipes.map(mr => `${mr.recipe.name} (x${mr.multiplier})`));

      // Create messages for AI to generate grocery list
      const messages = [
        {
          role: 'system' as const,
          content: `You are a professional grocery list generator. Your task is to:
1. Extract ALL ingredients from each recipe
2. Adjust quantities based on recipe multipliers
3. Combine similar ingredients (e.g., if two recipes need onions, combine them)
4. Organize ingredients by grocery store categories
5. Provide realistic quantities with proper units

Return ONLY a valid JSON object with this exact structure:
{
  "items": [
    {
      "id": "unique-id",
      "name": "Ingredient Name",
      "quantity": "2 lbs" or "3 cups" etc,
      "category": "Produce" or "Meat & Seafood" or "Dairy & Eggs" or "Pantry" or "Bakery" etc,
      "checked": false
    }
  ]
}

Categories to use: Produce, Meat & Seafood, Dairy & Eggs, Pantry, Bakery, Frozen, Beverages, Other`
        },
        {
          role: 'user' as const,
          content: `Extract ingredients from these recipes and create a comprehensive grocery list:\n\n${allMealPlanRecipes.map(mr => {
            const recipeInfo = `Recipe: ${mr.recipe.name} (multiply by ${mr.multiplier})`;
            const recipeContent = mr.recipe.content || mr.recipe.url || 'No recipe content available';
            return `${recipeInfo}\nRecipe Content/URL: ${recipeContent}\n\n`;
          }).join('')}\n\nIMPORTANT: Read each recipe carefully and extract ALL ingredients. Adjust quantities by the multiplier. Combine similar ingredients from different recipes.`
        }
      ];

      console.log('Sending request to AI for grocery list generation...');
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate grocery list');
      }

      const data = await response.json();
      console.log('AI response for grocery list:', data.completion);
      
      let groceryData;
      
      try {
        // Clean the response to ensure it's valid JSON
        let cleanedResponse = data.completion.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
        }
        groceryData = JSON.parse(cleanedResponse);
        
        // Validate the structure
        if (!groceryData.items || !Array.isArray(groceryData.items)) {
          throw new Error('Invalid grocery data structure');
        }
        
        // Ensure each item has required fields
        groceryData.items = groceryData.items.map((item: any, index: number) => ({
          id: item.id || `item-${Date.now()}-${index}`,
          name: item.name || 'Unknown ingredient',
          quantity: item.quantity || '1',
          category: item.category || 'Other',
          checked: false
        }));
        
      } catch (parseError) {
        console.error('Failed to parse AI response, creating fallback grocery list:', parseError);
        // Create a more detailed fallback grocery list
        groceryData = {
          items: allMealPlanRecipes.flatMap((mr, recipeIndex) => {
            // Create basic fallback ingredients
            const basicIngredients = [
              'Salt', 'Pepper', 'Oil', 'Onion', 'Garlic'
            ];
            
            return basicIngredients.map((ingredient, ingredientIndex) => ({
              id: `fallback-${recipeIndex}-${ingredientIndex}`,
              name: `${ingredient} (for ${mr.recipe.name})`,
              quantity: mr.multiplier > 1 ? `${mr.multiplier}x` : '1',
              category: ingredient === 'Salt' || ingredient === 'Pepper' || ingredient === 'Oil' ? 'Pantry' : 'Produce',
              checked: false
            }));
          })
        };
      }

      console.log('Final grocery list items:', groceryData.items.length);

      const groceryList: GroceryList = {
        id: Date.now().toString(),
        mealPlanId: mealPlan.id,
        items: groceryData.items || [],
        createdAt: Date.now(),
      };

      return groceryList;
    } catch (error) {
      console.error('Failed to generate grocery list:', error);
      return null;
    }
  }, []);

  return useMemo(() => ({
    mealPlans,
    currentMealPlan,
    isLoading,
    generateMealPlan,
    saveMealPlan,
    deleteMealPlan,
    respinRecipe,
    updateRecipeMultiplier,
    generateGroceryList,
    refreshMealPlans: loadMealPlans,
  }), [mealPlans, currentMealPlan, isLoading, generateMealPlan, saveMealPlan, deleteMealPlan, respinRecipe, updateRecipeMultiplier, generateGroceryList, loadMealPlans]);
});

export { MealPlanContext, useMealPlans };