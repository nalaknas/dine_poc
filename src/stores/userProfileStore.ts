import { create } from 'zustand';
import type { User, DiningPartner, Playlist } from '../types';

interface UserProfileState {
  profile: User | null;
  followersCount: number;
  followingCount: number;
  isFollowing: Record<string, boolean>; // userId -> bool
  diningPartners: DiningPartner[];
  playlists: Playlist[];
  setProfile: (profile: User | null) => void;
  updateProfile: (updates: Partial<User>) => void;
  setFollowCounts: (followers: number, following: number) => void;
  setIsFollowing: (userId: string, following: boolean) => void;
  setDiningPartners: (partners: DiningPartner[]) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  incrementMealCount: () => void;
  reset: () => void;
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: null,
  followersCount: 0,
  followingCount: 0,
  isFollowing: {},
  diningPartners: [],
  playlists: [],

  setProfile: (profile) => set({ profile }),
  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    })),
  setFollowCounts: (followers, following) =>
    set({ followersCount: followers, followingCount: following }),
  setIsFollowing: (userId, following) =>
    set((state) => ({
      isFollowing: { ...state.isFollowing, [userId]: following },
    })),
  setDiningPartners: (partners) => set({ diningPartners: partners }),
  setPlaylists: (playlists) => set({ playlists }),
  incrementMealCount: () =>
    set((state) => ({
      profile: state.profile
        ? { ...state.profile, total_meals: state.profile.total_meals + 1 }
        : null,
    })),
  reset: () =>
    set({
      profile: null,
      followersCount: 0,
      followingCount: 0,
      isFollowing: {},
      diningPartners: [],
      playlists: [],
    }),
}));
