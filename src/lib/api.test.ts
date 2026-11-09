import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, errorMessage, request } from './api';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('API failure handling', () => {
  it('rejects malformed success data instead of rendering it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { rooms: null } }))));
    await expect(api.rooms()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects missing JSON and unexpected empty success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('broken')).mockResolvedValueOnce(new Response(null, { status: 204 })));
    await expect(api.rooms()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(api.rooms()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('handles malformed server errors and Retry-After safely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', fields: {}, message: {} } }), { status: 429, headers: { 'Retry-After': '30' } })));
    await expect(api.rooms()).rejects.toMatchObject({ code: 'RATE_LIMITED', fields: [], retryAfter: 30 });
  });
  it('turns a connection failure into a retryable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.rooms()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
  it('ends a stalled request after 15 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))));
    const result = expect(api.rooms()).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(15000); await result;
  });
  it('preserves caller cancellation rather than reporting a network failure', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))));
    const result = request('/rooms', { signal: controller.signal }); controller.abort();
    await expect(result).rejects.not.toBeInstanceOf(ApiError);
  });
});

describe('API contracts used by the UI', () => {
  const user = {id:'user',email:'test@example.com',fullName:'Test',createdAt:'2026-11-08T00:00:00Z'};
  const session = {user,sessionExpiresAt:'2026-11-15T00:00:00Z'};
  const body = {roomId:'room',checkIn:'2026-11-10',checkOut:'2026-11-12',guestName:'Test',guestPhone:'+66812345678',guestEmail:'test@example.com'};
  const booking = {...body,id:'booking',nights:2,status:'confirmed',createdAt:'2026-11-08T00:00:00Z'};
  it.each(['me','register','login','logout','calendar','book','lookup'] as const)('validates %s responses and sends cookie credentials', async operation => {
    const data = operation==='register'?{user}:operation==='me'||operation==='login'?session:operation==='calendar'?{roomId:'room',timezone:'Asia/Bangkok',today:'2026-11-08',from:'2026-11-01',to:'2027-01-01',bookingRules:{maxNights:30,maxAdvanceDays:365},bookedRanges:[]}:{booking};
    const fetch = vi.fn().mockResolvedValue(operation==='logout'?new Response(null,{status:204}):new Response(JSON.stringify({data})));vi.stubGlobal('fetch',fetch);
    if(operation==='me') await api.me();else if(operation==='register')await api.register({fullName:'Test',email:'test@example.com',password:'password-password'});else if(operation==='login')await api.login({email:'test@example.com',password:'password-password'});else if(operation==='logout')await api.logout();else if(operation==='calendar')await api.calendar('room','2026-11-01','2027-01-01');else if(operation==='book')await api.book(body,'request-key');else await api.bookingRequest('request-key');
    expect(fetch.mock.calls[0][1].credentials).toBe('include');
    if(operation==='book'){expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('request-key');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);}
    if(operation==='calendar')expect(fetch.mock.calls[0][0]).toContain('?from=2026-11-01&to=2027-01-01');
  });
  it('announces an expired session and keeps valid field errors only', async()=>{
    const listener=vi.fn();window.addEventListener('session-expired',listener);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'Expired',fields:[null,{field:1,message:'bad'},{field:'email',message:1},{field:'email',code:'INVALID',message:'Email error'}]}}),{status:401})));
    try{await expect(api.me()).rejects.toMatchObject({status:401,fields:[{field:'email',code:'INVALID',message:'Email error'}]});expect(listener).toHaveBeenCalledTimes(1);}finally{window.removeEventListener('session-expired',listener);}
  });
  it('renders rate limits and unknown errors as user-readable messages',()=>{
    expect(errorMessage(new ApiError(429,'RATE_LIMITED','Limited',[],30))).toContain('30 วินาที');expect(errorMessage(new ApiError(429,'RATE_LIMITED','Limited'))).toBe('Limited');expect(errorMessage(new Error('private'))).toBe('เกิดข้อผิดพลาด กรุณาลองใหม่');
  });
});


it('validates booking history responses and sends the pagination cursor',async()=>{
  const cursor='20000000-0000-4000-8000-000000000001';
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{bookings:[],nextCursor:null}}))); vi.stubGlobal('fetch',fetch);
  await expect(api.myBookings()).resolves.toEqual({bookings:[],nextCursor:null});
  fetch.mockResolvedValueOnce(new Response(JSON.stringify({data:{bookings:[],nextCursor:cursor}})));
  const controller=new AbortController(); await expect(api.myBookings(cursor,controller.signal)).resolves.toMatchObject({nextCursor:cursor});
  expect(fetch.mock.calls[1][0]).toContain('limit=20&cursor='+cursor); expect(fetch.mock.calls[1][1].credentials).toBe('include');
  for(const data of [{bookings:null,nextCursor:null},{bookings:[],nextCursor:42},{bookings:[],nextCursor:'invalid'},{bookings:[{status:'other'}],nextCursor:null}]) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({data}))); await expect(api.myBookings()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  }
});

it('does not show raw server diagnostics to users and sends cancellation without a body',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'INTERNAL_ERROR',message:'SQL stack password=secret',fields:[{field:'password',code:'SQL',message:'secret diagnostic'}]}}),{status:500})); vi.stubGlobal('fetch',fetch);
  await expect(api.cancelBooking('id/unsafe')).rejects.toMatchObject({message:'ระบบไม่สามารถดำเนินการได้ กรุณาลองใหม่',fields:[]});
  expect(fetch.mock.calls[0][0]).toContain('/bookings/id%2Funsafe/cancel'); expect(fetch.mock.calls[0][1].body).toBeUndefined();
  expect(fetch.mock.calls[0][1].credentials).toBe('include'); expect(fetch.mock.calls[0][1].method).toBe('POST');
});

it('requires hotel and province metadata in room responses',async()=>{
  const room={id:'room',name:'Room',hotelName:'Hotel',province:'เชียงใหม่'};
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data:{rooms:[room]}}))).mockResolvedValueOnce(new Response(JSON.stringify({data:{rooms:[{id:'room',name:'Room'}]}})));
  vi.stubGlobal('fetch',fetch); await expect(api.rooms()).resolves.toEqual({rooms:[room]}); await expect(api.rooms()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
});
