import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Hostel } from '@/types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  hostel: Hostel | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setHostel: (hostel: Hostel | null) => void;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hostel, setHostelState] = useState<Hostel | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the user's profile from the profiles table
  const fetchProfile = useCallback(async (userId: string, email: string) => {
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    // If profile row doesn't exist yet, insert it automatically
    if (!data) {
      const { data: newProf } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          full_name: 'Owner',
          role: 'owner',
        })
        .select('*')
        .single();
      data = newProf;
    }

    return data as Profile | null;
  }, []);

  // Fetch hostel: Check if user owns a hostel FIRST, then check staff assignment
  const fetchHostel = useCallback(async (userId: string) => {
    // 1. Check if user is owner of any hostel
    const { data: ownerHostel } = await supabase
      .from('hostels')
      .select('*')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();

    if (ownerHostel) return ownerHostel as Hostel;

    // 2. Otherwise check if user is staff of any hostel
    const { data: staffData } = await supabase
      .from('hostel_staff')
      .select('hostel_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (staffData) {
      const { data: staffHostel } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', staffData.hostel_id)
        .maybeSingle();

      if (staffHostel) return staffHostel as Hostel;
    }

    // 3. If user owns no hostel, automatically create a default hostel for them
    const { data: autoHostel } = await supabase
      .from('hostels')
      .insert({
        name: 'Saibaan Hostel',
        owner_id: userId,
        address: 'Main Address',
        currency_symbol: 'Rs.',
      })
      .select('*')
      .single();

    return autoHostel as Hostel | null;
  }, []);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (user) {
      const [p, h] = await Promise.all([
        fetchProfile(user.id, user.email || ''),
        fetchHostel(user.id)
      ]);
      if (p) setProfile(p);
      if (h) setHostelState(h);
    }
  }, [user, fetchProfile, fetchHostel]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          try {
            const [p, h] = await Promise.all([
              fetchProfile(newSession.user.id, newSession.user.email || ''),
              fetchHostel(newSession.user.id)
            ]);
            if (isMounted) {
              if (p) setProfile(p);
              if (h) setHostelState(h);
            }
          } catch (e) {
            console.error('Error loading user profile/hostel:', e);
          }
        } else {
          setProfile(null);
          setHostelState(null);
        }
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchHostel]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setHostelState(null);
  };

  const setHostel = (h: Hostel | null) => {
    setHostelState(h);
  };

  const isOwner = profile?.role === 'owner';

  const value = React.useMemo<AuthContextType>(
    () => ({
      session,
      user,
      profile,
      hostel,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      setHostel,
      isOwner,
    }),
    [session, user, profile, hostel, loading, isOwner, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
