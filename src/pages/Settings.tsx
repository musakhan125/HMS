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
import { Settings as SettingsIcon, Building2, Users, Upload, ShieldCheck, CheckCircle2, Loader2, Trash2 } from 'lucide-react';

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

  // Staff assignment form
  const [staffEmail, setStaffEmail] = useState('');
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

  // Assign Staff Account (created in Supabase)
  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel?.id || !isOwner) return;
    setStaffCreating(true);
    setStaffMsg(null);

    try {
      const cleanEmail = staffEmail.trim().toLowerCase();
      // 1. Look up profile by email
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (!profileData) {
        throw new Error(`User with email "${cleanEmail}" was not found in Supabase. Please first create this user in Supabase Dashboard (Authentication -> Users -> Add user).`);
      }

      // 2. Ensure their role in profiles is 'staff'
      await supabase
        .from('profiles')
        .update({ role: 'staff' })
        .eq('id', profileData.id);

      // 3. Link staff to current hostel in hostel_staff table
      const { error: staffErr } = await supabase
        .from('hostel_staff')
        .upsert({
          hostel_id: hostel.id,
          user_id: profileData.id,
        }, { onConflict: 'hostel_id,user_id' });

      if (staffErr) throw staffErr;

      setStaffMsg({ type: 'success', text: `Staff member "${cleanEmail}" successfully assigned to this hostel!` });
      setStaffEmail('');
      fetchStaff();
    } catch (err: any) {
      setStaffMsg({ type: 'error', text: err.message || 'Failed assigning staff member' });
    } finally {
      setStaffCreating(false);
    }
  };

  // Remove staff member from hostel
  const handleRemoveStaff = async (userId: string) => {
    if (!hostel?.id || !isOwner) return;
    if (!window.confirm('Are you sure you want to remove this staff member from your hostel?')) return;
    try {
      const { error } = await supabase
        .from('hostel_staff')
        .delete()
        .eq('hostel_id', hostel.id)
        .eq('user_id', userId);
      if (error) throw error;
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed removing staff member');
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
              {/* Guidance on user management */}
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-500" />
                    <CardTitle className="text-base text-blue-400">Strict Admin Provisioning Active</CardTitle>
                  </div>
                  <CardDescription className="text-slate-300 text-xs">
                    Public registration is disabled. All new accounts (owners and staff) must be created by you inside Supabase:
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-slate-300 space-y-1.5 pt-0">
                  <p>1. Open your <strong>Supabase Dashboard</strong> &rarr; <strong>Authentication</strong> &rarr; <strong>Users</strong>.</p>
                  <p>2. Click the green <strong>"Add user"</strong> button &rarr; <strong>"Create user"</strong>.</p>
                  <p>3. Enter the user's email &amp; password, and tick <strong>"Auto Confirm User"</strong>.</p>
                  <p>4. Type their email below and click <strong>"Assign Staff to Hostel"</strong>.</p>
                </CardContent>
              </Card>

              {/* Assign staff form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assign Staff to This Hostel</CardTitle>
                  <CardDescription>
                    Assign a registered Supabase user to manage hostelites, rooms, payments, and expenses for this hostel.
                  </CardDescription>
                </CardHeader>

                <form onSubmit={handleAssignStaff}>
                  <CardContent className="space-y-4">
                    {staffMsg && (
                      <div className={`p-3 text-sm font-medium rounded-md ${
                        staffMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
                      }`}>
                        {staffMsg.text}
                      </div>
                    )}

                    <div className="space-y-2 max-w-md">
                      <Label htmlFor="staff_email">Staff Email Address *</Label>
                      <Input
                        id="staff_email"
                        type="email"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="staff@hostel.com"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        User must already be created in your Supabase Auth dashboard.
                      </p>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button type="submit" disabled={staffCreating}>
                      {staffCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Assign Staff to Hostel
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
                      No staff accounts assigned yet. Create users in Supabase and assign them above.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {staffList.map((s) => (
                        <div key={s.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{s.full_name || 'Staff User'}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">{s.role}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 px-2"
                              onClick={() => handleRemoveStaff(s.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Remove
                            </Button>
                          </div>
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
              <CardTitle className="text-base">Bulk Import Hostelites from CSV File</CardTitle>
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
