// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  accessToken: string;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  phone_number?: string;
  venmo_username?: string;
  city?: string;
  state?: string;
  total_meals: number;
  restaurants_visited: number;
  cities_explored: number;
  cuisine_preferences: string[];
  dietary_restrictions: string[];
  created_at: string;
}

export interface UserStats {
  totalMeals: number;
  restaurantsVisited: number;
  citiesExplored: number;
  followersCount: number;
  followingCount: number;
}

// ─── Post / Meal ───────────────────────────────────────────────────────────────

export interface DishRating {
  id: string;
  dish_name: string;
  rating: number;
  notes?: string;
  is_star_dish: boolean;
}

export interface TaggedFriend {
  id: string;
  post_id: string;
  user_id?: string;
  display_name: string;
  username?: string;
  venmo_username?: string;
  amount_owed?: number;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assigned_to: string[];
}

export interface Post {
  id: string;
  author_id: string;
  author?: User;
  restaurant_name: string;
  city?: string;
  state?: string;
  address?: string;
  caption: string;
  overall_rating: number;
  price_range?: '$' | '$$' | '$$$' | '$$$$';
  price_per_person?: number;
  cuisine_type?: string;
  tags: string[];
  meal_type?: string;
  food_photos: string[];
  photo_labels?: Record<string, string>; // photo index → dish name
  is_public: boolean;
  meal_date?: string;
  meal_time?: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  // Relations
  dish_ratings?: DishRating[];
  tagged_friends?: TaggedFriend[];
  receipt_items?: ReceiptItem[];
  receipt_subtotal?: number;
  receipt_tax?: number;
  receipt_tip?: number;
  receipt_discount?: number;
  receipt_total?: number;
  // Client-side
  is_liked?: boolean;
  recent_comments?: Comment[];
}

// ─── Post Creation Draft ───────────────────────────────────────────────────────

export interface ReceiptData {
  restaurantName: string;
  date: string;
  time: string;
  address: string;
  city: string;
  state: string;
  items: { id: string; name: string; price: number }[];
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
}

export interface Friend {
  id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  venmo_username?: string;
  user_id?: string;
  is_app_user: boolean;
}

export interface PersonBreakdown {
  friend: Friend;
  items: { name: string; price: number; share: number }[];
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
}

export interface CreatePostDraft {
  // Step 1
  receiptImages?: string[];
  // Step 2 — receipt data
  receiptData?: ReceiptData;
  // Step 3
  selectedFriends: Friend[];
  // Step 4
  isFamilyStyle: boolean;
  itemAssignments: Record<string, string[]>; // itemId -> friendIds
  personBreakdowns?: PersonBreakdown[];
  // Step 5
  overallRating: number;
  dishRatings: { dishName: string; rating: number; notes?: string }[];
  // Step 6
  foodPhotos: string[];
  photoLabels: Record<number, string>; // photo index → dish name
  caption: string;
  tags: string[];
  cuisineType?: string;
  mealType?: string;
  // Step 7
  isPublic: boolean;
  mealDate?: string;
}

// ─── Comment ──────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  author?: User;
  content: string;
  like_count: number;
  is_liked?: boolean;
  created_at: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType = 'like' | 'comment' | 'comment_like' | 'tag' | 'follow' | 'recommendation';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  from_user_id: string;
  from_user?: User;
  post_id?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ─── Playlist ─────────────────────────────────────────────────────────────────

export interface PlaylistRestaurant {
  id: string;
  restaurant_name: string;
  city?: string;
  state?: string;
  cuisine_type?: string;
  google_place_id?: string;
  yelp_id?: string;
  notes?: string;
  added_at: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  restaurants: PlaylistRestaurant[];
  created_at: string;
}

// ─── Dining Partner ────────────────────────────────────────────────────────────

export interface DiningPartner {
  id: string;
  user_id: string;
  partner_id: string;
  partner?: User;
  label: string;
  created_at: string;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export interface RecommendedDish {
  name: string;
  similarity_score: number;
  description?: string;
}

export interface RestaurantRecommendation {
  restaurant_name: string;
  city: string;
  state: string;
  cuisine_type?: string;
  google_place_id?: string;
  yelp_id?: string;
  rating?: number;
  price_range?: string;
  image_url?: string;
  matched_dishes: RecommendedDish[];
  explanation: string;
  match_score: number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  // Detail screens
  MealDetail: { postId: string };
  UserProfile: { userId: string };
  RestaurantDetail: { name: string; city?: string; placeId?: string };
  Comments: { postId: string };
  EditPost: { postId: string };
  EditProfile: undefined;
  PlaylistDetail: { playlistId: string };
  CreatePlaylist: undefined;
  Settings: undefined;
  Recommendations: undefined;
  VenmoRequests: { breakdowns: PersonBreakdown[]; restaurantName: string };
};

export type TabParamList = {
  Feed: undefined;
  Explore: undefined;
  PostCreation: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type PostCreationParamList = {
  Home: undefined;
  ValidateReceipt: undefined;
  SelectFriends: undefined;
  AssignItems: undefined;
  Summary: undefined;
  RateMeal: undefined;
  AddCaption: undefined;
  PostPrivacy: undefined;
};

// ─── Error ────────────────────────────────────────────────────────────────────

export type ErrorType =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface AppError {
  type: ErrorType;
  message: string;
  raw?: unknown;
}
