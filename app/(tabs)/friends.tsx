import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@/hooks/user-store';
import { useAuth } from '@/hooks/auth-store';
import { supabase } from '@/lib/supabase';
import { UserProfile, FriendLink } from '@/types';
import Colors from '@/constants/colors';
import GradientBackground from '@/components/GradientBackground';

import { Search, UserPlus, Check, X, RefreshCw, Bug } from 'lucide-react-native';

export default function FriendsScreen() {
  const { user, isEmailVerified, resendVerification } = useAuth();
  const { 
    searchUsersByUsername,
    searchResults,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getIncomingRequests,
    getFriendProfiles,
    getUserProfile,
    isFriend,
    hasPendingRequest,
  } = useUser();

  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<{link: FriendLink; profile: UserProfile}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadFriendsAndRequests = useCallback(async () => {
    try {
      const friendProfiles = await getFriendProfiles();
      setFriends(friendProfiles);

      const requests = getIncomingRequests();
      const requestsWithProfiles = await Promise.all(
        requests.map(async (link) => {
          const profile = await getUserProfile(link.userId);
          return { link, profile: profile! };
        })
      );
      setIncomingRequests(requestsWithProfiles.filter((r) => r.profile));
    } catch (error) {
      console.error('Failed to load friends and requests:', error);
    }
  }, [getFriendProfiles, getIncomingRequests, getUserProfile]);

  useEffect(() => {
    loadFriendsAndRequests();
  }, [loadFriendsAndRequests]);

  const handleSearch = async () => {
    if (!isEmailVerified) {
      Alert.alert('Verify your email', 'Verify your email to search and add friends.', [{ text: 'OK' }]);
      return;
    }
    if (!searchQuery.trim()) {
      Alert.alert('Search', 'Please enter a username to search');
      return;
    }

    setIsSearching(true);
    try {
      await searchUsersByUsername(searchQuery.trim());
    } catch {
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!isEmailVerified) {
      Alert.alert('Verify your email', 'Verify your email to search and add friends.', [{ text: 'OK' }]);
      return;
    }
    try {
      const success = await sendFriendRequest(targetUserId);
      if (success) {
        Alert.alert('Success', 'Friend request sent');
        await searchUsersByUsername(searchQuery.trim());
      } else {
        Alert.alert('Info', 'Friend request already exists or cannot be sent');
      }
    } catch {
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (linkId: string) => {
    try {
      const success = await acceptFriendRequest(linkId);
      if (success) {
        Alert.alert('Success', 'Friend request accepted');
        await loadFriendsAndRequests();
      } else {
        Alert.alert('Error', 'Failed to accept friend request');
      }
    } catch {
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (linkId: string) => {
    try {
      const success = await rejectFriendRequest(linkId);
      if (success) {
        Alert.alert('Success', 'Friend request rejected');
        await loadFriendsAndRequests();
      } else {
        Alert.alert('Error', 'Failed to reject friend request');
      }
    } catch {
      Alert.alert('Error', 'Failed to reject friend request');
    }
  };

  const handleViewFriendCookbook = (friendUserId: string) => {
    router.push({
      pathname: '../friend-cookbook' as any,
      params: { friendUserId },
    });
  };

  const debugBackendUsers = async () => {
    try {
      console.log('🐛 ======== DEBUG: Fetching all users from Supabase ========');
      
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      console.log('🐛 Supabase URL:', supabaseUrl);
      console.log('🐛 Supabase Key exists:', !!supabaseKey);
      
      if (!supabaseUrl || !supabaseKey) {
        Alert.alert(
          '⚠️ Environment Variables Missing',
          `Supabase URL: ${supabaseUrl ? '✅ SET' : '❌ NOT SET'}\nSupabase Key: ${supabaseKey ? '✅ SET' : '❌ NOT SET'}\n\nPlease configure environment variables in Rork settings.`
        );
        return;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('🐛 DEBUG Supabase getAllUsers error:', error);
        console.error('🐛 Full error:', JSON.stringify(error, null, 2));
        Alert.alert(
          'Debug Error', 
          `Failed to fetch Supabase users:\n\nError: ${error.message || error.code || 'Unknown'}\n\nDetails: ${error.details || 'None'}\n\nHint: ${error.hint || 'Check table exists and RLS policies'}`
        );
        return;
      }

      const users = data || [];
      const total = users.length;
      const list = users
        .map((u: any) => {
          const shareIcon = u.share_cookbook_with_friends ? '📖' : '🔒';
          return `${shareIcon} ${u.display_name}\n   @${u.username}\n   ${u.email}`;
        })
        .join('\n\n');

      Alert.alert(
        '🔍 Supabase User Directory',
        `Supabase URL: ${supabaseUrl.substring(0, 30)}...\n\nTotal Users: ${total}\n\n${
          list || 'No users found - ask your wife to check console logs on her device after signing up'
        }`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.error('🐛 DEBUG unexpected error:', e);
      Alert.alert('Debug Error', `Unexpected error: ${String(e)}`);
    }
  };

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.searchSection}>
          {!isEmailVerified ? (
            <View style={styles.verifyGate} testID="friendsVerifyGate">
              <Text style={styles.verifyGateTitle}>Verify your email</Text>
              <Text style={styles.verifyGateBody}>Verify your email to search and add friends.</Text>
              <TouchableOpacity
                style={styles.verifyGateButton}
                onPress={async () => {
                  const email = user?.email ?? '';
                  const result = await resendVerification(email);
                  if (!result.ok) {
                    Alert.alert('Could not resend', result.error || 'Please try again.', [{ text: 'OK' }]);
                    return;
                  }
                  Alert.alert('Sent', 'Check your email for a verification link.', [{ text: 'OK' }]);
                }}
                testID="friendsResendVerificationButton"
              >
                <Text style={styles.verifyGateButtonText}>Resend verification email</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Find Friends</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={debugBackendUsers}
              >
                <Bug size={18} color={Colors.warning} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={loadFriendsAndRequests}
              >
                <RefreshCw size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, !isEmailVerified ? { opacity: 0.6 } : null]}
              placeholder="Search by username..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              editable={isEmailVerified}
              testID="friendsSearchInput"
            />
            <TouchableOpacity 
              style={[styles.searchButton, !isEmailVerified ? { opacity: 0.6 } : null]} 
              onPress={handleSearch}
              disabled={isSearching || !isEmailVerified}
              testID="friendsSearchButton"
            >
              <Search size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {searchQuery.trim().length > 0 && (
            <View style={styles.resultsContainer}>
              {isSearching ? (
                <Text style={styles.searchingText}>Searching...</Text>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <View key={user.id} style={styles.userItem}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {user.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.displayName}</Text>
                      <Text style={styles.userUsername}>@{user.username}</Text>
                    </View>
                    {isFriend(user.id) ? (
                      <View style={styles.friendBadge}>
                        <Text style={styles.friendBadgeText}>Friend</Text>
                      </View>
                    ) : hasPendingRequest(user.id) ? (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.addButton, !isEmailVerified ? { opacity: 0.5 } : null]}
                        onPress={() => handleSendFriendRequest(user.id)}
                        disabled={!isEmailVerified}
                        testID={`addFriendButton-${user.id}`}
                      >
                        <UserPlus size={18} color={Colors.text} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noResultsText}>
                  No users found matching &quot;{searchQuery}&quot;
                </Text>
              )}
            </View>
          )}
        </View>

        {incomingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Incoming Requests</Text>
            {incomingRequests.map(({ link, profile }) => (
              <View key={link.id} style={styles.requestItem}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {profile.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{profile.displayName}</Text>
                  <Text style={styles.userUsername}>@{profile.username}</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(link.id)}
                  >
                    <Check size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleRejectRequest(link.id)}
                  >
                    <X size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Friends ({friends.length})</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyText}>
              You haven&apos;t added any friends yet. Search above to find friends!
            </Text>
          ) : (
            friends.map((friend) => (
              <TouchableOpacity
                key={friend.id}
                style={styles.friendItem}
                onPress={() => handleViewFriendCookbook(friend.id)}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {friend.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{friend.displayName}</Text>
                  <Text style={styles.userUsername}>@{friend.username}</Text>
                  {friend.shareCookbookWithFriends && (
                    <Text style={styles.shareStatus}>📖 Shares cookbook</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
  },
  searchSection: {
    marginBottom: 24,
  },
  verifyGate: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  verifyGateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  verifyGateBody: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  verifyGateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyGateButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 16,
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    marginTop: 12,
    gap: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  shareStatus: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.success,
    borderRadius: 12,
  },
  friendBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.warning,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    backgroundColor: Colors.success,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    backgroundColor: Colors.error,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: 24,
  },
  searchingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: 16,
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    padding: 16,
  },
});
