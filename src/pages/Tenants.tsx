import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, formatCurrency, getCurrencySymbol } from '@/lib/utils';
import { persistRoom } from '@/lib/rooms';
import type { Tenant, Room } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Eye, Edit, Trash2, UserMinus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Tenants() {
  const { hostel, isOwner } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'left'>('active');
  const [roomFilter, setRoomFilter] = useState<string>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [leavingTenant, setLeavingTenant] = useState<Tenant | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    full_name: '',
    tenant_type: 'student' as 'student' | 'professional' | 'other',
    institution: '',
    phone: '',
    id_card_no: '',
    guardian_name: '',
    guardian_phone: '',
    home_address: '',
    room_id: '',
    room_no: '',
    join_date: new Date().toISOString().split('T')[0],
    monthly_rent: 0,
    security_deposit: 0,
    notes: '',
  });

  // File upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Leave date input
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    if (!hostel?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .eq('hostel_id', hostel.id)
        .order('room_no');
      setRooms(roomsData || []);

      // 2. Fetch Tenants with Room info
      const { data: tenantsData } = await supabase
        .from('tenants')
        .select('*, room:rooms(*)')
        .eq('hostel_id', hostel.id)
        .order('created_at', { ascending: false });
      setTenants((tenantsData as Tenant[]) || []);
    } catch (err) {
      console.error('Error loading tenants:', err);
    } finally {
      setLoading(false);
    }
  }, [hostel?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open modal for editing
  const handleEditClick = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      full_name: tenant.full_name,
      tenant_type: tenant.tenant_type,
      institution: tenant.institution || '',
      phone: tenant.phone || '',
      id_card_no: tenant.id_card_no || '',
      guardian_name: tenant.guardian_name || '',
      guardian_phone: tenant.guardian_phone || '',
      home_address: tenant.home_address || '',
      room_id: tenant.room_id || '',
      room_no: tenant.room?.room_no || '',
      join_date: tenant.join_date,
      monthly_rent: tenant.monthly_rent,
      security_deposit: tenant.security_deposit,
      notes: tenant.notes || '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingTenant(null);
    setFormData({
      full_name: '',
      tenant_type: 'student',
      institution: '',
      phone: '',
      id_card_no: '',
      guardian_name: '',
      guardian_phone: '',
      home_address: '',
      room_id: '',
      room_no: '',
      join_date: new Date().toISOString().split('T')[0],
      monthly_rent: 0,
      security_deposit: 0,
      notes: '',
    });
    setPhotoFile(null);
    setIdDocFile(null);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Upload file helper
  const uploadFile = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const { error } = await supabase.storage.from('tenant-files').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('tenant-files').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // Save Tenant (Create or Update)
  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel?.id) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const typedRoomNo = formData.room_no.trim();
      let selectedRoomId = formData.room_id === 'none' ? '' : formData.room_id;
      let targetRoom = selectedRoomId ? rooms.find(r => r.id === selectedRoomId) : undefined;

      if (typedRoomNo) {
        const matched = rooms.find(r => r.room_no.toLowerCase() === typedRoomNo.toLowerCase());
        if (matched) {
          selectedRoomId = matched.id;
          targetRoom = matched;
        } else {
          const { data: createdRoom, error: roomErr } = await persistRoom({
            hostel_id: hostel.id,
            room_no: typedRoomNo,
            floor: 0,
            room_type: 'single',
            beds: 1,
            rent_per_bed: Number(formData.monthly_rent) || 0,
          });
          if (roomErr) throw roomErr;
          if (!createdRoom) throw new Error('Could not create room. Please add it from the Rooms page first.');
          selectedRoomId = createdRoom.id;
          targetRoom = createdRoom as Room;
        }
      } else {
        selectedRoomId = '';
        targetRoom = undefined;
      }

      // Validation: Room capacity check when assigning to a room
      if (selectedRoomId && targetRoom) {
        const activeInRoom = tenants.filter(
          t => t.room_id === selectedRoomId && t.status === 'active' && t.id !== editingTenant?.id
        ).length;

        if (activeInRoom >= (targetRoom.beds || 1)) {
          throw new Error(`Room ${targetRoom.room_no} has reached maximum capacity of ${targetRoom.beds} beds.`);
        }
      }

      let photoUrl = editingTenant?.photo_url || '';
      let idDocUrl = editingTenant?.id_doc_url || '';

      if (photoFile) {
        photoUrl = await uploadFile(photoFile, 'photos');
      }

      if (idDocFile) {
        idDocUrl = await uploadFile(idDocFile, 'docs');
      }

      const payload = {
        hostel_id: hostel.id,
        full_name: formData.full_name,
        tenant_type: formData.tenant_type,
        institution: formData.institution,
        phone: formData.phone,
        id_card_no: formData.id_card_no,
        guardian_name: formData.guardian_name,
        guardian_phone: formData.guardian_phone,
        home_address: formData.home_address,
        room_id: selectedRoomId || null,
        join_date: formData.join_date,
        monthly_rent: Number(formData.monthly_rent),
        security_deposit: Number(formData.security_deposit),
        notes: formData.notes,
        photo_url: photoUrl,
        id_doc_url: idDocUrl,
      };

      if (editingTenant) {
        const { error } = await supabase.from('tenants').update(payload).eq('id', editingTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenants').insert({ ...payload, status: 'active' });
        if (error) throw error;
      }

      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Error saving tenant record');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Mark as Left Flow
  const handleConfirmLeave = async () => {
    if (!leavingTenant) return;
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          status: 'left',
          leave_date: leaveDate,
        })
        .eq('id', leavingTenant.id);

      if (error) throw error;
      setLeavingTenant(null);
      fetchData();
    } catch (err) {
      console.error('Failed to mark tenant as left:', err);
    }
  };

  // Delete Tenant Flow
  const handleDeleteTenant = async () => {
    if (!deletingTenantId) return;
    try {
      const { error } = await supabase.from('tenants').delete().eq('id', deletingTenantId);
      if (error) throw error;
      setDeletingTenantId(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete tenant:', err);
    }
  };

  // Filter logic
  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.phone.includes(search) ||
      (t.id_card_no && t.id_card_no.includes(search));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesRoom = roomFilter === 'all' || t.room_id === roomFilter;

    return matchesSearch && matchesStatus && matchesRoom;
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants Directory</h1>
          <p className="text-sm text-muted-foreground">Manage active residents, contact profiles, and room assignments.</p>
        </div>

        <Button onClick={handleOpenAdd} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" /> Add New Tenant
        </Button>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or ID card..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="left">Left Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Room Filter */}
          <div className="w-full md:w-48">
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rooms</SelectItem>
                {rooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>Room {r.room_no}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserMinus className="w-12 h-12 mx-auto stroke-1 opacity-40 mb-2" />
              <p>No tenants found matching your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Tenant</th>
                    <th className="px-6 py-4">Room</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Join Date</th>
                    <th className="px-6 py-4 text-right">Rent</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <div className="flex items-center gap-3">
                          {t.photo_url ? (
                            <img src={t.photo_url} alt={t.full_name} className="w-9 h-9 rounded-full object-cover border" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {t.full_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground">{t.full_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{t.tenant_type} {t.institution ? `• ${t.institution}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {t.room ? (
                          <Badge variant="outline" className="font-medium">Room {t.room.room_no}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{t.phone}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(t.join_date)}</td>
                      <td className="px-6 py-4 text-right font-semibold">
                        {formatCurrency(t.monthly_rent, currencySymbol)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={t.status === 'active' ? 'success' : 'secondary'}>
                          {t.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild title="View Profile">
                            <Link to={`/tenants/${t.id}`}>
                              <Eye className="w-4 h-4 text-slate-600" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(t)} title="Edit Tenant">
                            <Edit className="w-4 h-4 text-blue-600" />
                          </Button>
                          {t.status === 'active' && (
                            <Button variant="ghost" size="icon" onClick={() => setLeavingTenant(t)} title="Mark as Left">
                              <UserMinus className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}
                          {isOwner && (
                            <Button variant="ghost" size="icon" onClick={() => setDeletingTenantId(t.id)} title="Delete Record">
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

      {/* Add / Edit Tenant Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTenant ? 'Edit Tenant Profile' : 'Add New Resident'}</DialogTitle>
            <DialogDescription>Fill out tenant details, contact, and room assignment.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTenant} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-md">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0300-1234567"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant_type">Category</Label>
                <Select
                  value={formData.tenant_type}
                  onValueChange={(val: any) => setFormData({ ...formData, tenant_type: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="professional">Working Professional</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="institution">Institution / Workplace</Label>
                <Input
                  id="institution"
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  placeholder="University / Company Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="id_card_no">CNIC / ID Card No</Label>
                <Input
                  id="id_card_no"
                  value={formData.id_card_no}
                  onChange={(e) => setFormData({ ...formData, id_card_no: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_no">Assigned Room</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.room_id || ''}
                  onChange={(e) => {
                    const roomId = e.target.value;
                    const selRoom = rooms.find(r => r.id === roomId);
                    setFormData({
                      ...formData,
                      room_id: roomId,
                      room_no: selRoom ? selRoom.room_no : '',
                      monthly_rent: selRoom && !editingTenant ? selRoom.rent_per_bed : formData.monthly_rent,
                      security_deposit: selRoom && !editingTenant && formData.security_deposit === 0 ? selRoom.rent_per_bed : formData.security_deposit,
                    });
                  }}
                >
                  <option value="">Unassigned / type a new room below</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_no} ({r.room_type} · {formatCurrency(r.rent_per_bed, currencySymbol)})
                    </option>
                  ))}
                </select>
                <Input
                  id="room_no"
                  value={formData.room_no}
                  onChange={(e) => {
                    const roomNo = e.target.value;
                    const selRoom = rooms.find(r => r.room_no.toLowerCase() === roomNo.trim().toLowerCase());
                    setFormData({
                      ...formData,
                      room_no: roomNo,
                      room_id: selRoom ? selRoom.id : '',
                      monthly_rent: selRoom && !editingTenant ? selRoom.rent_per_bed : formData.monthly_rent,
                      security_deposit: selRoom && !editingTenant && formData.security_deposit === 0 ? selRoom.rent_per_bed : formData.security_deposit,
                    });
                  }}
                  placeholder="Type room number (e.g. 12)"
                />
                <p className="text-[11px] text-muted-foreground">
                  Pick an existing room or type a new number. Unknown room numbers are created automatically.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly_rent">Monthly Rent ({currencySymbol}) *</Label>
                <Input
                  id="monthly_rent"
                  type="number"
                  value={formData.monthly_rent}
                  onChange={(e) => setFormData({ ...formData, monthly_rent: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="security_deposit">Security Deposit ({currencySymbol})</Label>
                <Input
                  id="security_deposit"
                  type="number"
                  value={formData.security_deposit}
                  onChange={(e) => setFormData({ ...formData, security_deposit: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="join_date">Join Date *</Label>
                <Input
                  id="join_date"
                  type="date"
                  value={formData.join_date}
                  onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardian_name">Guardian Name</Label>
                <Input
                  id="guardian_name"
                  value={formData.guardian_name}
                  onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardian_phone">Guardian Phone</Label>
                <Input
                  id="guardian_phone"
                  value={formData.guardian_phone}
                  onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="home_address">Home Address</Label>
                <Input
                  id="home_address"
                  value={formData.home_address}
                  onChange={(e) => setFormData({ ...formData, home_address: e.target.value })}
                />
              </div>
            </div>

            {/* Document / Photo Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Tenant Photo</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>ID Document / CNIC Scan</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setIdDocFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Special Remarks</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingTenant ? 'Update Tenant' : 'Register Tenant'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mark as Left Dialog */}
      <Dialog open={!!leavingTenant} onOpenChange={(open) => !open && setLeavingTenant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Tenant as Left</DialogTitle>
            <DialogDescription>
              Record the departure date for <strong>{leavingTenant?.full_name}</strong>. This will free up their bed in Room {(leavingTenant?.room as any)?.room_no || 'N/A'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="leave_date">Departure Date</Label>
              <Input
                id="leave_date"
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLeavingTenant(null)}>Cancel</Button>
            <Button variant="warning" onClick={handleConfirmLeave}>
              Confirm Departure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deletingTenantId} onOpenChange={(open) => !open && setDeletingTenantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the tenant record and all payment history associated with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTenant} className="bg-red-600 hover:bg-red-700">
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
