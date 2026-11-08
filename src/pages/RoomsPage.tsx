import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { roomPhoto } from '../lib/rooms';
import { PageState, RoomImage, Skeleton } from '../components/ui';

export function RoomsPage() {
  const query = useQuery({ queryKey: ['rooms'], queryFn: api.rooms });
  return <div className="content-wrap rooms-page">
    <div className="page-heading"><div><p className="eyebrow">FIND YOUR LITTLE ESCAPE</p><h1>เลือกห้องพัก<span className="brand-dot">.</span></h1><p className="intro">พื้นที่ที่ใช่ ในวันที่คุณอยากพัก</p></div><p className="small-meta">{query.data ? `${query.data.rooms.length} ห้องพัก` : 'กำลังโหลดห้องพัก'}<span>เลือกห้องเพื่อตรวจวันว่าง</span></p></div>
    {query.isPending ? <div className="rooms-grid" aria-label="กำลังโหลดห้องพัก">{Array.from({ length: 5 }, (_, i) => <Skeleton className="room-skeleton" key={i} />)}</div>
      : query.isError ? <PageState title="โหลดห้องพักไม่สำเร็จ" retry={() => query.refetch()}>{errorMessage(query.error)}</PageState>
        : !query.data.rooms.length ? <PageState title="ยังไม่มีห้องที่เปิดรับจอง" retry={() => query.refetch()}>ลองตรวจสอบอีกครั้ง หรือกลับมาภายหลัง</PageState>
          : <div className="rooms-grid">{query.data.rooms.map((room, index) => <Link className={`room-item ${index === 0 ? 'room-item-featured' : ''}`} to={`/rooms/${room.id}`} key={room.id}>
            <div className="room-image"><RoomImage src={roomPhoto(room.id)} alt={`ภาพประกอบ ${room.name}`} loading={index > 1 ? 'lazy' : 'eager'} /><span className="room-number">0{index + 1}</span><span className="room-image-action" aria-hidden="true"><ArrowUpRight size={22} /></span></div>
            <div className="room-caption"><h2>{room.name}</h2><span>ดูวันว่าง <ArrowUpRight size={15} /></span></div>
          </Link>)}</div>}
    <p className="image-disclaimer">ภาพประกอบสำหรับห้องพักตัวอย่าง · วันว่างอัปเดตจากระบบจอง</p>
  </div>;
}
