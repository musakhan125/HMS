import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency, getCurrencySymbol, getWhatsAppLink } from '@/lib/utils';
import type { Tenant, Payment } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Phone, User, Calendar, MapPin, Building, ShieldCheck,
  CreditCard, FileText, MessageSquare, Download, CheckCircle, AlertCircle, ExternalLink, Loader2
} from 'lucide-react';

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hostel } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenantProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      // 1. Fetch Tenant profile with room
      const { data: tenantData, error: tenantErr } = await supabase
        .from('tenants')
        .select('*, room:rooms(*)')
        .eq('id', id)
        .single();

      if (tenantErr) throw tenantErr;
      setTenant(tenantData as Tenant);

      // 2. Fetch Payments history
      const { data: paymentsData, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', id)
        .order('payment_date', { ascending: false });

      if (payErr) throw payErr;
      setPayments((paymentsData as Payment[]) || []);
    } catch (err) {
      console.error('Error fetching tenant details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTenantProfile();
  }, [fetchTenantProfile]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Hostelite record not found.</p>
        <Button onClick={() => navigate('/tenants')}>Return to Hostelites</Button>
      </div>
    );
  }

  // Financial calculations
  const totalRentPaid = payments
    .filter(p => p.type === 'rent')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const totalDepositPaid = payments
    .filter(p => p.type === 'security_deposit')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const whatsAppMsg = `Hello ${tenant.full_name}, this is a reminder regarding your rent from ${hostel?.name || 'Hostel Management'}. Monthly Rent: ${formatCurrency(tenant.monthly_rent, currencySymbol)}. Please settle your dues. Thank you!`;
  const whatsAppLink = getWhatsAppLink(tenant.phone, whatsAppMsg);

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('/tenants')} className="gap-2 justify-start sm:w-auto">
          <ArrowLeft className="w-4 h-4" /> Back to Hostelites
        </Button>

        <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
          <Button variant="success" className="gap-2 w-full sm:w-auto justify-center">
            <MessageSquare className="w-4 h-4" /> WhatsApp Reminder
          </Button>
        </a>
      </div>

      {/* Main Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {tenant.photo_url ? (
                <img src={tenant.photo_url} alt={tenant.full_name} className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/20 shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border">
                  {tenant.full_name.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{tenant.full_name}</h1>
                  <Badge variant={tenant.status === 'active' ? 'success' : 'secondary'}>
                    {tenant.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                  {tenant.tenant_type} {tenant.institution ? `• ${tenant.institution}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {tenant.phone}</span>
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" /> Room: {tenant.room ? `Room ${tenant.room.room_no}` : 'Unassigned'}
                  </span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined: {formatDate(tenant.join_date)}</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border w-full md:w-auto">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Monthly Rent</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(tenant.monthly_rent, currencySymbol)}</p>
              </div>
              <div className="h-8 w-[1px] bg-border" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Deposit Paid</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalDepositPaid, currencySymbol)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details & Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal & Guardian Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal & Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium">CNIC / ID Card Number</p>
                <p className="font-medium mt-0.5">{tenant.id_card_no || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Home Address</p>
                <p className="font-medium mt-0.5">{tenant.home_address || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Guardian Name</p>
                <p className="font-medium mt-0.5">{tenant.guardian_name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Guardian Phone</p>
                <p className="font-medium mt-0.5">{tenant.guardian_phone || 'Not provided'}</p>
              </div>
              {tenant.leave_date && (
                <div>
                  <p className="text-xs text-amber-600 font-medium">Leave Date</p>
                  <p className="font-medium text-amber-600 mt-0.5">{formatDate(tenant.leave_date)}</p>
                </div>
              )}
              {tenant.notes && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Remarks / Notes</p>
                  <p className="text-xs bg-muted p-2 rounded-md mt-1">{tenant.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attached Document Scans */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attached Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenant.id_doc_url ? (
                <a
                  href={tenant.id_doc_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">CNIC / ID Document Scan</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No ID document uploaded.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Payment History Log */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Payment History Log</CardTitle>
                <CardDescription>All receipts and payments recorded for this resident</CardDescription>
              </div>
              <Button size="sm" asChild>
                <Link to="/payments">Record New Payment</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto opacity-40 mb-2 stroke-1" />
                  <p className="text-sm">No payments recorded for this hostelite yet.</p>
                </div>
              ) : (
                <>
                  {/* Mobile payment history cards */}
                  <div className="block sm:hidden divide-y divide-border">
                    {payments.map((p) => (
                      <div key={p.id} className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-primary">{p.receipt_no}</span>
                          <span className="font-bold text-emerald-600 text-sm">{formatCurrency(p.amount, currencySymbol)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="capitalize">{p.type.replace('_', ' ')} · {p.method.replace('_', ' ')}</span>
                          <span>{formatDate(p.payment_date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Receipt No</th>
                          <th className="px-4 py-3">Payment Date</th>
                          <th className="px-4 py-3">Month For</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {payments.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/40">
                            <td className="px-4 py-3 font-mono text-xs font-semibold">{p.receipt_no}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(p.payment_date)}</td>
                            <td className="px-4 py-3 font-medium">{formatDate(p.month_for)}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="capitalize">{p.type.replace('_', ' ')}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                              {formatCurrency(p.amount, currencySymbol)}
                            </td>
                            <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{p.method.replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
