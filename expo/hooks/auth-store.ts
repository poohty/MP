import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { User } from '@/types';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import type { VoicePreference } from '@/constants/voice';


const USER_STORAGE_KEY = 'meal-planner-user';

type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'BAD_CREDENTIALS' | 'EMAIL_NOT_VERIFIED' | 'LOGIN_FAILED' };

type SignupResult =
  | { ok: true; reason?: 'VERIFY_EMAIL_REQUIRED' }
  | { ok: false; reason: 'SIGNUP_FAILED' | 'USERNAME_TAKEN' };

// Supabase redirect URLs (must be allow-listed in Supabase Dashboard > Authentication > URL Configuration):
//   Signup verification: myapp://auth-callback
//   Password reset:      myapp://reset-password
const EMAIL_REDIRECT_URL = 'myapp://auth-callback';

function getEmailRedirectTo(): string {
  console.log('🔗 Email redirect URL:', EMAIL_REDIRECT_URL);
  return EMAIL_REDIRECT_URL;
}

async function generateUniqueUsername(baseUsername: string, userId: string): Promise<string> {
  if (!isSupabaseEnabled) return baseUsername;

  try {
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', baseUsername)
      .maybeSingle();

    if (!existing || existing.id === userId) {
      return baseUsername;
    }

    const shortId = userId.replace(/-/g, '').substring(0, 6);
    const candidate = `${baseUsername}_${shortId}`;
    console.log('⚠️ Username taken, using fallback:', candidate);
    return candidate;
  } catch {
    return baseUsername;
  }
}

