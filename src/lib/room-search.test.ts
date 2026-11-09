import { describe,it,expect } from 'vitest';
import { searchRooms } from './room-search';
const rooms=[{id:'1',name:'ห้องสวน',hotelName:'บ้านพักเชียงใหม่',province:'เชียงใหม่'},{id:'2',name:'Sea View',hotelName:'Andaman Stay',province:'ภูเก็ต'},{id:'3',name:'ห้องริมคลอง',hotelName:'เรือนพัก',province:'กรุงเทพมหานคร'}];
describe('room search and province filters',()=>{
  it('matches hotel, room and province with normalized case and whitespace',()=>{
    expect(searchRooms(rooms,'บ้านพัก','').map(r=>r.id)).toEqual(['1']);
    expect(searchRooms(rooms,'  SEA   andaman  ','').map(r=>r.id)).toEqual(['2']);
    expect(searchRooms(rooms,'กรุงเทพ','').map(r=>r.id)).toEqual(['3']);
    expect(searchRooms(rooms,'Ｓｅａ','').map(r=>r.id)).toEqual(['2']);
  });
  it('combines both filters and treats SQL/regex input as plain text',()=>{
    expect(searchRooms(rooms,'','ภูเก็ต').map(r=>r.id)).toEqual(['2']);
    expect(searchRooms(rooms,'ห้อง','ภูเก็ต')).toEqual([]);
    expect(searchRooms(rooms,"' OR 1=1 --",'')).toEqual([]);
    expect(searchRooms(rooms,'.*','')).toEqual([]);
    expect(searchRooms(rooms,'','ไม่มีจังหวัดนี้')).toEqual([]);
  });
  it('returns all original records for empty filters and does not mutate data',()=>{
    expect(searchRooms(rooms,'   ','')).toEqual(rooms); expect(searchRooms([],'','')).toEqual([]); expect(rooms).toHaveLength(3);
  });
});
