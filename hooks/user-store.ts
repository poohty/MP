import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback } from 'react';
import { UserProfile, FriendLink } from '@/types';
import { useAuth } from './auth-store';
import { supabase } from '@/lib/supabase';

const [UserContext, useUser] = createContextHook(() => {
  const { user: authUser, updateProfile: updateAuthProfile } = useAuth();
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [friendLinks, setFriendLinks] = useState<FriendLink[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserProfileFromSupabase = useCallback(async (authId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

      if (error) {
        if (error.message?.includes('<!DOCTYPE html>') || error.message?.includes('Cloudflare')) {
          console.error('⚠️ Supabase unavailable (server error). Operating in offline mode.');
        } else {
          console.error('Supabase load current user profile error:', JSON.stringify(error, null, 2));
        }
        return null;
      }

      if (!data) return null;

      return {
        id: data.auth_id,
        email: data.email,
        username: data.username,
        displayName: data.display_name,
        shareCookbookWithFriends: data.share_cookbook_with_friends,
      };
    } catch {
      console.error('⚠️ Network error loading user profile. Operating in offline mode.');
      return null;
    }
  }, []);



  const loadFriendLinks = useCallback(async (authId?: string) => {
    const currentAuthId = authId || currentUserProfile?.id;
    if (!currentAuthId) {
      setFriendLinks([]);
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('friend_links')
        .select('*')
        .or(`requester_auth_id.eq.${currentAuthId},recipient_auth_id.eq.${currentAuthId}`);

      if (error) {
        if (error.message?.includes('<!DOCTYPE html>') || error.message?.includes('Cloudflare')) {
          console.warn('⚠️ Supabase unavailable. Friend features disabled.');
        } else {
          console.error('Supabase load friend links error:', JSON.stringify(error, null, 2));
        }
        return [];
      }

      const links: FriendLink[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.requester_auth_id,
        friendUserId: row.recipient_auth_id,
        status: row.status,
        requestedAt: new Date(row.created_at).getTime(),
      }));

      setFriendLinks(links);
      return links;
    } catch {
      console.warn('⚠️ Network error. Friend features unavailable.');
      return [];
    }
  }, [currentUserProfile]);



  const loadCurrentUser = useCallback(async () => {
    if (!authUser) {
      setCurrentUserProfile(null);
      setFriendLinks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_id', authUser.id)
        .maybeSingle();

      if (error && error.code === 'PGRST116') {
        console.warn('⚠️ Supabase profile missing for new user. Creating fallback profile.');
      } else if (error) {
        if (error.message?.includes('<!DOCTYPE html>') || error.message?.includes('Cloudflare')) {
          console.warn('⚠️ Supabase unavailable. Using local profile data.');
        } else {
          console.error('❌ Supabase error:', error.message || error.code);
        }

        const fallbackProfile: UserProfile = {
          id: authUser.id,
          email: authUser.email,
          username: authUser.username || authUser.email.split('@')[0],
          displayName: authUser.name,
          shareCookbookWithFriends: authUser.shareCookbookWithFriends || false,
        };
        setCurrentUserProfile(fallbackProfile);
        setFriendLinks([]);
        return;
      }

      if (!data) {
        const fallbackEmail = authUser.email;
        const fallbackUsername = (authUser.username || fallbackEmail.split('@')[0]).toLowerCase();
        const fallbackDisplayName = authUser.name || authUser.username || fallbackEmail;
        const fallbackShareCookbook = !!authUser.shareCookbookWithFriends;

        const fallbackProfileRow = {
          auth_id: authUser.id,
          email: fallbackEmail,
          username: fallbackUsername,
          display_name: fallbackDisplayName,
          share_cookbook_with_friends: fallbackShareCookbook,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('user_profiles')
          .upsert(fallbackProfileRow, { onConflict: 'auth_id' });

        if (upsertError) {
          console.error('❌ Supabase upsert fallback profile error:', upsertError.message || upsertError.code);
        }

        const fallbackProfile: UserProfile = {
          id: authUser.id,
          email: fallbackEmail,
          username: fallbackUsername,
          displayName: fallbackDisplayName,
          shareCookbookWithFriends: fallbackShareCookbook,
        };

        setCurrentUserProfile(fallbackProfile);
        setFriendLinks([]);
        return;
      }

      const profile: UserProfile = {
        id: data.auth_id,
        email: data.email,
        username: data.username,
        displayName: data.display_name,
        shareCookbookWithFriends: data.share_cookbook_with_friends,
      };
      setCurrentUserProfile(profile);
      await loadFriendLinks(data.id);
    } catch {
      console.warn('⚠️ Network error. Using local profile data.');
      const fallbackProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email,
        username: authUser.username || authUser.email.split('@')[0],
        displayName: authUser.name,
        shareCookbookWithFriends: authUser.shareCookbookWithFriends || false,
      };
      setCurrentUserProfile(fallbackProfile);
      setFriendLinks([]);
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
      console.error('Failed to update share cookbook setting:', error instanceof Error ? error.message : JSON.stringify(error));
      return false;
    }
  }, [currentUserProfile, authUser, updateAuthProfile]);

  const searchUsersByUsername = useCallback(async (query: string) => {
    const normalized = query.trim().toLowerCase();

    console.log('🔍 USER SEARCH query:', query, 'normalized:', normalized);

    if (!normalized || normalized.length < 2) {
      setSearchResults([]);
      return;
    }

    if (!currentUserProfile?.id) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', `%${normalized}%`);

      if (error) {
        if (error.message?.includes('<!DOCTYPE html>') || error.message?.includes('Cloudflare')) {
          console.warn('⚠️ Supabase unavailable. User search disabled.');
        } else {
          console.error('❌ Search error:', error.message || error.code);
        }
        setSearchResults([]);
        return;
      }

      const results: UserProfile[] = (data || [])
        .filter((row: any) => row.auth_id !== currentUserProfile.id)
        .map((row: any) => ({
          id: row.auth_id,
          email: '',
          username: row.username,
          displayName: row.display_name,
          shareCookbookWithFriends: row.share_cookbook_with_friends,
        }));

      console.log('🔍 USER SEARCH results count:', results.length);

      setSearchResults(results);
    } catch (e) {
      console.error('❌ searchUsersByUsername unexpected error:', e instanceof Error ? e.message : JSON.stringify(e));
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

      const { data, error } = await supabase
        .from('friend_links')
        .insert({
          requester_auth_id: currentUserProfile.id,
          recipient_auth_id: targetUserId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Friend request error:', error.message || error.code || 'Unknown error');
        return false;
      }

      const newLink: FriendLink = {
        id: data.id,
        userId: data.requester_auth_id,
        friendUserId: data.recipient_auth_id,
        status: data.status,
        requestedAt: new Date(data.created_at).getTime(),
      };

      setFriendLinks([...links, newLink]);
      console.log('✅ Friend request sent successfully');
      return true;
    } catch (error) {
      console.error('Failed to send friend request:', error instanceof Error ? error.message : JSON.stringify(error));
      return false;
    }
  }, [currentUserProfile, loadFriendLinks]);

  const acceptFriendRequest = useCallback(async (friendLinkId: string) => {
    try {
      const { error } = await supabase
        .from('friend_links')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendLinkId);

      if (error) {
        console.error('❌ Accept request error:', error.message || error.code || 'Unknown error');
        return false;
      }

      await loadFriendLinks();
      console.log('✅ Friend request accepted successfully');
      return true;
    } catch (error) {
      console.error('Failed to accept friend request:', error instanceof Error ? error.message : JSON.stringify(error));
      return false;
    }
  }, [loadFriendLinks]);

  const rejectFriendRequest = useCallback(async (friendLinkId: string) => {
    try {
      const { error } = await supabase
        .from('friend_links')
        .delete()
        .eq('id', friendLinkId);

      if (error) {
        console.error('❌ Reject request error:', error.message || error.code || 'Unknown error');
        return false;
      }

      await loadFriendLinks();
      console.log('✅ Friend request rejected successfully');
      return true;
    } catch (error) {
      console.error('Failed to reject friend request:', error instanceof Error ? error.message : JSON.stringify(error));
      return false;
    }
  }, [loadFriendLinks]);

  const removeFriend = useCallback(async (friendUserId: string) => {
    if (!currentUserProfile) return false;

    try {
      const { error } = await supabase
        .from('friend_links')
        .delete()
        .or(`and(requester_auth_id.eq.${currentUserProfile.id},recipient_auth_id.eq.${friendUserId}),and(requester_auth_id.eq.${friendUserId},recipient_auth_id.eq.${currentUserProfile.id})`);

      if (error) {
        console.error('❌ Remove friend error:', error.message || error.code || 'Unknown error');
        return false;
      }

      await loadFriendLinks();
      console.log('✅ Friend removed successfully');
      return true;
    } catch (error) {
      console.error('Failed to remove friend:', error instanceof Error ? error.message : JSON.stringify(error));
      return false;
    }
  }, [currentUserProfile, loadFriendLinks]);

  const getUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    return await loadUserProfileFromSupabase(userId);
  }, [loadUserProfileFromSupabase]);

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
      friendIds.map(async (id) => await loadUserProfileFromSupabase(id))
    );
    
    return profiles.filter((p): p is UserProfile => p !== null);
  }, [currentUserProfile, getMyFriendLinks, loadUserProfileFromSupabase]);

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
