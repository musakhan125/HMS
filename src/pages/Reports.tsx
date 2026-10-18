import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency, getCurrencySymbol, exportToCSV, snakeToTitle, naturalSortRooms } from '@/lib/utils';
import { formatFloorLabel } from '@/lib/rooms';
import type { Tenant, Room, Payment, Expense } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Download, Printer, TrendingUp, TrendingDown, Users, FileText, Loader2 } from 'lucide-react';

export default function Reports() {
  const { hostel } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Year filter for P&L
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const fetchReportsData = useCallback(async () => {
    if (!hostel?.id) return;
    setLoading(true);

    try {
      const [
        { data: tData },
        { data: rData },
        { data: pData },
        { data: eData }
      ] = await Promise.all([
        supabase.from('tenants').select('*, room:rooms(*)').eq('hostel_id', hostel.id),
        supabase.from('rooms').select('*').eq('hostel_id', hostel.id),
        supabase.from('payments').select('*, tenant:tenants(*)').eq('hostel_id', hostel.id),
        supabase.from('expenses').select('*').eq('hostel_id', hostel.id)
      ]);

      setTenants((tData as Tenant[]) || []);
      setRooms(naturalSortRooms((rData as Room[]) || []));
      setPayments((pData as Payment[]) || []);
      setExpenses((eData as Expense[]) || []);
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  }, [hostel?.id]);

  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData]);

  // Compute 12-month P&L data for selected year
  const monthlyPL = Array.from({ length: 12 }).map((_, idx) => {
    const monthNum = idx + 1;
    const monthStr = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
    const monthName = new Date(selectedYear, idx, 1).toLocaleString('default', { month: 'short' });

    // Income excludes security deposits
    const monthIncome = payments
      .filter(p => p.payment_date.startsWith(monthStr) && p.type !== 'security_deposit')
      .reduce((a, p) => a + Number(p.amount), 0);

    // Operational Expenses exclude deposit refunds
    const monthExp = expenses
      .filter(e => e.expense_date.startsWith(monthStr) && e.category !== 'deposit_refund')
      .reduce((a, e) => a + Number(e.amount), 0);

    return {
      month: monthName,
      monthFull: new Date(selectedYear, idx, 1).toLocaleString('default', { month: 'long' }),
      income: monthIncome,
      expenses: monthExp,
      profit: monthIncome - monthExp,
    };
  });

  const totalYearIncome = monthlyPL.reduce((a, m) => a + m.income, 0);
  const totalYearExpenses = monthlyPL.reduce((a, m) => a + m.expenses, 0);
  const totalYearProfit = totalYearIncome - totalYearExpenses;

  // Defaulters list computation
  const activeTenants = tenants.filter(t => t.status === 'active');
  const defaultersList = activeTenants.map(t => {
    const rentPaid = payments
      .filter(p => p.tenant_id === t.id && p.type === 'rent')
      .reduce((a, p) => a + Number(p.amount), 0);

    // Approximate total expected rent since join date up to today
    const joinYear = new Date(t.join_date).getFullYear();
    const joinMonth = new Date(t.join_date).getMonth();
    const nowYear = new Date().getFullYear();
    const nowMonth = new Date().getMonth();

    const monthsActive = Math.max(1, (nowYear - joinYear) * 12 + (nowMonth - joinMonth) + 1);
    const expectedTotal = monthsActive * Number(t.monthly_rent);
    const balance = Math.max(0, expectedTotal - rentPaid);

    return {
      tenant: t,
      monthsActive,
      expectedTotal,
      paidTotal: rentPaid,
      balance,
    };
  }).filter(d => d.balance > 0);

  // CSV Export for P&L
  const exportPLCSV = () => {
    const csvData = monthlyPL.map(m => ({
      'Month': m.monthFull,
      'Total Income': m.income,
      'Operating Expenses': m.expenses,
      'Net Profit': m.profit,
    }));
    exportToCSV(csvData, `P_and_L_Report_${selectedYear}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial & Operational Reports</h1>
          <p className="text-sm text-muted-foreground">Comprehensive Profit & Loss statements, occupant ledgers, and defaulter audits.</p>
        </div>

        <Button variant="outline" onClick={() => window.print()} className="gap-2 no-print">
          <Printer className="w-4 h-4" /> Print Report / PDF
        </Button>
      </div>

      <Tabs defaultValue="pl" className="w-full">
        <TabsList className="grid w-full grid-cols-3 no-print">
          <TabsTrigger value="pl">Profit & Loss Statement</TabsTrigger>
          <TabsTrigger value="defaulters">Defaulters Audit ({defaultersList.length})</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy & Room Breakdown</TabsTrigger>
        </TabsList>

        {/* Tab 1: P&L Statement */}
        <TabsContent value="pl" className="space-y-6 pt-4">
          <div className="flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Select Year:</span>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={exportPLCSV} className="gap-2">
              <Download className="w-3.5 h-3.5" /> Export P&L CSV
            </Button>
          </div>

          {/* Yearly Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Annual Gross Income</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalYearIncome, currencySymbol)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Annual Operating Expenses</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalYearExpenses, currencySymbol)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Net Annual Profit</p>
                <p className={`text-2xl font-bold mt-1 ${totalYearProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(totalYearProfit, currencySymbol)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly P&L Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">12-Month Profit & Loss Breakdown ({selectedYear})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3">Month</th>
                      <th className="px-6 py-3 text-right">Income ({currencySymbol})</th>
                      <th className="px-6 py-3 text-right">Expenses ({currencySymbol})</th>
                      <th className="px-6 py-3 text-right">Net Profit / Loss ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthlyPL.map((m) => (
                      <tr key={m.month} className="hover:bg-muted/40">
                        <td className="px-6 py-3.5 font-medium">{m.monthFull}</td>
                        <td className="px-6 py-3.5 text-right font-medium text-blue-600">{formatCurrency(m.income, currencySymbol)}</td>
                        <td className="px-6 py-3.5 text-right font-medium text-rose-600">{formatCurrency(m.expenses, currencySymbol)}</td>
                        <td className={`px-6 py-3.5 text-right font-bold ${m.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(m.profit, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/80 font-bold">
                    <tr>
                      <td className="px-6 py-3.5">FULL YEAR TOTAL</td>
                      <td className="px-6 py-3.5 text-right text-blue-600">{formatCurrency(totalYearIncome, currencySymbol)}</td>
                      <td className="px-6 py-3.5 text-right text-rose-600">{formatCurrency(totalYearExpenses, currencySymbol)}</td>
                      <td className={`px-6 py-3.5 text-right ${totalYearProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(totalYearProfit, currencySymbol)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Defaulters Audit */}
        <TabsContent value="defaulters" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comprehensive Hostelite Defaulters Audit</CardTitle>
              <CardDescription>Hostelites with outstanding accumulated rent balances.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {defaultersList.length === 0 ? (
                <div className="text-center py-12 text-emerald-600 font-medium">
                  🎉 No defaulters found! All active hostelites are fully paid up.
                </div>
              ) : (
                <>
                  {/* Mobile View */}
                  <div className="block sm:hidden divide-y divide-border">
                    {defaultersList.map(d => (
                      <div key={d.tenant.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm text-foreground">{d.tenant.full_name}</p>
                          <Badge variant="outline">Room {(d.tenant.room as any)?.room_no || 'N/A'}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>📞 {d.tenant.phone}</span>
                          <span className="font-bold text-rose-600 text-sm">{formatCurrency(d.balance, currencySymbol)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Expected: {formatCurrency(d.expectedTotal, currencySymbol)} · Paid: {formatCurrency(d.paidTotal, currencySymbol)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-6 py-3">Hostelite Name</th>
                          <th className="px-6 py-3">Room</th>
                          <th className="px-6 py-3">Contact</th>
                          <th className="px-6 py-3 text-right">Expected Rent</th>
                          <th className="px-6 py-3 text-right">Paid to Date</th>
                          <th className="px-6 py-3 text-right">Current Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {defaultersList.map(d => (
                          <tr key={d.tenant.id} className="hover:bg-muted/40">
                            <td className="px-6 py-3.5 font-medium">{d.tenant.full_name}</td>
                            <td className="px-6 py-3.5">
                              <Badge variant="outline">Room {(d.tenant.room as any)?.room_no || 'N/A'}</Badge>
                            </td>
                            <td className="px-6 py-3.5 text-muted-foreground">{d.tenant.phone}</td>
                            <td className="px-6 py-3.5 text-right font-medium">{formatCurrency(d.expectedTotal, currencySymbol)}</td>
                            <td className="px-6 py-3.5 text-right font-medium text-emerald-600">{formatCurrency(d.paidTotal, currencySymbol)}</td>
                            <td className="px-6 py-3.5 text-right font-bold text-rose-600">{formatCurrency(d.balance, currencySymbol)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Occupancy Report */}
        <TabsContent value="occupancy" className="space-y-6 pt-4">
          {/* Summary KPIs for Occupancy & Capacity */}
          {(() => {
            const totBeds = rooms.reduce((acc, r) => acc + (r.beds || 0), 0);
            const totOcc = activeTenants.length;
            const totVac = Math.max(0, totBeds - totOcc);
            const totCapacityRevenue = rooms.reduce((acc, r) => acc + ((r.beds || 0) * (Number(r.rent_per_bed) || 0)), 0);
            const activeExpected = activeTenants.reduce((acc, t) => acc + (Number(t.monthly_rent) || 0), 0);
            const occPct = totBeds > 0 ? Math.round((totOcc / totBeds) * 100) : 0;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-background to-background dark:from-blue-950/20">
                  <CardContent className="pt-6">
                    <p className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">Total Room Capacity</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{formatCurrency(totCapacityRevenue, currencySymbol)}</p>
                    <p className="text-xs text-muted-foreground mt-1">100% capacity potential ({rooms.length} rooms, {totBeds} beds)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Active Expected Rent</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(activeExpected, currencySymbol)}</p>
                    <p className="text-xs text-muted-foreground mt-1">From {totOcc} active occupant(s)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Overall Bed Occupancy</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{occPct}%</p>
                    <p className="text-xs text-muted-foreground mt-1">{totOcc} occupied · {totVac} vacant beds</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hostel Occupancy & Capacity Report</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3">Room</th>
                      <th className="px-6 py-3">Floor</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3 text-center">Bed Capacity</th>
                      <th className="px-6 py-3 text-center">Occupied Beds</th>
                      <th className="px-6 py-3 text-center">Vacant Beds</th>
                      <th className="px-6 py-3 text-right">Rent / Bed</th>
                      <th className="px-6 py-3 text-right">Full Room Potential</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rooms.map(r => {
                      const occCount = activeTenants.filter(t => t.room_id === r.id).length;
                      const vacantCount = Math.max(0, r.beds - occCount);
                      const roomPotential = (r.beds || 0) * (Number(r.rent_per_bed) || 0);

                      return (
                        <tr key={r.id} className="hover:bg-muted/40">
                          <td className="px-6 py-3.5 font-bold">Room {r.room_no}</td>
                          <td className="px-6 py-3.5 text-muted-foreground">{formatFloorLabel(r.floor)}</td>
                          <td className="px-6 py-3.5 capitalize">{r.room_type}</td>
                          <td className="px-6 py-3.5 text-center font-medium">{r.beds}</td>
                          <td className="px-6 py-3.5 text-center font-medium text-emerald-600">{occCount}</td>
                          <td className="px-6 py-3.5 text-center font-medium text-teal-600">{vacantCount}</td>
                          <td className="px-6 py-3.5 text-right font-semibold">{formatCurrency(r.rent_per_bed, currencySymbol)}</td>
                          <td className="px-6 py-3.5 text-right font-bold text-primary">{formatCurrency(roomPotential, currencySymbol)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/60 font-bold border-t-2 border-border text-sm">
                    <tr>
                      <td colSpan={3} className="px-6 py-4">Total ({rooms.length} Rooms)</td>
                      <td className="px-6 py-4 text-center">{rooms.reduce((acc, r) => acc + (r.beds || 0), 0)}</td>
                      <td className="px-6 py-4 text-center text-emerald-600">{activeTenants.length}</td>
                      <td className="px-6 py-4 text-center text-teal-600">{Math.max(0, rooms.reduce((acc, r) => acc + (r.beds || 0), 0) - activeTenants.length)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">—</td>
                      <td className="px-6 py-4 text-right text-primary text-base">
                        {formatCurrency(rooms.reduce((acc, r) => acc + ((r.beds || 0) * (Number(r.rent_per_bed) || 0)), 0), currencySymbol)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
