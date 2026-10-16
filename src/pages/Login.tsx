import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Building2, Shield, Lock, Mail, Loader2, AlertTriangle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setResendMsg(null);
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

  const handleResendConfirmation = async () => {
    if (!loginEmail.trim()) return;
    setResending(true);
    setResendMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: loginEmail.trim(),
      });
      if (error) throw error;
      setResendMsg('Confirmation email resent! Please check your inbox and Spam folder.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend confirmation email';
      setResendMsg(msg);
    } finally {
      setResending(false);
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
          <CardHeader className="pb-3 text-center">
            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300 mx-auto w-fit">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span>Authorized Access Only</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-2">Sign In</h2>
            <p className="text-xs text-slate-400">Enter your credentials to access the management portal</p>
          </CardHeader>

          <form onSubmit={handleSignIn}>
            <CardContent className="space-y-4 pt-2">
              {loginError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{loginError}</span>
                  </div>

                  {loginError.toLowerCase().includes('email not confirmed') && (
                    <div className="space-y-2 text-[11px] text-slate-300 border-t border-red-500/20 pt-2">
                      <p>
                        Supabase requires you to verify your email before logging in.
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                        <li>Check your inbox and Spam folder for the verification link.</li>
                        <li>
                          Or in your Supabase Dashboard: <strong>Authentication &rarr; Users &rarr; click (...) next to your email &rarr; Confirm email</strong>.
                        </li>
                      </ul>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8 border-red-400/40 text-white hover:bg-white/10 mt-1"
                        onClick={handleResendConfirmation}
                        disabled={resending}
                      >
                        {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                        {resending ? 'Sending...' : 'Resend Confirmation Email'}
                      </Button>

                      {resendMsg && (
                        <p className="text-[11px] text-emerald-400 font-semibold mt-1">{resendMsg}</p>
                      )}
                    </div>
                  )}

                  {loginError.toLowerCase().includes('invalid login credentials') && (
                    <p className="text-[11px] text-slate-300">
                      Please verify your email and password. If you need access, contact the hostel administrator.
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
                    placeholder="name@example.com"
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

            <CardFooter className="flex-col gap-3 pt-2">
              <Button type="submit" className="w-full h-10 font-semibold" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...
                  </>
                ) : (
                  'Sign In to Portal'
                )}
              </Button>
              <p className="text-[11px] text-slate-400 text-center">
                Registration is closed. New accounts can only be provisioned by the hostel administrator.
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-500">
          Powered by Supabase PostgreSQL & Auth with Row Level Security.
        </p>
      </div>
    </div>
  );
}
