import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ShieldCheck, Lock, Mail, User as UserIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sign Up state
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpRole, setSignUpRole] = useState<'owner' | 'staff'>('owner');
  const [hostelName, setHostelName] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) throw error;
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError(null);
    setSignUpSuccess(null);
    setSignUpLoading(true);

    try {
      const { error } = await signUp(signUpEmail, signUpPassword, signUpName, signUpRole);
      if (error) throw error;

      // Create initial hostel record if owner
      const { data: { user } } = await supabase.auth.getUser();
      if (user && signUpRole === 'owner' && hostelName.trim()) {
        await supabase.from('hostels').insert({
          name: hostelName.trim(),
          owner_id: user.id,
          address: 'Main Campus Area',
        });
      }

      setSignUpSuccess('Account registered successfully! Redirecting...');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setSignUpError(message);
    } finally {
      setSignUpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-xl mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Hostel Manager</h1>
          <p className="text-sm text-slate-400">Smart & Modern Hostel Operations Portal</p>
        </div>

        <Card className="border-slate-700/50 bg-slate-900/90 text-slate-100 backdrop-blur-xl shadow-2xl">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/80">
                <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  Register
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleSignIn}>
                <CardContent className="space-y-4 pt-2">
                  {loginError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium space-y-1">
                      <p>{loginError}</p>
                      {loginError.toLowerCase().includes('invalid login credentials') && (
                        <p className="text-[11px] text-slate-300">
                          First time user? Click the{' '}
                          <button
                            type="button"
                            onClick={() => setActiveTab('register')}
                            className="text-primary underline font-bold"
                          >
                            Register
                          </button>{' '}
                          tab above to create your owner account.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="owner@hostel.com"
                        className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex-col gap-2 pt-2">
                  <Button type="submit" className="w-full h-10 font-semibold" disabled={loginLoading}>
                    {loginLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...
                      </>
                    ) : (
                      'Sign In to Portal'
                    )}
                  </Button>
                  <p className="text-xs text-slate-400 text-center mt-2">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('register')}
                      className="text-primary font-semibold hover:underline"
                    >
                      Register New Account
                    </button>
                  </p>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4 pt-2">
                  {signUpError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                      {signUpError}
                    </div>
                  )}

                  {signUpSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {signUpSuccess}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="admin@hostel.com"
                        className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Min 6 characters"
                        className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Account Type</Label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 z-10" />
                      <Select value={signUpRole} onValueChange={(val: 'owner' | 'staff') => setSignUpRole(val)}>
                        <SelectTrigger id="signup-role" className="pl-9 bg-slate-800/50 border-slate-700 text-white">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                          <SelectItem value="owner">Owner (Full Management)</SelectItem>
                          <SelectItem value="staff">Staff (Operational Access)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {signUpRole === 'owner' && (
                    <div className="space-y-2">
                      <Label htmlFor="hostel-name">Hostel Name *</Label>
                      <Input
                        id="hostel-name"
                        type="text"
                        placeholder="e.g. Royal Heights Hostel"
                        className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        value={hostelName}
                        onChange={(e) => setHostelName(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2">
                  <Button type="submit" className="w-full h-10 font-semibold" disabled={signUpLoading}>
                    {signUpLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-slate-500">
          Powered by Supabase PostgreSQL & Auth with Row Level Security.
        </p>
      </div>
    </div>
  );
}
