import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, getCurrencySymbol } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Bed, ShieldAlert,
  PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Calendar, AlertCircle, Building2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Link } from 'react-router-dom';

const CATEGORY_COLORS: Record<string, string> = {
  rent_to_owner: '#3b82f6',
  electricity: '#f59e0b',
  gas: '#ef4444',
  water: '#06b6d4',
  internet: '#8b5cf6',
  salaries: '#10b981',
  food: '#ec4899',
  maintenance: '#64748b',
  cleaning: '#14b8a6',
  supplies: '#84cc16',
  deposit_refund: '#6366f1',
  marketing: '#a855f7',
  other: '#94a3b8',
};

export default function Dashboard() {
  const { hostel } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  // Selected month state (YYYY-MM)
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);

  const [loading, setLoading] = useState(true);

  // Stats state
  const [totalCapacityRevenue, setTotalCapacityRevenue] = useState(0);
  const [rentExpected, setRentExpected] = useState(0);
  const [rentCollected, setRentCollected] = useState(0);
  const [rentOutstanding, setRentOutstanding] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [depositsHeld, setDepositsHeld] = useState(0);

  // Occupancy stats
  const [totalBeds, setTotalBeds] = useState(0);
  const [occupiedBeds, setOccupiedBeds] = useState(0);

  // Charts data
  const [incomeExpenseTrend, setIncomeExpenseTrend] = useState<{ month: string; income: number; expenses: number; profit: number }[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<{ name: string; value: number; color: string }[]>([]);

  // Defaulters list
  const [defaulters, setDefaulters] = useState<{ id: string; name: string; room_no: string; phone: string; balance: number }[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!hostel?.id) return;
    setLoading(true);

    try {
      const monthStart = `${selectedMonth}-01`;
      const year = parseInt(selectedMonth.split('-')[0]);
      const month = parseInt(selectedMonth.split('-')[1]);
      const nextMonthFirst = new Date(year, month, 1);
      const monthEnd = nextMonthFirst.toISOString().split('T')[0];
      const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().split('T')[0];

      // Fetch all required dashboard data in 4 parallel requests in ONE round trip
      const [
        { data: roomsData, error: roomsErr },
        { data: tenantsData, error: tenantsErr },
        { data: allPayments, error: paymentsErr },
        { data: allExpenses, error: expensesErr }
      ] = await Promise.all([
        supabase.from('rooms').select('id, beds, rent_per_bed').eq('hostel_id', hostel.id),
        supabase.from('tenants').select('id, monthly_rent, security_deposit, room_id, status, full_name, phone, rooms(room_no)').eq('hostel_id', hostel.id).eq('status', 'active'),
        supabase.from('payments').select('amount, type, payment_date, month_for, tenant_id').eq('hostel_id', hostel.id).gte('payment_date', twelveMonthsAgo),
        supabase.from('expenses').select('amount, category, expense_date').eq('hostel_id', hostel.id).gte('expense_date', twelveMonthsAgo),
      ]);

      if (roomsErr) throw roomsErr;
      if (tenantsErr) throw tenantsErr;
      if (paymentsErr) throw paymentsErr;
      if (expensesErr) throw expensesErr;

      // 1. Rooms & Beds calculations
      const totalB = roomsData?.reduce((acc, r) => acc + (r.beds || 0), 0) || 0;
      setTotalBeds(totalB);

      const fullCapacityRev = roomsData?.reduce((acc, r) => acc + ((r.beds || 0) * (Number(r.rent_per_bed) || 0)), 0) || 0;
      setTotalCapacityRevenue(fullCapacityRev);

      // 2. Tenants & Expected Rent
      const occupiedB = tenantsData?.length || 0;
      setOccupiedBeds(occupiedB);

      const expected = tenantsData?.reduce((acc, t) => acc + (Number(t.monthly_rent) || 0), 0) || 0;
      setRentExpected(expected);

      const depHeld = tenantsData?.reduce((acc, t) => acc + (Number(t.security_deposit) || 0), 0) || 0;
      setDepositsHeld(depHeld);

      // 3. Current Selected Month Payments & Rent Collected
      const monthPayments = (allPayments || []).filter(
        p => p.payment_date >= monthStart && p.payment_date < monthEnd
      );

      const rentPaid = monthPayments
        .filter(p => p.type === 'rent')
        .reduce((acc, p) => acc + Number(p.amount), 0);
      setRentCollected(rentPaid);

      const inc = monthPayments
        .filter(p => p.type !== 'security_deposit')
        .reduce((acc, p) => acc + Number(p.amount), 0);
      setTotalIncome(inc);

      const outstanding = Math.max(0, expected - rentPaid);
      setRentOutstanding(outstanding);

      // 4. Current Selected Month Expenses
      const monthExpensesData = (allExpenses || []).filter(
        e => e.expense_date >= monthStart && e.expense_date < monthEnd
      );

      const exp = monthExpensesData
        .filter(e => e.category !== 'deposit_refund')
        .reduce((acc, e) => acc + Number(e.amount), 0);
      setTotalExpenses(exp);

      setNetProfit(inc - exp);

      // 5. Expense Breakdown by Category
      const catMap: Record<string, number> = {};
      monthExpensesData.forEach(e => {
        if (e.category !== 'deposit_refund') {
          catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
        }
      });
      const catArray = Object.keys(catMap).map(cat => ({
        name: cat.replace(/_/g, ' ').toUpperCase(),
        value: catMap[cat],
        color: CATEGORY_COLORS[cat] || '#94a3b8'
      }));
      setExpenseCategories(catArray);

      // 6. Fast in-memory Defaulters calculation (0 extra network queries!)
      const tenantPaidMap: Record<string, number> = {};
      (allPayments || []).forEach(p => {
        if (p.type === 'rent' && p.month_for === monthStart) {
          tenantPaidMap[p.tenant_id] = (tenantPaidMap[p.tenant_id] || 0) + Number(p.amount);
        }
      });

      const defaulterList = (tenantsData || [])
        .map(t => {
          const paidThisMonth = tenantPaidMap[t.id] || 0;
          const due = Number(t.monthly_rent) - paidThisMonth;
          return {
            id: t.id,
            name: t.full_name,
            room_no: (t.rooms as any)?.room_no || 'N/A',
            phone: t.phone,
            balance: due
          };
        })
        .filter(d => d.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      setDefaulters(defaulterList);

      // 7. Fast in-memory 12-Month Trend Data (0 extra network queries!)
      const trendList = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mStart = `${mStr}-01`;
        const mNext = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0];

        const mInc = (allPayments || [])
          .filter(p => p.type !== 'security_deposit' && p.payment_date >= mStart && p.payment_date < mNext)
          .reduce((a, p) => a + Number(p.amount), 0);

        const mExp = (allExpenses || [])
          .filter(e => e.category !== 'deposit_refund' && e.expense_date >= mStart && e.expense_date < mNext)
          .reduce((a, e) => a + Number(e.amount), 0);

        trendList.push({
          month: d.toLocaleString('default', { month: 'short' }),
          income: mInc,
          expenses: mExp,
          profit: mInc - mExp
        });
      }
      setIncomeExpenseTrend(trendList);

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [hostel?.id, selectedMonth]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Generate last 12 months options
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push({ val, label });
  }

  const collectionRate = rentExpected > 0 ? Math.round((rentCollected / rentExpected) * 100) : 0;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Month Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Overview for {new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Room Capacity Revenue (All Rooms Added, Even if Empty) */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-background to-background dark:from-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Room Capacity</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(totalCapacityRevenue, currencySymbol)}</div>
            <p className="text-xs text-muted-foreground mt-1">100% capacity potential ({totalBeds} total beds)</p>
          </CardContent>
        </Card>

        {/* Active Rent Expected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Rent Expected</CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(rentExpected, currencySymbol)}</div>
            <p className="text-xs text-muted-foreground mt-1">From {occupiedBeds} active hostelite(s)</p>
          </CardContent>
        </Card>

        {/* Rent Collected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rent Collected</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(rentCollected, currencySymbol)}</div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>{collectionRate}% Collection Rate</span>
            </div>
          </CardContent>
        </Card>

        {/* Rent Outstanding */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rent Outstanding</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(rentOutstanding, currencySymbol)}</div>
            <p className="text-xs text-muted-foreground mt-1">{defaulters.length} hostelite(s) pending</p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Profit</CardTitle>
            <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
              {netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(netProfit, currencySymbol)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Inc: {formatCurrency(totalIncome, currencySymbol)} | Exp: {formatCurrency(totalExpenses, currencySymbol)}</p>
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Occupancy Rate</CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{occupiedBeds} of {totalBeds} beds occupied</p>
          </CardContent>
        </Card>

        {/* Beds Vacant */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Beds Vacant</CardTitle>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600">
              <Bed className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">{Math.max(0, totalBeds - occupiedBeds)}</div>
            <p className="text-xs text-muted-foreground mt-1">Available for new admissions</p>
          </CardContent>
        </Card>

        {/* Security Deposits Held */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deposits Held</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(depositsHeld, currencySymbol)}</div>
            <p className="text-xs text-muted-foreground mt-1">Refundable hostelite deposits</p>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operating Expenses</CardTitle>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpenses, currencySymbol)}</div>
            <p className="text-xs text-muted-foreground mt-1">Excludes deposit refunds</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 12 Month Financial Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">12-Month Income vs Expenses</CardTitle>
            <CardDescription>Comparison of operational revenue and expenses over time</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeExpenseTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value, currencySymbol)]}
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', color: '#fff', borderRadius: '8px', border: 'none' }}
                />
                <Bar dataKey="income" name="Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Expense Breakdown</CardTitle>
            <CardDescription>Distribution of expenses for selected month</CardDescription>
          </CardHeader>
          <CardContent className="h-80 flex flex-col items-center justify-center">
            {expenseCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => [formatCurrency(val, currencySymbol)]} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <PieIcon className="w-12 h-12 mx-auto stroke-1 opacity-40 mb-2" />
                <p className="text-sm">No expense records for this month</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Defaulters Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Pending Rent Defaulters</CardTitle>
            <CardDescription>Active hostelites with pending balance for {selectedMonth}</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to="/rent-tracker">View Rent Tracker</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {defaulters.length === 0 ? (
            <div className="text-center py-8 text-emerald-600 font-medium text-sm">
              ✨ All active hostelites have paid rent for this month!
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block sm:hidden divide-y divide-border">
                {defaulters.map((d) => (
                  <div key={d.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-foreground">{d.name}</p>
                      <Badge variant="outline">Room {d.room_no}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{d.phone || 'No phone'}</span>
                      <span className="font-bold text-rose-600">{formatCurrency(d.balance, currencySymbol)}</span>
                    </div>
                    <div className="pt-1 flex justify-end">
                      <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary h-8 px-2">
                        <Link to={`/tenants/${d.id}`}>View Ledger</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Hostelite Name</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3 text-right">Outstanding Rent</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {defaulters.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{d.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">Room {d.room_no}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{d.phone || 'N/A'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-rose-600">
                          {formatCurrency(d.balance, currencySymbol)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
                            <Link to={`/tenants/${d.id}`}>View Ledger</Link>
                          </Button>
                        </td>
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
  );
}
