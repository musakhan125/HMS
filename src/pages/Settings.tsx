import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getCurrencySymbol } from '@/lib/utils';
import type { Hostel, Profile } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Settings as SettingsIcon, Building2, Users, Upload, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';

export default function Settings() {
  const { hostel, profile, setHostel, isOwner } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  // Hostel form
  const [hostelData, setHostelData] = useState({
    name: hostel?.name || '',
    address: hostel?.address || '',
    phone: hostel?.phone || '',
    email: hostel?.email || '',
    currency_symbol: hostel?.currency_symbol || 'Rs.',
  });
  const [hostelSaving, setHostelSaving] = useState(false);
  const [hostelSuccess, setHostelSuccess] = useState(false);

  // Staff creation form
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffCreating, setStaffCreating] = useState(false);
  const [staffMsg, setStaffMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Staff list
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvMsg, setCsvMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (hostel) {
      setHostelData({
        name: hostel.name,
        address: hostel.address || '',
        phone: hostel.phone || '',
        email: hostel.email || '',
        currency_symbol: hostel.currency_symbol || 'Rs.',
      });
    }
  }, [hostel]);

  // Fetch staff assigned to hostel
  const fetchStaff = async () => {
    if (!hostel?.id || !isOwner) return;
    setStaffLoading(true);
    try {
      const { data: staffJunction } = await supabase
        .from('hostel_staff')
        .select('user_id')
        .eq('hostel_id', hostel.id);

      if (staffJunction && staffJunction.length > 0) {
        const userIds = staffJunction.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        setStaffList((profiles as Profile[]) || []);
      }
    } catch (err) {
      console.error('Error fetching staff list:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [hostel?.id, isOwner]);

  // Save Hostel Settings
  const handleSaveHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel?.id || !isOwner) return;
    setHostelSaving(true);
    setHostelSuccess(false);

    try {
      const { data, error } = await supabase
        .from('hostels')
        .update({
          name: hostelData.name.trim(),
          address: hostelData.address.trim(),
          phone: hostelData.phone.trim(),
          email: hostelData.email.trim(),
          currency_symbol: hostelData.currency_symbol.trim(),
        })
        .eq('id', hostel.id)
        .select('*')
        .single();

      if (error) throw error;
      setHostel(data as Hostel);
      setHostelSuccess(true);
      setTimeout(() => setHostelSuccess(false), 3000);
    } catch (err) {
      console.error('Failed updating hostel:', err);
    } finally {
      setHostelSaving(false);
    }
  };

  // Add Staff Account
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel?.id || !isOwner) return;
    setStaffCreating(true);
    setStaffMsg(null);

    try {
      // 1. Sign up staff user via Auth API
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: staffEmail.trim(),
        password: staffPassword,
        options: {
          data: { full_name: staffName.trim(), role: 'staff' },
        },
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Could not create user account');

      // 2. Link staff to current hostel in hostel_staff table
      const { error: staffErr } = await supabase.from('hostel_staff').insert({
        hostel_id: hostel.id,
        user_id: authData.user.id,
      });

      if (staffErr) throw staffErr;

      setStaffMsg({ type: 'success', text: `Staff account "${staffEmail}" created successfully!` });
      setStaffEmail('');
      setStaffPassword('');
      setStaffName('');
      fetchStaff();
    } catch (err: any) {
      setStaffMsg({ type: 'error', text: err.message || 'Failed creating staff account' });
    } finally {
      setStaffCreating(false);
    }
  };

  // CSV Bulk Tenant Import Handler
  const handleCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || !hostel?.id) return;
    setCsvImporting(true);
    setCsvMsg(null);

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      if (lines.length < 2) {
        throw new Error('CSV file is empty or missing headers.');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const tenantsToInsert = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = cols[idx] || '';
        });

        if (rowObj['full_name'] || rowObj['name']) {
          tenantsToInsert.push({
            hostel_id: hostel.id,
            full_name: rowObj['full_name'] || rowObj['name'],
            tenant_type: (rowObj['type'] || 'student').toLowerCase() as any,
            institution: rowObj['institution'] || '',
            phone: rowObj['phone'] || '',
            id_card_no: rowObj['cnic'] || rowObj['id_card_no'] || '',
            monthly_rent: parseFloat(rowObj['rent'] || rowObj['monthly_rent']) || 0,
            security_deposit: parseFloat(rowObj['deposit'] || rowObj['security_deposit']) || 0,
            status: 'active',
            join_date: rowObj['join_date'] || new Date().toISOString().split('T')[0],
          });
        }
      }

      if (tenantsToInsert.length === 0) {
        throw new Error('No valid tenant rows found in CSV. Ensure CSV has header column "full_name".');
      }

      const { error } = await supabase.from('tenants').insert(tenantsToInsert);
      if (error) throw error;

      setCsvMsg({ type: 'success', text: `Successfully imported ${tenantsToInsert.length} tenant(s) from CSV!` });
      setCsvFile(null);
    } catch (err: any) {
      setCsvMsg({ type: 'error', text: err.message || 'Error processing CSV import.' });
    } finally {
      setCsvImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground">Configure hostel profile, manage staff credentials, and bulk import tenants.</p>
      </div>

      <Tabs defaultValue="hostel" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hostel">Hostel Details</TabsTrigger>
          <TabsTrigger value="staff">Manage Staff</TabsTrigger>
          <TabsTrigger value="import">CSV Bulk Tenant Import</TabsTrigger>
        </TabsList>

        {/* Tab 1: Hostel Details */}
        <TabsContent value="hostel" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hostel Profile & Currency Settings</CardTitle>
              <CardDescription>Update hostel title, address, contact details, and display currency.</CardDescription>
            </CardHeader>

            <form onSubmit={handleSaveHostel}>
              <CardContent className="space-y-4">
                {hostelSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-sm font-medium rounded-md flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Hostel settings updated successfully!
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Hostel Name *</Label>
                  <Input
                    id="name"
                    value={hostelData.name}
                    onChange={(e) => setHostelData({ ...hostelData, name: e.target.value })}
                    disabled={!isOwner}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    value={hostelData.address}
                    onChange={(e) => setHostelData({ ...hostelData, address: e.target.value })}
                    disabled={!isOwner}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Contact Phone</Label>
                    <Input
                      id="phone"
                      value={hostelData.phone}
                      onChange={(e) => setHostelData({ ...hostelData, phone: e.target.value })}
                      disabled={!isOwner}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={hostelData.email}
                      onChange={(e) => setHostelData({ ...hostelData, email: e.target.value })}
                      disabled={!isOwner}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency_symbol">Configurable Currency Symbol *</Label>
                  <Input
                    id="currency_symbol"
                    value={hostelData.currency_symbol}
                    onChange={(e) => setHostelData({ ...hostelData, currency_symbol: e.target.value })}
                    placeholder="e.g. Rs., $, €, PKR"
                    disabled={!isOwner}
                    className="w-48"
                    required
                  />
                  <p className="text-xs text-muted-foreground">This symbol will prefix all prices, rents, and receipts across the system.</p>
                </div>
              </CardContent>

              {isOwner && (
                <CardFooter>
                  <Button type="submit" disabled={hostelSaving}>
                    {hostelSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Settings
                  </Button>
                </CardFooter>
              )}
            </form>
          </Card>
        </TabsContent>

        {/* Tab 2: Manage Staff */}
        <TabsContent value="staff" className="pt-4 space-y-6">
          {isOwner ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Invite / Register Staff Member</CardTitle>
                  <CardDescription>Staff members can add tenants, payments, and expenses, but cannot delete records or view executive profit reports.</CardDescription>
                </CardHeader>

                <form onSubmit={handleCreateStaff}>
                  <CardContent className="space-y-4">
                    {staffMsg && (
                      <div className={`p-3 text-sm font-medium rounded-md ${
                        staffMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
                      }`}>
                        {staffMsg.text}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="staff_name">Full Name *</Label>
                        <Input
                          id="staff_name"
                          value={staffName}
                          onChange={(e) => setStaffName(e.target.value)}
                          placeholder="Staff Member Name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="staff_email">Email Address *</Label>
                        <Input
                          id="staff_email"
                          type="email"
                          value={staffEmail}
                          onChange={(e) => setStaffEmail(e.target.value)}
                          placeholder="staff@hostel.com"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="staff_pass">Password *</Label>
                        <Input
                          id="staff_pass"
                          type="password"
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          minLength={6}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button type="submit" disabled={staffCreating}>
                      {staffCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Create Staff Account
                    </Button>
                  </CardFooter>
                </form>
              </Card>

              {/* Staff List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assigned Hostel Staff</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {staffList.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No staff accounts created yet. Use the form above to add staff.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {staffList.map((s) => (
                        <div key={s.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{s.full_name || 'Staff User'}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                          <Badge variant="secondary" className="capitalize">{s.role}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Only the Hostel Owner can create and manage staff accounts.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: CSV Import */}
        <TabsContent value="import" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bulk Import Tenants from CSV File</CardTitle>
              <CardDescription>
                Upload a CSV spreadsheet with headers: <code>full_name, phone, type, cnic, rent, deposit, join_date</code>
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleCSVImport}>
              <CardContent className="space-y-4">
                {csvMsg && (
                  <div className={`p-3 text-sm font-medium rounded-md ${
                    csvMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
                  }`}>
                    {csvMsg.text}
                  </div>
                )}

                <div className="p-4 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900 text-center space-y-2">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground stroke-1" />
                  <p className="text-sm font-medium">Select your CSV file</p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="max-w-xs mx-auto"
                    required
                  />
                </div>

                <div className="bg-muted p-4 rounded-lg text-xs space-y-1">
                  <p className="font-bold">Sample CSV Header Template:</p>
                  <code className="block p-2 bg-background rounded font-mono">
                    full_name,phone,type,cnic,rent,deposit,join_date
                  </code>
                  <p className="text-muted-foreground mt-1">Example Row:</p>
                  <code className="block p-2 bg-background rounded font-mono">
                    Ali Raza,03001234567,student,35201-1234567-1,8000,8000,2026-01-01
                  </code>
                </div>
              </CardContent>

              <CardFooter>
                <Button type="submit" disabled={csvImporting || !csvFile}>
                  {csvImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Start Bulk Import
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
