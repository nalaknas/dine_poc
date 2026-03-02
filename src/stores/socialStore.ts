import { create } from 'zustand';
import type { Post, CreatePostDraft } from '../types';

interface SocialState {
  feedPosts: Post[];
  myPosts: Post[];
  taggedPosts: Post[];
  draftPost: Partial<CreatePostDraft>;
  isLoadingFeed: boolean;
  // Feed
  setFeedPosts: (posts: Post[]) => void;
  prependFeedPost: (post: Post) => void;
  setMyPosts: (posts: Post[]) => void;
  prependMyPost: (post: Post) => void;
  setTaggedPosts: (posts: Post[]) => void;
  setLoadingFeed: (loading: boolean) => void;
  // Like
  toggleLike: (postId: string, userId: string) => void;
  // Draft
  setDraftPost: (draft: Partial<CreatePostDraft>) => void;
  updateDraftPost: (updates: Partial<CreatePostDraft>) => void;
  clearDraftPost: () => void;
  // Post management
  removePost: (postId: string) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  feedPosts: [],
  myPosts: [],
  taggedPosts: [],
  draftPost: {},
  isLoadingFeed: false,

  setFeedPosts: (feedPosts) => set({ feedPosts }),
  prependFeedPost: (post) =>
    set((state) => ({ feedPosts: [post, ...state.feedPosts] })),
  setMyPosts: (myPosts) => set({ myPosts }),
  prependMyPost: (post) =>
    set((state) => ({ myPosts: [post, ...state.myPosts] })),
  setTaggedPosts: (taggedPosts) => set({ taggedPosts }),
  setLoadingFeed: (isLoadingFeed) => set({ isLoadingFeed }),

  toggleLike: (postId, userId) =>
    set((state) => ({
      feedPosts: state.feedPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: !p.is_liked,
              like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1,
            }
          : p
      ),
      myPosts: state.myPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: !p.is_liked,
              like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1,
            }
          : p
      ),
    })),

  setDraftPost: (draftPost) => set({ draftPost }),
  updateDraftPost: (updates) =>
    set((state) => ({ draftPost: { ...state.draftPost, ...updates } })),
  clearDraftPost: () => set({ draftPost: {} }),

  removePost: (postId) =>
    set((state) => ({
      feedPosts: state.feedPosts.filter((p) => p.id !== postId),
      myPosts: state.myPosts.filter((p) => p.id !== postId),
    })),

  updatePost: (postId, updates) =>
    set((state) => ({
      feedPosts: state.feedPosts.map((p) =>
        p.id === postId ? { ...p, ...updates } : p
      ),
      myPosts: state.myPosts.map((p) =>
        p.id === postId ? { ...p, ...updates } : p
      ),
    })),
}));
