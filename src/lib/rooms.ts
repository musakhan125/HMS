import { supabase } from '@/lib/supabase';

/** Live rooms.floor is an integer (0 = Ground). */
export function parseFloorNumber(floor: string | number | null | undefined): number {
  if (typeof floor === 'number' && Number.isFinite(floor)) return Math.trunc(floor);
  const raw = String(floor ?? '').trim().toLowerCase();
  if (!raw || raw === 'ground' || raw === 'g' || raw === 'gf' || raw === 'ground floor') return 0;
  if (raw === 'basement' || raw === 'b') return -1;
  const digits = raw.match(/-?\d+/);
  if (digits) return parseInt(digits[0], 10);
  return 0;
}

export function formatFloorLabel(floor: string | number | null | undefined): string {
  if (typeof floor === 'string' && /[a-z]/i.test(floor) && !/^-?\d+$/.test(floor.trim())) {
    return floor;
  }
  const n = parseFloorNumber(floor);
  if (n === 0) return 'Ground';
  if (n === -1) return 'Basement';
  return String(n);
}

export function buildRoomRecord(input: {
  hostel_id: string;
  room_no: string | number;
  floor: string | number;
  room_type: string;
  beds: number;
  rent_per_bed: number;
}) {
  const roomNo = String(input.room_no).trim();
  return {
    hostel_id: input.hostel_id,
    room_no: /^\d+$/.test(roomNo) ? Number(roomNo) : roomNo,
    floor: parseFloorNumber(input.floor),
    room_type: input.room_type,
    beds: Number(input.beds) || 1,
    rent_per_bed: Number(input.rent_per_bed) || 0,
  };
}

export async function persistRoom(
  input: Parameters<typeof buildRoomRecord>[0],
  editingId?: string | null
) {
  const record = buildRoomRecord(input);
  if (editingId) {
    return supabase.from('rooms').update(record).eq('id', editingId).select().maybeSingle();
  }
  return supabase.from('rooms').insert(record).select().maybeSingle();
}
