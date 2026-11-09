import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { roomPhoto } from '../lib/rooms';
import { Button, PageState, RoomImage, Skeleton } from '../components/ui';
import { searchRooms } from '../lib/room-search';

export function RoomsPage() {
  const query = useQuery({ queryKey: ['rooms'], queryFn: api.rooms });
  const [params, setParams] = useSearchParams();
  const search = (params.get('q') ?? '').slice(0, 100),
    province = params.get('province') ?? '';
  const rooms = query.data?.rooms ?? [];
  const provinces = [...new Set(rooms.map(room => room.province))].sort((a, b) =>
    a.localeCompare(b, 'th'),
  );
  const filtered = searchRooms(rooms, search, province);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function clear() {
    const next = new URLSearchParams(params);
    next.delete('q');
    next.delete('province');
    setParams(next, { replace: true });
  }
  return (
    <div className="content-wrap rooms-page">
      <div className="page-heading">
        <div>
          <h1>
            เลือกห้องพัก<span className="brand-dot">.</span>
          </h1>
        </div>
      </div>
      <section className="stay-filters" aria-label="ค้นหาและกรองที่พัก">
        <div className="field">
          <label htmlFor="stay-search">ค้นหาที่พัก</label>
          <input
            id="stay-search"
            type="search"
            placeholder="ชื่อโรงแรม ห้องพัก หรือจังหวัด"
            value={search}
            maxLength={100}
            onChange={event => change('q', event.target.value)}
            disabled={!query.data}
          />
        </div>
        <div className="field">
          <label htmlFor="stay-province">จังหวัด</label>
          <select
            id="stay-province"
            value={province}
            onChange={event => change('province', event.target.value)}
            disabled={!query.data}
          >
            <option value="">ทุกจังหวัด</option>
            {province && !provinces.includes(province) && (
              <option value={province}>{province} (ไม่พบที่พัก)</option>
            )}
            {provinces.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {(search || province) && (
          <Button variant="text" onClick={clear}>
            ล้างตัวกรอง
          </Button>
        )}
      </section>
      {query.data && (
        <p className="search-count" role="status">
          พบ {filtered.length} ห้องพัก
        </p>
      )}
      {query.isPending ? (
        <div className="rooms-grid" aria-label="กำลังโหลดห้องพัก">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton className="room-skeleton" key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <PageState title="โหลดห้องพักไม่สำเร็จ" retry={() => query.refetch()}>
          {errorMessage(query.error)}
        </PageState>
      ) : !query.data.rooms.length ? (
        <PageState title="ยังไม่มีห้องที่เปิดรับจอง" retry={() => query.refetch()}>
          ลองตรวจสอบอีกครั้ง หรือกลับมาภายหลัง
        </PageState>
      ) : !filtered.length ? (
        <PageState title="ไม่พบที่พักที่ตรงกับการค้นหา">ลองเปลี่ยนคำค้นหรือจังหวัด</PageState>
      ) : (
        <div className="rooms-grid">
          {filtered.map((room, index) => (
            <Link
              className={`room-item ${index === 0 ? 'room-item-featured' : ''}`}
              to={`/rooms/${room.id}`}
              state={{ fromSearch: params.toString() }}
              key={room.id}
            >
              <div className="room-image">
                <RoomImage
                  src={roomPhoto(room.id)}
                  alt={`ภาพประกอบ ${room.name}`}
                  loading={index > 1 ? 'lazy' : 'eager'}
                />
              </div>
              <div className="room-caption">
                <h2>{room.name}</h2>
                <span>
                  ดูวันว่าง <ArrowUpRight size={15} />
                </span>
              </div>
              <p className="room-location">
                {room.hotelName} · {room.province}
              </p>
            </Link>
          ))}
        </div>
      )}
      <p className="image-disclaimer">ที่พักสมมติและภาพประกอบสำหรับสาธิต</p>
    </div>
  );
}
