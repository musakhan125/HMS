import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency, getCurrencySymbol, exportToCSV, snakeToTitle } from '@/lib/utils';
import type { Expense, ExpenseCategory, PaymentMethod } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Download, Receipt, Edit, Trash2, ExternalLink, Loader2 } from 'lucide-react';

const CATEGORIES: ExpenseCategory[] = [
  'rent_to_owner', 'electricity', 'gas', 'water', 'internet',
  'salaries', 'food', 'maintenance', 'cleaning', 'supplies',
  'deposit_refund', 'marketing', 'other'
];

export default function Expenses() {
  const { hostel, user, isOwner } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  // Form input
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'other' as ExpenseCategory,
    description: '',
    amount: 0,
    paid_to: '',
    method: 'cash' as PaymentMethod,
    notes: '',
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!hostel?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('hostel_id', hostel.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses((data as Expense[]) || []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [hostel?.id]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      expense_date: new Date().toISOString().split('T')[0],
      category: 'electricity',
      description: '',
      amount: 0,
      paid_to: '',
      method: 'cash',
      notes: '',
    });
    setReceiptFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setFormData({
      expense_date: exp.expense_date,
      category: exp.category,
      description: exp.description,
      amount: exp.amount,
      paid_to: exp.paid_to || '',
      method: exp.method,
      notes: exp.notes || '',
    });
    setReceiptFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Upload receipt helper
  const uploadReceipt = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `receipts/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const { error } = await supabase.storage.from('expense-receipts').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('expense-receipts').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel?.id) return;
    setSubmitting(true);
    setFormError(null);

    try {
      let receiptUrl = editingExpense?.receipt_url || '';
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile);
      }

      const payload = {
        hostel_id: hostel.id,
        expense_date: formData.expense_date,
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        paid_to: formData.paid_to,
        method: formData.method,
        notes: formData.notes,
        receipt_url: receiptUrl,
        created_by: user?.id,
      };

      if (editingExpense) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchExpenses();
    } catch (err: any) {
      setFormError(err.message || 'Failed saving expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId || !hostel?.id) return;
    try {
      const { data, error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', deletingExpenseId)
        .eq('hostel_id', hostel.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Expense was not deleted. You may not have permission to delete expenses.');
        return;
      }
      setDeletingExpenseId(null);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Error deleting expense');
    }
  };

  const handleExportCSV = () => {
    const csvData = expenses.map(e => ({
      'Date': e.expense_date,
      'Category': e.category,
      'Description': e.description,
      'Amount': e.amount,
      'Paid To': e.paid_to || '',
      'Method': e.method,
      'Notes': e.notes || '',
    }));
    exportToCSV(csvData, `Hostel_Expenses_${new Date().toISOString().split('T')[0]}`);
  };

  // Filtered expenses list
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.paid_to && e.paid_to.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Calculate total operating expenses (excludes deposit refunds as per requirement)
  const totalOperating = filteredExpenses
    .filter(e => e.category !== 'deposit_refund')
    .reduce((acc, e) => acc + Number(e.amount), 0);

  const totalDepositRefunds = filteredExpenses
    .filter(e => e.category === 'deposit_refund')
    .reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses Ledger</h1>
          <p className="text-sm text-muted-foreground">Track hostel operational costs, bills, maintenance, and staff salaries.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={handleOpenAdd} className="gap-2 font-semibold">
            <Plus className="w-4 h-4" /> Record Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-rose-600 uppercase">Total Operational Expenses</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalOperating, currencySymbol)}</p>
            <p className="text-xs text-muted-foreground mt-1">Excludes security deposit refunds</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-purple-600 uppercase">Deposit Refunds Paid</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(totalDepositRefunds, currencySymbol)}</p>
            <p className="text-xs text-muted-foreground mt-1">Capital liability return (non-operational)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search description or vendor / paid to..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="w-full md:w-56">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{snakeToTitle(cat)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto stroke-1 opacity-40 mb-2" />
              <p>No expense logs matching your query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Paid To</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(exp.expense_date)}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline">{snakeToTitle(exp.category)}</Badge>
                      </td>
                      <td className="px-6 py-4 font-medium">{exp.description}</td>
                      <td className="px-6 py-4 text-muted-foreground">{exp.paid_to || 'N/A'}</td>
                      <td className="px-6 py-4 text-right font-bold text-rose-600">
                        {formatCurrency(exp.amount, currencySymbol)}
                      </td>
                      <td className="px-6 py-4 text-xs capitalize text-muted-foreground">{exp.method.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {exp.receipt_url && (
                            <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" title="View Bill Receipt">
                                <ExternalLink className="w-4 h-4 text-slate-600" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(exp)}>
                            <Edit className="w-4 h-4 text-blue-600" />
                          </Button>
                          {isOwner && (
                          <Button variant="ghost" size="icon" onClick={() => setDeletingExpenseId(exp.id)} title="Delete">
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Record New Expense'}</DialogTitle>
            <DialogDescription>Log operational expenditure, utility bills, or maintenance costs.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveExpense} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-md">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense_date">Expense Date *</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val: ExpenseCategory) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{snakeToTitle(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description / Item Name *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. October LESCO Electricity Bill"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="paid_to">Paid To / Vendor Name</Label>
                <Input
                  id="paid_to"
                  value={formData.paid_to}
                  onChange={(e) => setFormData({ ...formData, paid_to: e.target.value })}
                  placeholder="Company / Vendor"
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
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Wire Transfer</SelectItem>
                  <SelectItem value="mobile_wallet">Mobile Wallet</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Attach Receipt / Bill Image</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingExpense ? 'Update Expense' : 'Save Expense Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingExpenseId} onOpenChange={(open) => !open && setDeletingExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this expense record from the ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-red-600 hover:bg-red-700">
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
