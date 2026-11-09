import type { Room } from './types';
const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('th');
export function searchRooms(rooms: Room[], search: string, province: string): Room[] {
  const words = normalize(search).split(' ').filter(Boolean);
  return rooms.filter(room => (!province || room.province === province)
    && words.every(word => normalize(`${room.hotelName} ${room.name} ${room.province}`).includes(word)));
}
