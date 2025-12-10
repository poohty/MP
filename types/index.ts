export type User = {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  shareCookbookWithFriends?: boolean;
  locationPermission?: boolean;
};

export type RecipeCategory = 'Breakfast' | 'Appetizer' | 'Salads & Soups' | 'Main Course' | 'Desserts';

export type Recipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  imageUri?: string;
  url?: string;
  content?: string;
  ingredients?: string[];
  instructions?: string[];
  nutritionFacts?: {
    calories?: number;
    servings?: number;
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
    fiber?: string;
    sugar?: string;
    sodium?: string;
  };
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  calories?: string;
  nutritionalInfo?: string;
  isFavorite?: boolean;
  stepProgress?: { [stepIndex: number]: boolean };
  createdAt: number;
  ownerUserId?: string;
  importedFromUserId?: string;
};

export type MealPlanRecipe = {
  recipe: Recipe;
  multiplier: number;
};

export type MealPlan = {
  id: string;
  breakfast: MealPlanRecipe[];
  mainCourses: MealPlanRecipe[];
  appetizers: MealPlanRecipe[];
  saladsAndSoups: MealPlanRecipe[];
  desserts: MealPlanRecipe[];
  createdAt: number;
};

export type GroceryItem = {
  id: string;
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
};

export type GroceryList = {
  id: string;
  mealPlanId: string;
  items: GroceryItem[];
  createdAt: number;
};

export type StoreComparison = {
  storeName: string;
  address: string;
  distance: number;
  drivingTime?: string;
  phone?: string;
  totalPrice: number;
  items: {
    name: string;
    price: number;
    available: boolean;
  }[];
};

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  shareCookbookWithFriends: boolean;
};

export type FriendStatus = 'pending' | 'accepted';

export type FriendLink = {
  id: string;
  userId: string;
  friendUserId: string;
  status: FriendStatus;
  requestedAt: number;
};