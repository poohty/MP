import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { UserProfile, FriendLink, User } from '@/types';
import { useAuth } from './auth-store';

const GLOBAL_USERS_KEY = 'meal-planner-global-users';
const USER_PROFILES_STORAGE_KEY = 'social-user-profiles';
const FRIEND_LINKS_STORAGE_KEY = 'social-friend-links';

const [UserContext, useUser] = createContextHook(() => {
  const { user: authUser, updateProfile: updateAuthProfile } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [, setAllUserProfiles] = useState<UserProfile[]>([]);
  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserProfiles = useCallback(async () => {
    try {
      const globalUsersJson = await AsyncStorage.getItem(GLOBAL_USERS_KEY);
      const globalUsers: User[] = globalUsersJson ? JSON.parse(globalUsersJson) : [];
      
      const profiles: UserProfile[] = globalUsers.map(u => ({
        id: u.id,
        username: u.username || u.email.split('@')[0],
        displayName: u.name || u.username || u.email.split('@')[0],
        shareCookbookWithFriends: u.shareCookbookWithFriends || false,
      }));
      
      setAllUserProfiles(profiles);
      return profiles;
    } catch (error) {
      console.error('Failed to load user profiles:', error);
      return [];
    }
  }, []);

  const saveUserProfiles = useCallback(async (profiles: UserProfile[]) => {
    try {
      await AsyncStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
      setAllUserProfiles(profiles);
    } catch (error) {
      console.error('Failed to save user profiles:', error);
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
      const profiles = await loadUserProfiles();
      let profile = profiles.find((p: UserProfile) => p.id === authUser.id);

      if (!profile) {
        profile = {
          id: authUser.id,
          username: authUser.username || authUser.email.split('@')[0],
          displayName: authUser.name,
          shareCookbookWithFriends: authUser.shareCookbookWithFriends || false,
        };
      } else {
        profile = {
          ...profile,
          username: authUser.username || profile.username,
          displayName: authUser.name || profile.displayName,
          shareCookbookWithFriends: authUser.shareCookbookWithFriends ?? profile.shareCookbookWithFriends,
        };
      }

      setCurrentUserProfile(profile);
      await loadFriendLinks();
    } catch (error) {
      console.error('Failed to load current user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, loadUserProfiles, loadFriendLinks]);

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
    
    console.log('🔍 searchUsersByUsername called with:', query);
    console.log('🔍 normalized query:', normalized);

    if (!normalized || normalized.length < 2) {
      console.log('🔍 Query too short, clearing results');
      setSearchResults([]);
      return;
    }

    try {
      const globalUsersJson = await AsyncStorage.getItem(GLOBAL_USERS_KEY);
      console.log('🔍 Raw global users JSON length:', globalUsersJson?.length || 0);
      
      const globalUsers: User[] = globalUsersJson ? JSON.parse(globalUsersJson) : [];
      
      console.log('🔍 SEARCH DEBUG:');
      console.log('  Query (normalized):', normalized);
      console.log('  Total users in global store:', globalUsers.length);
      console.log('  Current user ID:', currentUserProfile?.id);
      console.log('  All user IDs:', globalUsers.map(u => u.id).join(', '));
      console.log('  All usernames:', globalUsers.map(u => u.username || 'NO_USERNAME').join(', '));
      
      const profiles: UserProfile[] = globalUsers.map(u => {
        const username = (u.username || u.email.split('@')[0]).toLowerCase();
        return {
          id: u.id,
          username,
          displayName: u.name || u.username || u.email.split('@')[0],
          shareCookbookWithFriends: u.shareCookbookWithFriends || false,
        };
      });
      
      console.log('  Converted profiles:', profiles.map(p => `${p.username} (${p.displayName})`).join(', '));
      
      const results = profiles.filter(
        (p: UserProfile) => {
          const isNotMe = p.id !== currentUserProfile?.id;
          const matchesUsername = p.username.includes(normalized);
          const matchesDisplayName = p.displayName.toLowerCase().includes(normalized);
          
          const matches = isNotMe && (matchesUsername || matchesDisplayName);
          
          if (matches) {
            console.log('  ✅ Match found:', p.username, 'because username:', matchesUsername, 'displayName:', matchesDisplayName);
          }
          
          return matches;
        }
      );
      
      console.log('🔍 searchUsersByUsername results from global store:', results.length);
      console.log('  Matched users:', results.map(r => `@${r.username} (${r.displayName})`).join(', '));

      setSearchResults(results);
    } catch (error) {
      console.error('❌ Failed to search users:', error);
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
    try {
      const profiles = await loadUserProfiles();
      return profiles.find((p: UserProfile) => p.id === userId) || null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }, [loadUserProfiles]);

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

    const profiles = await loadUserProfiles();
    return profiles.filter((p: UserProfile) => friendIds.includes(p.id));
  }, [currentUserProfile, getMyFriendLinks, loadUserProfiles]);

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
