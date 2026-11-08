// Only the opaque request UUID is persisted; guest details stay in memory.
const memory = new Map<string, string>();
const slot = (userId: string, roomId: string) => `booking-request:${userId}:${roomId}`;
export function readBookingRequest(userId: string, roomId: string): string | null {
  const name = slot(userId, roomId);
  let key: string | null;
  try { key = sessionStorage.getItem(name) ?? memory.get(name) ?? null; } catch { key = memory.get(name) ?? null; }
  return key && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key) ? key.toLowerCase() : null;
}
export function saveBookingRequest(userId: string, roomId: string, key: string) {
  const name = slot(userId, roomId); memory.set(name, key);
  try { sessionStorage.setItem(name, key); } catch { /* Recovery in this mounted app still works without browser storage. */ }
}
export function clearBookingRequest(userId: string, roomId: string) {
  const name = slot(userId, roomId); memory.delete(name);
  try { sessionStorage.removeItem(name); } catch { /* Storage may be disabled. */ }
}
