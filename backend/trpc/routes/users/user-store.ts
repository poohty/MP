export type UserProfileRecord = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  shareCookbookWithFriends: boolean;
  createdAt: string;
  updatedAt: string;
};

class UserProfileStore {
  private static instance: UserProfileStore;
  private profiles: Map<string, UserProfileRecord>;
  private initialized: boolean = false;

  private constructor() {
    this.profiles = new Map();
    console.log('🏗️ USER STORE: Singleton instance created');
  }

  public static getInstance(): UserProfileStore {
    if (!UserProfileStore.instance) {
      UserProfileStore.instance = new UserProfileStore();
    }
    return UserProfileStore.instance;
  }

  public async initialize(): Promise<void> {
    if (!this.initialized) {
      console.log('🚀 USER STORE: Initializing store');
      this.initialized = true;
    }
  }

  public async loadAllProfiles(): Promise<UserProfileRecord[]> {
    await this.initialize();
    const profiles = Array.from(this.profiles.values());
    console.log('📋 USER STORE: Loading all profiles', {
      count: profiles.length,
      usernames: profiles.map(p => p.username)
    });
    return profiles;
  }

  public async upsertProfile(record: UserProfileRecord): Promise<UserProfileRecord> {
    await this.initialize();
    this.profiles.set(record.id, record);
    
    console.log("📝 USER STORE: Upserted profile", {
      id: record.id,
      username: record.username,
      totalUsers: this.profiles.size,
      allUsernames: Array.from(this.profiles.values()).map(u => u.username),
      allIds: Array.from(this.profiles.keys())
    });
    
    return record;
  }

  public async findById(id: string): Promise<UserProfileRecord | null> {
    await this.initialize();
    const profile = this.profiles.get(id) ?? null;
    console.log('🔍 USER STORE: Finding by ID', {
      id,
      found: !!profile,
      allIds: Array.from(this.profiles.keys())
    });
    return profile;
  }

  public async searchByUsername(query: string, excludeUserId?: string): Promise<UserProfileRecord[]> {
    await this.initialize();
    const all = Array.from(this.profiles.values());
    const normalized = query.trim().toLowerCase();

    console.log("🔍 USER STORE: Searching", {
      query,
      normalized,
      excludeUserId,
      totalUsers: all.length,
      allUsernames: all.map(u => u.username),
      allIds: all.map(u => u.id)
    });

    const results = all
      .filter((u) => u.id !== excludeUserId)
      .filter((u) => u.username.toLowerCase().includes(normalized));

    console.log("🔍 USER STORE: Search results", {
      count: results.length,
      usernames: results.map(r => r.username),
      ids: results.map(r => r.id)
    });

    return results;
  }
}

const store = UserProfileStore.getInstance();

export async function loadAllUserProfiles(): Promise<UserProfileRecord[]> {
  return store.loadAllProfiles();
}

export async function upsertUserProfile(record: UserProfileRecord): Promise<UserProfileRecord> {
  return store.upsertProfile(record);
}

export async function findUserById(id: string): Promise<UserProfileRecord | null> {
  return store.findById(id);
}

export async function searchUsersByUsername(query: string, excludeUserId?: string): Promise<UserProfileRecord[]> {
  return store.searchByUsername(query, excludeUserId);
}