const result = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isUpsertingRef = useRef(false);
  const lastUpsertIdRef = useRef<string | null>(null);

  const upsertUserProfileToSupabase = useCallback(async (userToStore: User) => {
    if (!isSupabaseEnabled) {
      return;
    }

    if (!userToStore?.id || !userToStore?.email) {
      console.warn('⚠️ Cannot upsert user without id or email');
      return;
    }

    if (isUpsertingRef.current && lastUpsertIdRef.current === userToStore.id) {
      console.log('⏳ Skipping duplicate upsert for user:', userToStore.id);
      return;
    }

    isUpsertingRef.current = true;
    lastUpsertIdRef.current = userToStore.id;

    try {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('id', userToStore.id)
        .maybeSingle();

      let username: string;
      if (existingProfile) {
        username = existingProfile.username;
        console.log('📤 Profile exists, updating (keeping username):', { id: userToStore.id, username });
      } else {
        const baseUsername = (userToStore.username || userToStore.email.split('@')[0] || '').toLowerCase();
        username = await generateUniqueUsername(baseUsername, userToStore.id);
        console.log('📤 Creating new profile:', { id: userToStore.id, username });
      }

      const displayName = userToStore.name || userToStore.username || userToStore.email;

      const upsertData: Record<string, unknown> = {
        id: userToStore.id,
        email: userToStore.email,
        username,
        display_name: displayName,
        share_cookbook_with_friends: !!userToStore.shareCookbookWithFriends,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .upsert(upsertData, { onConflict: 'id' });

      if (error) {
        if (error.message?.includes('user_profiles_username_unique_idx') || error.code === '23505') {
          console.warn('⚠️ Username conflict during upsert, retrying with unique suffix...');
          const fallbackUsername = `${username}_${userToStore.id.replace(/-/g, '').substring(0, 8)}`;
          upsertData.username = fallbackUsername;
          const { error: retryError } = await supabase
            .from('user_profiles')
            .upsert(upsertData, { onConflict: 'id' });
          if (retryError) {
            console.error('❌ Supabase upsert retry failed:', retryError.message || retryError.code);
          } else {
            console.log('✅ Supabase user_profiles upserted with fallback username:', fallbackUsername);
          }
        } else {
          console.error('❌ Supabase upsertUserProfile error:', error.message || error.code);
        }
      } else {
        console.log('✅ Supabase user_profiles upserted:', { id: userToStore.id, username });
      }

      const voiceId = userToStore.ttsVoiceId || 'Cz0K1kOv9tD8l0b5Qu53';
      const voicePref = userToStore.voicePreference || 'female';
      const { error: voiceError } = await supabase
        .from('user_profiles')
        .update({ tts_voice_id: voiceId, voice_preference: voicePref })
        .eq('id', userToStore.id);

      if (voiceError) {
        if (voiceError.code === 'PGRST204' || voiceError.message?.includes('tts_voice_id') || voiceError.message?.includes('voice_preference')) {
          console.warn('⚠️ voice columns not found in user_profiles. Ensure migrations are applied.');
        } else {
          console.error('❌ Failed to update voice settings:', voiceError.message || voiceError.code);
        }
      }
    } catch (error) {
      console.error('❌ Failed to upsert user to Supabase:', error);
    } finally {
      isUpsertingRef.current = false;
    }
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      console.log('Loading user from storage:', storedUser ? 'found' : 'none');
      if (storedUser) {
        let parsedUser: User;
        try {
          parsedUser = JSON.parse(storedUser) as User;
        } catch (parseError) {
          console.error('❌ Failed to parse user data, clearing corrupted data:', parseError);
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          return;
        }

        if (isSupabaseEnabled) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const session = sessionData?.session;

            if (session?.user) {
              const confirmedAt = session.user.email_confirmed_at ?? null;
              console.log('🔐 Hydration: session found, email_confirmed_at:', confirmedAt);

              if (!confirmedAt) {
                console.warn('🔐 Hydration: email NOT verified, clearing stored user');
                await supabase.auth.signOut();
                await AsyncStorage.removeItem(USER_STORAGE_KEY);
                setUser(null);
                return;
              }

              setUser(parsedUser);
              await upsertUserProfileToSupabase(parsedUser);
            } else {
              console.log('🔐 Hydration: no active Supabase session, using stored user (offline/session expired)');
              setUser(parsedUser);
            }
          } catch (sessionError) {
            console.warn('⚠️ Could not check session during hydration, using stored user:', sessionError);
            setUser(parsedUser);
          }
        } else {
          setUser(parsedUser);
        }
      } else {
        console.log('No user found in storage');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  }, [upsertUserProfileToSupabase]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 onAuthStateChange:', event, session?.user?.id ?? 'no-user');

      if (event === 'SIGNED_OUT') {
        console.log('🔐 Session signed out externally, clearing local user');
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        lastUpsertIdRef.current = null;
      }

      if (event === 'TOKEN_REFRESHED' && session?.user) {
        const confirmedAt = session.user.email_confirmed_at ?? null;
        if (!confirmedAt) {
          console.warn('🔐 Token refreshed but email still not verified, signing out');
          await supabase.auth.signOut();
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      if (!isSupabaseEnabled) {
        try {
          const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '');

          const username = email.split('@')[0].toLowerCase();
          const newUser: User = {
            id: userId,
            email,
            name: email.split('@')[0],
            username,
            shareCookbookWithFriends: false,
          };

          console.log('Logging in user (offline mode):', newUser);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
          setUser(newUser);

          return { ok: true };
        } catch (error) {
          console.error('Login failed (offline mode):', error);
          return { ok: false, reason: 'LOGIN_FAILED' };
        }
      }

      try {
        console.log('🔐 Supabase login attempt:', { email });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data.user) {
          console.warn('🔐 Supabase login failed:', error?.message || 'Unknown error');
          return { ok: false, reason: 'BAD_CREDENTIALS' };
        }

        const confirmedAt = (data.user.email_confirmed_at ?? null) as string | null;
        console.log('🔐 Supabase login user:', {
          id: data.user.id,
          email: data.user.email,
          email_confirmed_at: confirmedAt,
        });

        if (!confirmedAt) {
          console.warn('🔐 Email not verified. Signing out.');
          await supabase.auth.signOut();
          return { ok: false, reason: 'EMAIL_NOT_VERIFIED' };
        }

        const safeEmail = data.user.email ?? email;
        const baseUsername = safeEmail.split('@')[0].toLowerCase();
        const metadataName = data.user.user_metadata?.name as string | undefined;
        const metadataUsername = data.user.user_metadata?.username as string | undefined;

        let profileDisplayName: string | null = null;
        let profileUsername: string | null = null;
        let savedShareCookbook = false;
        let savedTtsVoiceId: string | null = null;
        let savedVoicePreference: VoicePreference = 'female';
        try {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('display_name, username, share_cookbook_with_friends, tts_voice_id, voice_preference')
            .eq('id', data.user.id)
            .maybeSingle();
          if (profileData) {
            profileDisplayName = profileData.display_name || null;
            profileUsername = profileData.username || null;
            if (profileData.share_cookbook_with_friends != null) {
              savedShareCookbook = !!profileData.share_cookbook_with_friends;
            }
            if (profileData.tts_voice_id) {
              savedTtsVoiceId = profileData.tts_voice_id;
            }
            if (profileData.voice_preference === 'male' || profileData.voice_preference === 'female') {
              savedVoicePreference = profileData.voice_preference;
            }
          }
          console.log('🔐 Fetched profile from Supabase:', { profileDisplayName, profileUsername, savedShareCookbook, savedVoicePreference });
        } catch {
          console.warn('⚠️ Could not fetch profile during login, using defaults');
        }

        const resolvedName = profileDisplayName || metadataName || safeEmail.split('@')[0];
        const resolvedUsername = profileUsername || metadataUsername || await generateUniqueUsername(baseUsername, data.user.id);

        const newUser: User = {
          id: data.user.id,
          email: safeEmail,
          name: resolvedName,
          username: resolvedUsername,
          shareCookbookWithFriends: savedShareCookbook,
          ttsVoiceId: savedTtsVoiceId,
          voicePreference: savedVoicePreference,
        };

        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);

        await upsertUserProfileToSupabase(newUser);

        return { ok: true };
      } catch (error) {
        console.error('Login failed:', error);
        return { ok: false, reason: 'LOGIN_FAILED' };
      }
    },
    [upsertUserProfileToSupabase]
  );

  const signup = useCallback(
    async (name: string, username: string, email: string, password: string, locationPermission?: boolean): Promise<SignupResult> => {
      const normalizedUsername = username.trim().toLowerCase();

      if (!isSupabaseEnabled) {
        try {
          const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '');
          const newUser: User = {
            id: userId,
            email,
            name,
            username: normalizedUsername,
            locationPermission,
            shareCookbookWithFriends: false,
          };

          console.log('Signing up user (offline mode):', newUser);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
          setUser(newUser);

          return { ok: true };
        } catch (error) {
          console.error('Signup failed (offline mode):', error);
          return { ok: false, reason: 'SIGNUP_FAILED' };
        }
      }

      try {
        const { data: existingUsername } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', normalizedUsername)
          .maybeSingle();

        if (existingUsername) {
          console.warn('🧾 Username already taken:', normalizedUsername);
          return { ok: false, reason: 'USERNAME_TAKEN' };
        }

        const emailRedirectTo = getEmailRedirectTo();
        console.log('🧾 Supabase signUp attempt:', { email, username: normalizedUsername, emailRedirectTo });
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: {
              name,
              username: normalizedUsername,
              locationPermission: !!locationPermission,
            },
          },
        });

        if (error) {
          console.error('🧾 Supabase signUp error:', error);
          return { ok: false, reason: 'SIGNUP_FAILED' };
        }

        const supaUser = data.user;
        const session = data.session;

        console.log('🧾 Supabase signUp result:', {
          userId: supaUser?.id,
          hasSession: !!session,
          email_confirmed_at: supaUser?.email_confirmed_at,
        });

        if (supaUser && !session) {
          console.log('🧾 Email verification required. NOT storing user locally yet.');
          return { ok: true, reason: 'VERIFY_EMAIL_REQUIRED' };
        }

        if (!supaUser || !session) {
          return { ok: false, reason: 'SIGNUP_FAILED' };
        }

        const confirmedAt = supaUser.email_confirmed_at ?? null;
        if (!confirmedAt) {
          console.log('🧾 User created with session but email not confirmed. Signing out.');
          await supabase.auth.signOut();
          return { ok: true, reason: 'VERIFY_EMAIL_REQUIRED' };
        }

        const newUser: User = {
          id: supaUser.id,
          email: supaUser.email ?? email,
          name,
          username: normalizedUsername,
          locationPermission,
          shareCookbookWithFriends: false,
        };

        console.log('Signing up user (session present, verified):', newUser);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);

        await upsertUserProfileToSupabase(newUser);

        return { ok: true };
      } catch (error) {
        console.error('Signup failed:', error);
        return { ok: false, reason: 'SIGNUP_FAILED' };
      }
    },
    [upsertUserProfileToSupabase]
  );

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    try {
      if (!user) return;

      const updatedUser: User = {
        ...user,
        ...updates,
      };

      console.log('Updating user profile:', updatedUser);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      await upsertUserProfileToSupabase(updatedUser);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }, [user, upsertUserProfileToSupabase]);

  const logout = useCallback(async () => {
    try {
      if (isSupabaseEnabled) {
        await supabase.auth.signOut();
      }
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
      lastUpsertIdRef.current = null;
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  return useMemo(() => ({
    user,
    isLoading,
    login,
    signup,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  }), [user, isLoading, login, signup, logout, updateProfile]);
});

const AuthContext = result[0];
const useAuth = result[1];

export { AuthContext, useAuth };
