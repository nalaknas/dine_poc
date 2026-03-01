export const MEAL_TYPES = [
  'breakfast', 'brunch', 'lunch', 'dinner', 'dessert', 'snack',
] as const;

export const CUISINES = [
  'italian', 'mexican', 'chinese', 'japanese', 'thai', 'indian',
  'american', 'french', 'mediterranean', 'korean', 'vietnamese',
  'greek', 'spanish', 'middle-eastern', 'pizza', 'sushi', 'bbq',
  'seafood', 'steakhouse', 'vegan', 'vegetarian',
] as const;

export const OCCASIONS = [
  'date-night', 'family', 'celebration', 'birthday', 'casual',
  'business', 'romantic', 'group',
] as const;

export const DIETARY_RESTRICTIONS = [
  'vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'dairy-free',
  'nut-free', 'shellfish-free', 'soy-free', 'egg-free', 'halal',
  'kosher', 'keto', 'paleo', 'low-carb', 'low-sodium',
] as const;

export const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'] as const;

export type MealType = typeof MEAL_TYPES[number];
export type Cuisine = typeof CUISINES[number];
export type Occasion = typeof OCCASIONS[number];
export type DietaryRestriction = typeof DIETARY_RESTRICTIONS[number];
export type PriceRange = typeof PRICE_RANGES[number];
