import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../lib/api';
import { setup,teardown,mount,room } from '../../test/support';
beforeEach(setup);afterEach(teardown);
const other={...room,id:'7c71298a-ef46-457c-ab5e-9edb238a5504',name:'Sea View',hotelName:'Andaman Stay',province:'ภูเก็ต'};
it('searches hotel names, combines province filtering and clears zero results',async()=>{
  vi.mocked(api.rooms).mockResolvedValue({rooms:[room,other]});mount();
  const search=await screen.findByLabelText('ค้นหาที่พัก'); await screen.findByRole('link',{name:/Sea View/});
  await userEvent.type(search,'Andaman'); expect(screen.queryByRole('link',{name:/บ้านพักหลัก/})).not.toBeInTheDocument(); expect(screen.getByRole('link',{name:/Sea View/})).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText('จังหวัด'),'เชียงใหม่'); expect(await screen.findByText('ไม่พบที่พักที่ตรงกับการค้นหา')).toBeVisible(); expect(screen.getAllByRole('button',{name:'ล้างตัวกรอง'})).toHaveLength(1);
  await userEvent.click(screen.getAllByRole('button',{name:'ล้างตัวกรอง'})[0]); expect(await screen.findByRole('link',{name:/บ้านพักหลัก/})).toBeVisible(); expect(screen.getByRole('link',{name:/Sea View/})).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText('จังหวัด'),'ภูเก็ต'); expect(screen.queryByRole('link',{name:/บ้านพักหลัก/})).not.toBeInTheDocument();
  await userEvent.clear(search); await userEvent.type(search,'Sea'); expect(screen.getByText('พบ 1 ห้องพัก')).toBeVisible();
  await userEvent.clear(search); await userEvent.selectOptions(screen.getByLabelText('จังหวัด'),''); expect(screen.getByRole('link',{name:/บ้านพักหลัก/})).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText('จังหวัด'),'ภูเก็ต'); await userEvent.click(screen.getByRole('link',{name:/Sea View/})); await screen.findByRole('heading',{name:'Sea View'}); await userEvent.click(screen.getByRole('link',{name:'ห้องพักทั้งหมด'})); await screen.findByRole('heading',{name:/เลือกห้องพัก/}); expect(screen.getByLabelText('จังหวัด')).toHaveValue('ภูเก็ต');
});
