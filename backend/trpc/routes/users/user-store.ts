export type UserProfileRecord = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  shareCookbookWithFriends: boolean;
  createdAt: string;
  updatedAt: string;
};

const userProfilesStore = new Map<string, UserProfileRecord>();

export async function loadAllUserProfiles(): Promise<UserProfileRecord[]> {
  return Array.from(userProfilesStore.values());
}

export async function upsertUserProfile(record: UserProfileRecord): Promise<UserProfileRecord> {
  userProfilesStore.set(record.id, record);
  
  console.log("📝 USER STORE: Upserted profile", {
    id: record.id,
    username: record.username,
    totalUsers: userProfilesStore.size,
    allUsernames: Array.from(userProfilesStore.values()).map(u => u.username)
  });
  
  return record;
}

export async function findUserById(id: string): Promise<UserProfileRecord | null> {
  return userProfilesStore.get(id) ?? null;
}

export async function searchUsersByUsername(query: string, excludeUserId?: string): Promise<UserProfileRecord[]> {
  const all = Array.from(userProfilesStore.values());
  const normalized = query.trim().toLowerCase();

  console.log("🔍 USER STORE: Searching", {
    query,
    normalized,
    excludeUserId,
    totalUsers: all.length,
    allUsernames: all.map(u => u.username)
  });

  const results = all
    .filter((u) => u.id !== excludeUserId)
    .filter((u) => u.username.toLowerCase().includes(normalized));

  console.log("🔍 USER STORE: Search results", {
    count: results.length,
    usernames: results.map(r => r.username)
  });

  return results;
}
