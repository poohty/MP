import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { User } from '@/types';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import type { VoicePreference } from '@/constants/voice';
import * as WebBrowser from 'expo-web-browser';


const USER_STORAGE_KEY = 'meal-planner-user';

type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'BAD_CREDENTIALS' | 'EMAIL_NOT_VERIFIED' | 'LOGIN_FAILED' };

type SignupResult =
  | { ok: true; reason?: 'VERIFY_EMAIL_REQUIRED' }
  | { ok: false; reason: 'SIGNUP_FAILED' | 'USERNAME_TAKEN' };

// Supabase redirect URLs (must be allow-listed in Supabase Dashboard > Authentication > URL Configuration):
//   Signup verification: mealplannerroulette://auth-callback
//   Password reset:      mealplannerroulette://reset-password
const EMAIL_REDIRECT_URL = 'mealplannerroulette://auth-callback';

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

      const displayName = userToStore.name || userToStore.username || userToStore.email.split('@')[0];

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

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        const supaUser = session.user;
        const googleName = (supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || '').trim();
        const userEmail = (supaUser.email || `user_${supaUser.id.substring(0, 8)}@auth.com`).trim();
        const baseName = googleName || (userEmail.includes('@') ? userEmail.split('@')[0] : 'User');
        const cleanName = baseName.trim() || 'User';
        const cleanUsername = (cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'user') + '_' + supaUser.id.substring(0, 4);

        const newUser: User = {
          id: supaUser.id,
          email: userEmail,
          name: cleanName,
          username: cleanUsername,
          shareCookbookWithFriends: false,
        };

        try {
          console.log('🔐 Session signed in, setting local user:', newUser.id);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
          setUser(newUser);
          await upsertUserProfileToSupabase(newUser);
        } catch (e) {
          console.warn('⚠️ Error saving user on SIGNED_IN:', e);
        }
      }

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
  }, [upsertUserProfileToSupabase]);

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
        const loginStart = Date.now();

        const authPromise = supabase.auth.signInWithPassword({ email, password });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LOGIN_TIMEOUT')), 15000)
        );

        let data;
        let error;
        try {
          const result = await Promise.race([authPromise, timeoutPromise]);
          data = result.data;
          error = result.error;
        } catch (raceError: unknown) {
          const msg = raceError instanceof Error ? raceError.message : '';
          if (msg === 'LOGIN_TIMEOUT') {
            console.warn('🔐 Login timed out after 15s');
            return { ok: false, reason: 'LOGIN_FAILED' };
          }
          throw raceError;
        }

        console.log('🔐 Auth response in', Date.now() - loginStart, 'ms');

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

        const quickUser: User = {
          id: data.user.id,
          email: safeEmail,
          name: metadataName || safeEmail.split('@')[0],
          username: metadataUsername || baseUsername,
          shareCookbookWithFriends: false,
        };

        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(quickUser));
        setUser(quickUser);
        console.log('🔐 Login success (quick), total:', Date.now() - loginStart, 'ms');

        void (async () => {
          try {
            let profileDisplayName: string | null = null;
            let profileUsername: string | null = null;
            let savedShareCookbook = false;
            let savedTtsVoiceId: string | null = null;
            let savedVoicePreference: VoicePreference = 'female';
            try {
              const { data: profileData } = await supabase
                .from('user_profiles')
                .select('display_name, username, share_cookbook_with_friends, tts_voice_id, voice_preference')
                .eq('id', data.user!.id)
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
              console.log('🔐 Background profile fetch done:', { profileDisplayName, profileUsername, savedShareCookbook, savedVoicePreference });
            } catch {
              console.warn('⚠️ Background profile fetch failed, keeping defaults');
            }

            const resolvedName = profileDisplayName || metadataName || safeEmail.split('@')[0];
            const resolvedUsername = profileUsername || metadataUsername || await generateUniqueUsername(baseUsername, data.user!.id);

            const fullUser: User = {
              id: data.user!.id,
              email: safeEmail,
              name: resolvedName,
              username: resolvedUsername,
              shareCookbookWithFriends: savedShareCookbook,
              ttsVoiceId: savedTtsVoiceId,
              voicePreference: savedVoicePreference,
            };

            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fullUser));
            setUser(fullUser);
            console.log('🔐 Background profile merge complete');

            await upsertUserProfileToSupabase(fullUser);
          } catch (bgError) {
            console.warn('⚠️ Background profile sync failed:', bgError);
          }
        })();

        return { ok: true };
      } catch (error) {
        console.error('Login failed:', error);
        return { ok: false, reason: 'LOGIN_FAILED' };
      }
    },
    [upsertUserProfileToSupabase]
  );

  const signup = useCallback(
    async (username: string, email: string, password: string, locationPermission?: boolean): Promise<SignupResult> => {
      const normalizedUsername = username.trim().toLowerCase();

      if (!isSupabaseEnabled) {
        try {
          const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '');
          const newUser: User = {
            id: userId,
            email,
            name: normalizedUsername,
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
          name: normalizedUsername,
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

  const loginWithGoogle = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!isSupabaseEnabled) return { ok: false, reason: 'LOGIN_FAILED' };
    
    try {
      console.log('🔗 Initiating Google OAuth Login...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: EMAIL_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });
      
      if (error || !data?.url) {
        console.error('❌ Google Login failed:', error?.message);
        return { ok: false, reason: 'LOGIN_FAILED' };
      }
      
      const result = await WebBrowser.openAuthSessionAsync(data.url, EMAIL_REDIRECT_URL);
      console.log('🔗 WebBrowser result type:', result.type);

      if (result.type === 'success' && result.url) {
        let supaSession = null;

        const urlString = result.url;
        const hashIndex = urlString.indexOf('#');
        const queryIndex = urlString.indexOf('?');
        
        let paramsString = '';
        if (hashIndex !== -1) {
          paramsString = urlString.substring(hashIndex + 1);
        } else if (queryIndex !== -1) {
          paramsString = urlString.substring(queryIndex + 1);
        }

        if (paramsString) {
          const params = new URLSearchParams(paramsString);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const code = params.get('code');

          if (accessToken && refreshToken) {
            console.log('🔗 Setting session from OAuth access_token...');
            const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!sessionErr && sessionData?.session) {
              supaSession = sessionData.session;
            } else if (sessionErr) {
              console.error('❌ Error setting OAuth session:', sessionErr.message);
            }
          } else if (code) {
            console.log('🔗 Exchanging OAuth code for session...');
            const { data: exchangeData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (!exchangeErr && exchangeData?.session) {
              supaSession = exchangeData.session;
            } else if (exchangeErr) {
              console.error('❌ Error exchanging OAuth code:', exchangeErr.message);
            }
          }
        }

        if (!supaSession) {
          const { data: currentSessionData } = await supabase.auth.getSession();
          supaSession = currentSessionData?.session;
        }

        if (supaSession?.user) {
          const supaUser = supaSession.user;
          console.log('✅ Google OAuth session active, user ID:', supaUser.id);

          const googleName = (
            supaUser.user_metadata?.full_name ||
            supaUser.user_metadata?.name ||
            ''
          ).trim();
          const userEmail = (supaUser.email || `google_${supaUser.id.substring(0, 8)}@gmail.com`).trim();
          const baseName = googleName || (userEmail.includes('@') ? userEmail.split('@')[0] : 'User');
          const cleanName = baseName.trim() || 'User';
          const cleanUsername = (cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'user') + '_' + supaUser.id.substring(0, 4);

          const newUser: User = {
            id: supaUser.id,
            email: userEmail,
            name: cleanName,
            username: cleanUsername,
            shareCookbookWithFriends: false,
          };

          console.log('🔑 Saving Google authenticated user to state:', newUser.id);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
          setUser(newUser);

          await upsertUserProfileToSupabase(newUser);
          return { ok: true };
        }
      }
      
      return { ok: false, reason: 'LOGIN_FAILED' };
    } catch (error) {
      console.error('❌ Google Login error:', error);
      return { ok: false, reason: 'LOGIN_FAILED' };
    }
  }, [upsertUserProfileToSupabase]);

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

  const loginWithApple = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (Platform.OS !== 'ios') return { ok: false, reason: 'NOT_SUPPORTED' };
    try {
      console.log('🍎 Initiating Apple Sign-In...');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        if (isSupabaseEnabled) {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });

          if (error) {
            console.error('❌ Supabase Apple sign in error:', error.message);
            return { ok: false, reason: 'LOGIN_FAILED' };
          }

          const supaUser = data.user;
          if (supaUser) {
            const appleName = credential.fullName?.givenName
              ? `${credential.fullName.givenName} ${credential.fullName.familyName || ''}`.trim()
              : undefined;
            const userEmail = (credential.email || supaUser.email || `apple_${supaUser.id.substring(0, 8)}@privaterelay.appleid.com`).trim();
            const baseName = appleName || (userEmail.includes('@') ? userEmail.split('@')[0] : 'User');
            const cleanName = baseName.trim() || 'User';
            const cleanUsername = (cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'user') + '_' + supaUser.id.substring(0, 4);

            const newUser: User = {
              id: supaUser.id,
              email: userEmail,
              name: cleanName,
              username: cleanUsername,
              shareCookbookWithFriends: false,
            };

            try {
              await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
              setUser(newUser);
              await upsertUserProfileToSupabase(newUser);
            } catch (storageErr) {
              console.warn('⚠️ Non-critical user profile save error:', storageErr);
            }
            return { ok: true };
          }
        }
      }
      return { ok: false, reason: 'LOGIN_FAILED' };
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        console.log('🍎 Apple Sign-In cancelled by user');
        return { ok: false, reason: 'CANCELLED' };
      }
      console.error('❌ Apple sign in error:', e);
      return { ok: false, reason: 'LOGIN_FAILED' };
    }
  }, [upsertUserProfileToSupabase]);

  const deleteAccount = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    try {
      if (!user) return { ok: false, message: 'No authenticated user' };

      console.log('🗑️ Initiating account deletion for user:', user.id);

      if (isSupabaseEnabled) {
        // 1. Delete user profile & user data from Supabase
        const { error: profileErr } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', user.id);

        if (profileErr) {
          console.warn('⚠️ Delete user_profiles error:', profileErr.message);
        }

        await supabase.from('recipes').delete().eq('user_id', user.id);
        await supabase.from('meal_plans').delete().eq('user_id', user.id);

        // 2. Sign out from Supabase Auth
        await supabase.auth.signOut();
      }

      // 3. Clear local storage & state
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.clear();
      setUser(null);
      lastUpsertIdRef.current = null;

      console.log('✅ Account successfully deleted.');
      return { ok: true };
    } catch (error) {
      console.error('❌ Account deletion error:', error);
      return { ok: false, message: error instanceof Error ? error.message : 'Deletion failed' };
    }
  }, [user]);

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
    loginWithGoogle,
    loginWithApple,
    deleteAccount,
    updateProfile,
    isAuthenticated: !!user,
  }), [user, isLoading, login, signup, logout, loginWithGoogle, loginWithApple, deleteAccount, updateProfile]);
});

const AuthContext = result[0];
const useAuth = result[1];

export { AuthContext, useAuth };
