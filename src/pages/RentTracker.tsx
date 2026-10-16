import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency, getCurrencySymbol, getWhatsAppLink, generateReceiptNo } from '@/lib/utils';
import type { Tenant, PaymentType, PaymentMethod } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, Calendar, Search, MessageSquare, CheckCircle, Clock, AlertTriangle, CreditCard, Loader2 } from 'lucide-react';

interface TenantRentStatus {
  tenant: Tenant;
  expected_rent: number;
  paid_amount: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
}

export default function RentTracker() {
  const { hostel, user } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);

  const [rentStatuses, setRentStatuses] = useState<TenantRentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  // Quick Payment Modal State
  const [quickTenant, setQuickTenant] = useState<TenantRentStatus | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRentTrackerData = useCallback(async () => {
    if (!hostel?.id) return;
    setLoading(true);

    try {
      const monthStart = `${selectedMonth}-01`;
      // Calculate month end date
      const year = parseInt(selectedMonth.split('-')[0]);
      const month = parseInt(selectedMonth.split('-')[1]);
      const nextMonthFirst = new Date(year, month, 1);
      const monthEnd = nextMonthFirst.toISOString().split('T')[0];

      // 1. Fetch active tenants
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*, room:rooms(*)')
        .eq('hostel_id', hostel.id)
        .eq('status', 'active');

      if (!tenantsData) {
        setRentStatuses([]);
        setLoading(false);
        return;
      }

      // 2. Fetch payments for rent for this month
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('hostel_id', hostel.id)
        .eq('type', 'rent')
        .gte('month_for', monthStart)
        .lt('month_for', monthEnd);

      const statusList: TenantRentStatus[] = tenantsData.map(t => {
        const tenantPayments = (paymentsData || []).filter(p => p.tenant_id === t.id);
        const paid = tenantPayments.reduce((acc, p) => acc + Number(p.amount), 0);
        const expected = Number(t.monthly_rent);
        const bal = expected - paid;

        let st: 'paid' | 'partial' | 'unpaid' = 'unpaid';
        if (paid >= expected) st = 'paid';
        else if (paid > 0) st = 'partial';

        return {
          tenant: t as Tenant,
          expected_rent: expected,
          paid_amount: paid,
          balance: Math.max(0, bal),
          status: st,
        };
      });

      setRentStatuses(statusList);
    } catch (err) {
      console.error('Error loading rent tracker:', err);
    } finally {
      setLoading(false);
    }
  }, [hostel?.id, selectedMonth]);

  useEffect(() => {
    fetchRentTrackerData();
  }, [fetchRentTrackerData]);

  // Open Quick Pay Modal
  const handleOpenQuickPay = (item: TenantRentStatus) => {
    setQuickTenant(item);
    setPayAmount(item.balance > 0 ? item.balance : item.expected_rent);
    setPayMethod('cash');
    setPayNotes('');
  };

  const handleSaveQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTenant || !hostel?.id) return;
    setSubmitting(true);

    try {
      const monthStart = `${selectedMonth}-01`;
      const receiptNo = generateReceiptNo();

      const payload = {
        hostel_id: hostel.id,
        tenant_id: quickTenant.tenant.id,
        receipt_no: receiptNo,
        payment_date: new Date().toISOString().split('T')[0],
        month_for: monthStart,
        type: 'rent',
        amount: Number(payAmount),
        method: payMethod,
        notes: payNotes,
        created_by: user?.id,
      };

      const { error } = await supabase.from('payments').insert(payload);
      if (error) throw error;

      setQuickTenant(null);
      fetchRentTrackerData();
    } catch (err) {
      console.error('Failed quick payment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Month selector options
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push({ val, label });
  }

  // Summary counts
  const totalExpected = rentStatuses.reduce((a, s) => a + s.expected_rent, 0);
  const totalPaid = rentStatuses.reduce((a, s) => a + s.paid_amount, 0);
  const totalUnpaid = rentStatuses.reduce((a, s) => a + s.balance, 0);

  const filteredStatuses = rentStatuses.filter(s => {
    const matchesSearch =
      s.tenant.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.tenant.phone.includes(search) ||
      ((s.tenant.room as any)?.room_no || '').includes(search);

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly Rent Tracker</h1>
          <p className="text-sm text-muted-foreground">Monitor real-time rent collection, send WhatsApp payment notices, and clear balances.</p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Expected Rent</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalExpected, currencySymbol)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-emerald-600 uppercase">Collected Rent</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPaid, currencySymbol)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-rose-600 uppercase">Outstanding Rent</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalUnpaid, currencySymbol)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by hostelite name, room number, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger><SelectValue placeholder="Payment Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid Only</SelectItem>
                <SelectItem value="partial">Partial Dues</SelectItem>
                <SelectItem value="unpaid">Unpaid Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rent Tracker Table / Mobile Cards */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredStatuses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarCheck className="w-12 h-12 mx-auto stroke-1 opacity-40 mb-2" />
              <p>No hostelite records found for this period.</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards for Phones */}
              <div className="block md:hidden divide-y divide-border">
                {filteredStatuses.map((item) => {
                  const roomNo = (item.tenant.room as any)?.room_no || 'N/A';
                  const monthLabel = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
                  const rentDetail = item.paid_amount > 0
                    ? `Remaining Balance Due: ${formatCurrency(item.balance, currencySymbol)}`
                    : `Expected Rent: ${formatCurrency(item.expected_rent, currencySymbol)}`;
                  const waMsg = `Dear ${item.tenant.full_name}, this is a gentle reminder from Arslan (Saibaan Hostel Wardan) regarding your rent for ${monthLabel}. ${rentDetail}. Please clear your dues at your earliest convenience. Thank you!`;
                  const waLink = getWhatsAppLink(item.tenant.phone, waMsg);

                  return (
                    <div key={item.tenant.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{item.tenant.full_name}</p>
                          <a href={`tel:${item.tenant.phone}`} className="text-xs text-primary font-medium hover:underline">
                            📞 {item.tenant.phone}
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">Room {roomNo}</Badge>
                          {item.status === 'paid' && <Badge variant="success">PAID</Badge>}
                          {item.status === 'partial' && <Badge variant="warning">PARTIAL</Badge>}
                          {item.status === 'unpaid' && <Badge variant="danger">UNPAID</Badge>}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg text-center text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-medium">Expected</span>
                          <span className="font-medium text-foreground">{formatCurrency(item.expected_rent, currencySymbol)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-medium">Paid</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(item.paid_amount, currencySymbol)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-medium">Balance</span>
                          <span className="font-bold text-rose-600">{formatCurrency(item.balance, currencySymbol)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t">
                        {item.status !== 'paid' ? (
                          <>
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-initial">
                              <Button variant="outline" size="sm" className="w-full gap-1 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8">
                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Reminder
                              </Button>
                            </a>
                            <Button size="sm" onClick={() => handleOpenQuickPay(item)} className="gap-1 text-xs h-8">
                              <CreditCard className="w-3.5 h-3.5" /> Quick Pay
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 py-1">
                            <CheckCircle className="w-4 h-4" /> Cleared for Month
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Hostelite Name</th>
                      <th className="px-6 py-4">Room</th>
                      <th className="px-6 py-4 text-right">Expected Rent</th>
                      <th className="px-6 py-4 text-right">Paid Amount</th>
                      <th className="px-6 py-4 text-right">Balance Due</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStatuses.map((item) => {
                      const roomNo = (item.tenant.room as any)?.room_no || 'N/A';
                      const monthLabel = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
                      const rentDetail = item.paid_amount > 0
                        ? `Remaining Balance Due: ${formatCurrency(item.balance, currencySymbol)}`
                        : `Expected Rent: ${formatCurrency(item.expected_rent, currencySymbol)}`;
                      const waMsg = `Dear ${item.tenant.full_name}, this is a gentle reminder from Arslan (Saibaan Hostel Wardan) regarding your rent for ${monthLabel}. ${rentDetail}. Please clear your dues at your earliest convenience. Thank you!`;
                      const waLink = getWhatsAppLink(item.tenant.phone, waMsg);

                      return (
                        <tr key={item.tenant.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-6 py-4 font-medium">
                            <div>
                              <p className="font-semibold text-foreground">{item.tenant.full_name}</p>
                              <p className="text-xs text-muted-foreground">{item.tenant.phone}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline">Room {roomNo}</Badge>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">
                            {formatCurrency(item.expected_rent, currencySymbol)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-emerald-600">
                            {formatCurrency(item.paid_amount, currencySymbol)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-rose-600">
                            {formatCurrency(item.balance, currencySymbol)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.status === 'paid' && <Badge variant="success">PAID</Badge>}
                            {item.status === 'partial' && <Badge variant="warning">PARTIAL</Badge>}
                            {item.status === 'unpaid' && <Badge variant="danger">UNPAID</Badge>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {item.status !== 'paid' && (
                                <>
                                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm" className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                                      <MessageSquare className="w-3.5 h-3.5" /> Reminder
                                    </Button>
                                  </a>

                                  <Button size="sm" onClick={() => handleOpenQuickPay(item)} className="gap-1">
                                    <CreditCard className="w-3.5 h-3.5" /> Pay
                                  </Button>
                                </>
                              )}
                              {item.status === 'paid' && (
                                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4" /> Cleared
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* One-Click Quick Payment Dialog */}
      {quickTenant && (
        <Dialog open={!!quickTenant} onOpenChange={(open) => !open && setQuickTenant(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quick Record Rent Payment</DialogTitle>
              <DialogDescription>
                Recording rent payment for <strong>{quickTenant.tenant.full_name}</strong> for {selectedMonth}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveQuickPayment} className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1 text-xs">
                <p>Expected Rent: <strong>{formatCurrency(quickTenant.expected_rent, currencySymbol)}</strong></p>
                <p>Already Paid: <strong>{formatCurrency(quickTenant.paid_amount, currencySymbol)}</strong></p>
                <p>Current Balance: <strong className="text-rose-600">{formatCurrency(quickTenant.balance, currencySymbol)}</strong></p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay_amount">Payment Amount ({currencySymbol}) *</Label>
                <Input
                  id="pay_amount"
                  type="number"
                  min={1}
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay_method">Method *</Label>
                <Select value={payMethod} onValueChange={(val: any) => setPayMethod(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Wire Transfer</SelectItem>
                    <SelectItem value="mobile_wallet">Mobile Wallet</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay_notes">Notes / Transaction Ref</Label>
                <Textarea
                  id="pay_notes"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setQuickTenant(null)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirm & Clear Rent
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
