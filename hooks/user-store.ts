import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { UserProfile, FriendLink } from '@/types';
import { useAuth } from './auth-store';
import { trpcClient } from '@/lib/trpc';

const FRIEND_LINKS_STORAGE_KEY = 'social-friend-links';

const [UserContext, useUser] = createContextHook(() => {
  const { user: authUser, updateProfile: updateAuthProfile } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserProfileFromBackend = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const profile = await trpcClient.users.getUserProfile.query({ userId });
      return profile;
    } catch (error) {
      console.error('Failed to load user profile from backend:', error);
      return null;
    }
  }, []);



  const loadFriendLinks = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FRIEND_LINKS_STORAGE_KEY);
      const links = stored ? JSON.parse(stored) : [];
      setFriendLinks(links);
      return links;
    } catch (error) {
      console.error('Failed to load friend links:', error);
      return [];
    }
  }, []);

  const saveFriendLinks = useCallback(async (links: FriendLink[]) => {
    try {
      await AsyncStorage.setItem(FRIEND_LINKS_STORAGE_KEY, JSON.stringify(links));
      setFriendLinks(links);
    } catch (error) {
      console.error('Failed to save friend links:', error);
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    if (!authUser) {
      setCurrentUserProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const profile: UserProfile = {
        id: authUser.id,
        username: authUser.username || authUser.email.split('@')[0],
        displayName: authUser.name,
        shareCookbookWithFriends: authUser.shareCookbookWithFriends || false,
      };

      setCurrentUserProfile(profile);
      await loadFriendLinks();
    } catch (error) {
      console.error('Failed to load current user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, loadFriendLinks]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const updateShareCookbook = useCallback(async (shareCookbook: boolean) => {
    if (!currentUserProfile || !authUser) return false;

    try {
      await updateAuthProfile({ shareCookbookWithFriends: shareCookbook });
      
      const updatedProfile = {
        ...currentUserProfile,
        shareCookbookWithFriends: shareCookbook,
      };

      setCurrentUserProfile(updatedProfile);
      
      console.log('✅ Updated share cookbook setting:', shareCookbook);
      return true;
    } catch (error) {
      console.error('Failed to update share cookbook setting:', error);
      return false;
    }
  }, [currentUserProfile, authUser, updateAuthProfile]);

  const searchUsersByUsername = useCallback(async (query: string) => {
    const normalized = query.trim().toLowerCase();
    
    console.log('🔍 ======== FRONTEND USERNAME SEARCH START ======== ');
    console.log('🔍 Input query:', query);
    console.log('🔍 Normalized query:', normalized);
    console.log('🔍 Current user:', currentUserProfile?.id, currentUserProfile?.username);

    if (!normalized || normalized.length < 2) {
      console.log('🔍 Query too short (<2 chars), clearing results');
      setSearchResults([]);
      return;
    }

    try {
      console.log('🔍 FRONTEND: Calling backend search...');
      
      const results = await trpcClient.users.searchUsers.query({
        query: normalized,
        excludeUserId: currentUserProfile?.id,
      });
      
      console.log('🔍 ======== FRONTEND SEARCH RESULTS ========');
      console.log('🔍 Total matches from backend:', results.length);
      results.forEach((r, i) => {
        console.log(`🔍 Result ${i + 1}: @${r.username} (${r.displayName}) [${r.id}]`);
      });
      console.log('🔍 ======== FRONTEND USERNAME SEARCH END ========');

      setSearchResults(results);
    } catch (error) {
      console.error('❌ FRONTEND: Failed to search users:', error);
      setSearchResults([]);
    }
  }, [currentUserProfile]);

  const sendFriendRequest = useCallback(async (targetUserId: string) => {
    if (!currentUserProfile) return false;

    try {
      const links = await loadFriendLinks();
      
      const existingLink = links.find(
        (link: FriendLink) =>
          (link.userId === currentUserProfile.id && link.friendUserId === targetUserId) ||
          (link.userId === targetUserId && link.friendUserId === currentUserProfile.id)
      );

      if (existingLink) {
        console.log('Friend request already exists');
        return false;
      }

      const newLink: FriendLink = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        userId: currentUserProfile.id,
        friendUserId: targetUserId,
        status: 'pending',
        requestedAt: Date.now(),
      };

      await saveFriendLinks([...links, newLink]);
      return true;
    } catch (error) {
      console.error('Failed to send friend request:', error);
      return false;
    }
  }, [currentUserProfile, loadFriendLinks, saveFriendLinks]);

  const acceptFriendRequest = useCallback(async (friendLinkId: string) => {
    try {
      const links = await loadFriendLinks();
      const updatedLinks = links.map((link: FriendLink) =>
        link.id === friendLinkId ? { ...link, status: 'accepted' as const } : link
      );

      await saveFriendLinks(updatedLinks);
      return true;
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      return false;
    }
  }, [loadFriendLinks, saveFriendLinks]);

  const rejectFriendRequest = useCallback(async (friendLinkId: string) => {
    try {
      const links = await loadFriendLinks();
      const updatedLinks = links.filter((link: FriendLink) => link.id !== friendLinkId);

      await saveFriendLinks(updatedLinks);
      return true;
    } catch (error) {
      console.error('Failed to reject friend request:', error);
      return false;
    }
  }, [loadFriendLinks, saveFriendLinks]);

  const removeFriend = useCallback(async (friendUserId: string) => {
    if (!currentUserProfile) return false;

    try {
      const links = await loadFriendLinks();
      const updatedLinks = links.filter(
        (link: FriendLink) =>
          !(
            (link.userId === currentUserProfile.id && link.friendUserId === friendUserId) ||
            (link.userId === friendUserId && link.friendUserId === currentUserProfile.id)
          )
      );

      await saveFriendLinks(updatedLinks);
      return true;
    } catch (error) {
      console.error('Failed to remove friend:', error);
      return false;
    }
  }, [currentUserProfile, loadFriendLinks, saveFriendLinks]);

  const getUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    return await loadUserProfileFromBackend(userId);
  }, [loadUserProfileFromBackend]);

  const getMyFriendLinks = useCallback(() => {
    if (!currentUserProfile) return [];
    
    return friendLinks.filter(
      (link) =>
        link.status === 'accepted' &&
        (link.userId === currentUserProfile.id || link.friendUserId === currentUserProfile.id)
    );
  }, [currentUserProfile, friendLinks]);

  const getIncomingRequests = useCallback(() => {
    if (!currentUserProfile) return [];
    
    return friendLinks.filter(
      (link) => link.status === 'pending' && link.friendUserId === currentUserProfile.id
    );
  }, [currentUserProfile, friendLinks]);

  const getOutgoingRequests = useCallback(() => {
    if (!currentUserProfile) return [];
    
    return friendLinks.filter(
      (link) => link.status === 'pending' && link.userId === currentUserProfile.id
    );
  }, [currentUserProfile, friendLinks]);

  const getFriendProfiles = useCallback(async () => {
    const myLinks = getMyFriendLinks();
    const friendIds = myLinks.map((link) =>
      link.userId === currentUserProfile?.id ? link.friendUserId : link.userId
    );

    const profiles = await Promise.all(
      friendIds.map(async (id) => await loadUserProfileFromBackend(id))
    );
    
    return profiles.filter((p): p is UserProfile => p !== null);
  }, [currentUserProfile, getMyFriendLinks, loadUserProfileFromBackend]);

  const isFriend = useCallback((userId: string): boolean => {
    if (!currentUserProfile) return false;

    return friendLinks.some(
      (link) =>
        link.status === 'accepted' &&
        ((link.userId === currentUserProfile.id && link.friendUserId === userId) ||
          (link.userId === userId && link.friendUserId === currentUserProfile.id))
    );
  }, [currentUserProfile, friendLinks]);

  const hasPendingRequest = useCallback((userId: string): boolean => {
    if (!currentUserProfile) return false;

    return friendLinks.some(
      (link) =>
        link.status === 'pending' &&
        ((link.userId === currentUserProfile.id && link.friendUserId === userId) ||
          (link.userId === userId && link.friendUserId === currentUserProfile.id))
    );
  }, [currentUserProfile, friendLinks]);

  return {
    currentUserProfile,
    isLoading,
    updateShareCookbook,
    searchUsersByUsername,
    searchResults,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    getUserProfile,
    getMyFriendLinks,
    getIncomingRequests,
    getOutgoingRequests,
    getFriendProfiles,
    isFriend,
    hasPendingRequest,
  };
});

export { UserContext, useUser };
