// Presentation metadata only. Availability and room identities always come from the API.
const photos: Record<string, { image: string; caption: string }> = {
  '7c71298a-ef46-457c-ab5e-9edb238a54e5': { image: '/images/main.jpg', caption: 'บ้านพักหลัก' },
  '7c71298a-ef46-457c-ab5e-9edb238a54e6': { image: '/images/garden.jpg', caption: 'ห้องสวน' },
  '7c71298a-ef46-457c-ab5e-9edb238a54e7': { image: '/images/balcony.jpg', caption: 'ห้องระเบียง' },
  '7c71298a-ef46-457c-ab5e-9edb238a54e8': { image: '/images/morning.jpg', caption: 'ห้องแสงเช้า' },
  '7c71298a-ef46-457c-ab5e-9edb238a54e9': { image: '/images/quiet.jpg', caption: 'ห้องมุมสงบ' },
};
const extraPhotos = ['garden', 'balcony', 'quiet', 'morning', 'quiet', 'garden', 'quiet'];
for (let i = 0; i < 7; i++)
  photos['7c71298a-ef46-457c-ab5e-9edb238a55' + String(i).padStart(2, '0')] = {
    image: '/images/' + extraPhotos[i] + '.jpg',
    caption: 'ภาพประกอบที่พัก',
  };
export function roomPhoto(id: string) {
  return photos[id]?.image ?? '/images/main.jpg';
}
