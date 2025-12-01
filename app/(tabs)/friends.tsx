import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/hooks/user-store';
import { UserProfile, FriendLink } from '@/types';
import Colors from '@/constants/colors';
import GradientBackground from '@/components/GradientBackground';

import { Search, UserPlus, Check, X, RefreshCw, Bug } from 'lucide-react-native';

export default function FriendsScreen() {
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

  const debugGlobalUsers = async () => {
    try {
      const globalUsersJson = await AsyncStorage.getItem('meal-planner-global-users');
      if (!globalUsersJson) {
        Alert.alert('Debug', 'No global users found in storage');
        return;
      }
      const users = JSON.parse(globalUsersJson);
      const userList = users.map((u: any) => `${u.name} (@${u.username || 'no-username'})`).join('\n');
      Alert.alert(
        'Debug: Global Users',
        `Total: ${users.length}\n\n${userList}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Debug Error', String(error));
    }
  };

  return (
    <GradientBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.searchSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Find Friends</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={debugGlobalUsers}
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
              style={styles.searchInput}
              placeholder="Search by username..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity 
              style={styles.searchButton} 
              onPress={handleSearch}
              disabled={isSearching}
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
                        style={styles.addButton}
                        onPress={() => handleSendFriendRequest(user.id)}
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
