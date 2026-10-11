import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, getCurrencySymbol } from '@/lib/utils';
import type { Room, Tenant, RoomType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, DoorOpen, Bed, Users, Edit, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Rooms() {
  const { hostel, isOwner } = useAuth();
  const currencySymbol = hostel?.currency_symbol || getCurrencySymbol();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Form input
  const [formData, setFormData] = useState({
    room_no: '',
    floor: 'Ground',
    room_type: 'single' as RoomType,
    beds: 1,
    rent_per_bed: 0,
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRoomsData = useCallback(async () => {
    if (!hostel?.id) return;
    setLoading(true);

    try {
      // Fetch rooms
      const { data: roomsData, error: roomsErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('hostel_id', hostel.id)
        .order('room_no');

      if (roomsErr) throw roomsErr;

      // Fetch active tenants to compute occupancy per room
      const { data: activeTenants, error: tenantsErr } = await supabase
        .from('tenants')
        .select('*')
        .eq('hostel_id', hostel.id)
        .eq('status', 'active');

      if (tenantsErr) throw tenantsErr;

      setTenants((activeTenants as Tenant[]) || []);

      // Attach active occupants to each room
      const enrichedRooms = (roomsData || []).map((r: Room) => {
        const roomOccupants = (activeTenants || []).filter((t: Tenant) => t.room_id === r.id);
        return {
          ...r,
          occupants: roomOccupants,
          occupied_beds: roomOccupants.length,
        };
      });

      setRooms(enrichedRooms);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [hostel?.id]);

  useEffect(() => {
    fetchRoomsData();
  }, [fetchRoomsData]);

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormData({
      room_no: '',
      floor: 'Ground',
      room_type: 'single',
      beds: 1,
      rent_per_bed: 5000,
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      room_no: room.room_no,
      floor: room.floor || 'Ground',
      room_type: room.room_type,
      beds: room.beds,
      rent_per_bed: room.rent_per_bed,
      notes: room.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostel?.id) return;
    setSubmitting(true);
    setFormError(null);

    try {
      // Check duplicate room_no within hostel
      const existing = rooms.find(
        r => r.room_no.toLowerCase() === formData.room_no.trim().toLowerCase() && r.id !== editingRoom?.id
      );
      if (existing) {
        throw new Error(`Room number "${formData.room_no}" already exists in this hostel.`);
      }

      const payload = {
        hostel_id: hostel.id,
        room_no: formData.room_no.trim(),
        floor: formData.floor,
        room_type: formData.room_type,
        beds: Number(formData.beds),
        rent_per_bed: Number(formData.rent_per_bed),
        notes: formData.notes,
      };

      if (editingRoom) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', editingRoom.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rooms').insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchRoomsData();
    } catch (err: any) {
      setFormError(err.message || 'Error saving room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoomId) return;
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', deletingRoomId);
      if (error) throw error;
      setDeletingRoomId(null);
      fetchRoomsData();
    } catch (err) {
      console.error('Error deleting room:', err);
    }
  };

  // Helper for room badge variant
  const getRoomBadge = (occupied: number, total: number) => {
    if (occupied === 0) return { label: 'EMPTY', variant: 'secondary' as const };
    if (occupied >= total) return { label: 'FULL', variant: 'danger' as const };
    return { label: 'AVAILABLE', variant: 'success' as const };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms & Bed Layout</h1>
          <p className="text-sm text-muted-foreground">Manage room allocation, bed capacity, and monthly rates.</p>
        </div>

        <Button onClick={handleOpenAdd} className="gap-2 font-semibold">
          <Plus className="w-4 h-4" /> Add New Room
        </Button>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : rooms.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <DoorOpen className="w-12 h-12 mx-auto stroke-1 opacity-40 text-muted-foreground" />
            <h3 className="font-semibold text-base">No rooms added yet</h3>
            <p className="text-sm text-muted-foreground">Click "Add New Room" to start setting up your hostel layout.</p>
            <Button onClick={handleOpenAdd} className="mt-2">Add Room</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const occupied = room.occupied_beds || 0;
            const badge = getRoomBadge(occupied, room.beds);

            return (
              <Card key={room.id} className="relative flex flex-col justify-between overflow-hidden">
                <div>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <span>Room {room.room_no}</span>
                        <span className="text-xs font-normal text-muted-foreground">({room.floor} Floor)</span>
                      </CardTitle>
                      <CardDescription className="capitalize text-xs mt-0.5">{room.room_type} Room</CardDescription>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Bed Occupancy Slots Visualizer */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                        <span className="text-muted-foreground">Capacity ({occupied}/{room.beds} Beds)</span>
                        <span className="font-semibold text-primary">{formatCurrency(room.rent_per_bed, currencySymbol)} / bed</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: room.beds }).map((_, idx) => {
                          const isOccupied = idx < occupied;
                          const occupant = room.occupants?.[idx];

                          return (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                                isOccupied
                                  ? 'bg-primary/10 border-primary/30 text-primary'
                                  : 'bg-slate-50 dark:bg-slate-900 border-dashed text-slate-400'
                              }`}
                              title={occupant ? occupant.full_name : 'Vacant Bed'}
                            >
                              <Bed className="w-5 h-5 mb-0.5" />
                              <span className="text-[10px] font-semibold truncate max-w-full">
                                {occupant ? occupant.full_name.split(' ')[0] : 'Vacant'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Occupants list summary */}
                    {room.occupants && room.occupants.length > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Current Residents:</p>
                        {room.occupants.map((occ) => (
                          <div key={occ.id} className="flex items-center justify-between text-xs">
                            <Link to={`/tenants/${occ.id}`} className="font-medium hover:underline text-foreground">
                              {occ.full_name}
                            </Link>
                            <span className="text-muted-foreground">{occ.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Potential: <strong className="text-foreground">{formatCurrency(room.beds * room.rent_per_bed, currencySymbol)}</strong>
                  </p>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(room)}>
                      <Edit className="w-4 h-4 text-blue-600" />
                    </Button>
                    {isOwner && (
                      <Button variant="ghost" size="icon" onClick={() => setDeletingRoomId(room.id)}>
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Room Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
            <DialogDescription>Define room details, floor level, capacity, and bed rates.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRoom} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-md">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room_no">Room Number / Name *</Label>
                <Input
                  id="room_no"
                  value={formData.room_no}
                  onChange={(e) => setFormData({ ...formData, room_no: e.target.value })}
                  placeholder="e.g. 101"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="floor">Floor Level</Label>
                <Input
                  id="floor"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  placeholder="Ground / 1st / 2nd"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_type">Room Category</Label>
                <Select
                  value={formData.room_type}
                  onValueChange={(val: RoomType) => {
                    let defaultBeds = 1;
                    if (val === 'double') defaultBeds = 2;
                    if (val === 'triple') defaultBeds = 3;
                    if (val === 'dormitory') defaultBeds = 6;
                    setFormData({ ...formData, room_type: val, beds: defaultBeds });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Bed</SelectItem>
                    <SelectItem value="double">Double Sharing (2 Beds)</SelectItem>
                    <SelectItem value="triple">Triple Sharing (3 Beds)</SelectItem>
                    <SelectItem value="dormitory">Dormitory (4+ Beds)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="beds">Bed Capacity *</Label>
                <Input
                  id="beds"
                  type="number"
                  min={1}
                  value={formData.beds}
                  onChange={(e) => setFormData({ ...formData, beds: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rent_per_bed">Rent Per Bed ({currencySymbol}) *</Label>
              <Input
                id="rent_per_bed"
                type="number"
                min={0}
                value={formData.rent_per_bed}
                onChange={(e) => setFormData({ ...formData, rent_per_bed: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Attached bath, balcony, etc."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingRoom ? 'Update Room' : 'Save Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingRoomId} onOpenChange={(open) => !open && setDeletingRoomId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the room from the hostel layout. Active tenants in this room should be reassigned first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRoom} className="bg-red-600 hover:bg-red-700">
              Delete Room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
