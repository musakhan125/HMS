import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency, getCurrencySymbol, generateReceiptNo, exportToCSV } from '@/lib/utils';
import type { Payment, Tenant, PaymentType, PaymentMethod } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Download, Printer, CreditCard, Calendar, FileText, CheckCircle2, Loader2, Building2 } from 'lucide-react';

export default function Payments() {
  const { hostel, user, isOwner } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // New Payment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tenant_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    month_for: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    type: 'rent' as PaymentType,
    amount: 0,
    method: 'cash' as PaymentMethod,
    notes: '',
  });

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);

  const fetchData = useCallback(async () => {
    if (!hostel?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Tenants
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*, room:rooms(*)')
        .eq('hostel_id', hostel.id)
        .order('full_name');
      setTenants((tenantsData as Tenant[]) || []);

      // 2. Fetch Payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*, tenant:tenants(*, room:rooms(*))')
        .eq('hostel_id', hostel.id)
        .order('created_at', { ascending: false });

      setPayments((paymentsData as Payment[]) || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  }, [hostel?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAdd = () => {
    const firstTenant = tenants.find(t => t.status === 'active') || tenants[0];
    setFormData({
      tenant_id: firstTenant ? firstTenant.id : '',
      payment_date: new Date().toISOString().split('T')[0],
      month_for: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      type: 'rent',
      amount: firstTenant ? firstTenant.monthly_rent : 0,
      method: 'cash',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleTenantChange = (tenantId: string) => {
    const selTenant = tenants.find(t => t.id === tenantId);
    setFormData({
      ...formData,
      tenant_id: tenantId,
      amount: selTenant && formData.type === 'rent' ? selTenant.monthly_rent : formData.amount,
    });
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel?.id) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const receiptNo = generateReceiptNo();

      // Check receipt duplicate uniqueness (handled by backend UNIQUE constraint, but checked locally too)
      const { data: dupCheck } = await supabase
        .from('payments')
        .select('id')
        .eq('hostel_id', hostel.id)
        .eq('receipt_no', receiptNo)
        .maybeSingle();

      if (dupCheck) {
        throw new Error('Receipt number collision. Please try submitting again.');
      }

      const payload = {
        hostel_id: hostel.id,
        tenant_id: formData.tenant_id,
        receipt_no: receiptNo,
        payment_date: formData.payment_date,
        month_for: formData.month_for,
        type: formData.type,
        amount: Number(formData.amount),
        method: formData.method,
        notes: formData.notes,
        created_by: user?.id,
      };

      const { data: newPayment, error } = await supabase
        .from('payments')
        .insert(payload)
        .select('*, tenant:tenants(*, room:rooms(*))')
        .single();

      if (error) throw error;

      setIsModalOpen(false);
      fetchData();

      // Show print receipt preview for new payment automatically
      if (newPayment) {
        setSelectedReceipt(newPayment as Payment);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error recording payment');
    } finally {
      setFormSubmitting(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const csvData = payments.map(p => ({
      'Receipt No': p.receipt_no,
      'Payment Date': p.payment_date,
      'Month For': p.month_for,
      'Tenant Name': (p.tenant as any)?.full_name || 'N/A',
      'Room': (p.tenant as any)?.room?.room_no || 'N/A',
      'Category': p.type,
      'Amount': p.amount,
      'Payment Method': p.method,
      'Notes': p.notes || '',
    }));
    exportToCSV(csvData, `Hostel_Payments_${new Date().toISOString().split('T')[0]}`);
  };

  // Filtered payments list
  const filteredPayments = payments.filter(p => {
    const tenantName = (p.tenant as any)?.full_name || '';
    const receipt = p.receipt_no || '';
    const matchesSearch =
      tenantName.toLowerCase().includes(search.toLowerCase()) ||
      receipt.toLowerCase().includes(search.toLowerCase());

    const matchesTenant = tenantFilter === 'all' || p.tenant_id === tenantFilter;
    const matchesType = typeFilter === 'all' || p.type === typeFilter;

    return matchesSearch && matchesTenant && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Receipts & Logs</h1>
          <p className="text-sm text-muted-foreground">Record tenant payments, issue printable receipts, and export statements.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={handleOpenAdd} className="gap-2 font-semibold">
            <Plus className="w-4 h-4" /> Record Payment
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by receipt number or tenant name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="w-full md:w-48">
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger><SelectValue placeholder="Filter by Tenant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {tenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-44">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Payment Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
                <SelectItem value="security_deposit">Security Deposit</SelectItem>
                <SelectItem value="mess">Mess Fee</SelectItem>
                <SelectItem value="electricity">Electricity</SelectItem>
                <SelectItem value="laundry">Laundry</SelectItem>
                <SelectItem value="late_fee">Late Fee</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments History Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto stroke-1 opacity-40 mb-2" />
              <p>No payment records found matching your query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Receipt No</th>
                    <th className="px-6 py-4">Tenant Name</th>
                    <th className="px-6 py-4">Room</th>
                    <th className="px-6 py-4">Payment Date</th>
                    <th className="px-6 py-4">Month For</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayments.map((p) => {
                    const tenantObj = p.tenant as any;
                    return (
                      <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-xs text-primary">{p.receipt_no}</td>
                        <td className="px-6 py-4 font-medium">{tenantObj?.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {tenantObj?.room ? `Room ${tenantObj.room.room_no}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{formatDate(p.payment_date)}</td>
                        <td className="px-6 py-4 font-medium">{formatDate(p.month_for)}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize">{p.type.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">
                          {formatCurrency(p.amount, currencySymbol)}
                        </td>
                        <td className="px-6 py-4 text-xs capitalize text-muted-foreground">{p.method.replace('_', ' ')}</td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(p)} className="gap-1">
                            <Printer className="w-3.5 h-3.5" /> View Receipt
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record New Payment</DialogTitle>
            <DialogDescription>Issue an official payment receipt for rent, deposit, or utility fees.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePayment} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-md">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tenant_id">Select Tenant *</Label>
              <Select value={formData.tenant_id} onValueChange={handleTenantChange}>
                <SelectTrigger><SelectValue placeholder="Choose active resident" /></SelectTrigger>
                <SelectContent>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name} {(t.room as any) ? `(Room ${(t.room as any).room_no})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Payment Category *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val: PaymentType) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">Monthly Rent</SelectItem>
                    <SelectItem value="security_deposit">Security Deposit</SelectItem>
                    <SelectItem value="mess">Mess / Food Fee</SelectItem>
                    <SelectItem value="electricity">Electricity Charges</SelectItem>
                    <SelectItem value="laundry">Laundry</SelectItem>
                    <SelectItem value="late_fee">Late Payment Fine</SelectItem>
                    <SelectItem value="other">Other Charges</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({currencySymbol}) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min={1}
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="month_for">Month For *</Label>
                <Input
                  id="month_for"
                  type="date"
                  value={formData.month_for}
                  onChange={(e) => setFormData({ ...formData, month_for: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method *</Label>
              <Select
                value={formData.method}
                onValueChange={(val: PaymentMethod) => setFormData({ ...formData, method: val })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash Payment</SelectItem>
                  <SelectItem value="bank_transfer">Bank Wire Transfer</SelectItem>
                  <SelectItem value="mobile_wallet">Mobile Wallet (Easypaisa/JazzCash)</SelectItem>
                  <SelectItem value="cheque">Bank Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Transaction Reference</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="TRX ID or bank reference code"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Generate Official Receipt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
          <DialogContent className="max-w-xl">
            <div id="printable-receipt" className="p-6 bg-white text-slate-900 rounded-lg space-y-6">
              {/* Header */}
              <div className="border-b pb-4 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-extrabold uppercase tracking-wide">{hostel?.name || 'Hostel Manager'}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{hostel?.address || 'Main Campus Hostel Address'}</p>
                  <p className="text-xs text-slate-500">Ph: {hostel?.phone || '0300-0000000'}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="font-mono text-xs px-3 py-1 bg-slate-100">
                    RECEIPT
                  </Badge>
                  <p className="text-xs font-mono font-bold mt-2 text-primary">{selectedReceipt.receipt_no}</p>
                  <p className="text-xs text-slate-500">Date: {formatDate(selectedReceipt.payment_date)}</p>
                </div>
              </div>

              {/* Tenant & Room details */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Received From:</p>
                  <p className="font-bold text-base text-slate-900">{(selectedReceipt.tenant as any)?.full_name}</p>
                  <p className="text-xs text-slate-600">Phone: {(selectedReceipt.tenant as any)?.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Room Details:</p>
                  <p className="font-bold text-base text-slate-900">
                    Room {(selectedReceipt.tenant as any)?.room?.room_no || 'N/A'}
                  </p>
                  <p className="text-xs text-slate-600">For Month: {formatDate(selectedReceipt.month_for)}</p>
                </div>
              </div>

              {/* Receipt Summary Table */}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500 bg-slate-100">
                    <th className="py-2 px-3 text-left">Description</th>
                    <th className="py-2 px-3 text-left">Method</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-3 px-3 font-medium capitalize">
                      {selectedReceipt.type.replace('_', ' ')} Payment
                    </td>
                    <td className="py-3 px-3 text-xs capitalize text-slate-600">
                      {selectedReceipt.method.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-lg text-emerald-700">
                      {formatCurrency(selectedReceipt.amount, currencySymbol)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {selectedReceipt.notes && (
                <div className="text-xs text-slate-500 border-t pt-2">
                  <strong>Notes:</strong> {selectedReceipt.notes}
                </div>
              )}

              {/* Signature Footer */}
              <div className="pt-8 border-t flex justify-between items-end text-xs text-slate-500">
                <div>
                  <p>Computer Generated Receipt</p>
                  <p>Thank you for your prompt payment.</p>
                </div>
                <div className="text-center border-t border-slate-400 w-40 pt-1">
                  <p className="font-semibold text-slate-800">Authorized Signature</p>
                </div>
              </div>
            </div>

            <DialogFooter className="no-print">
              <Button variant="outline" onClick={() => setSelectedReceipt(null)}>Close</Button>
              <Button onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" /> Print Receipt / Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
