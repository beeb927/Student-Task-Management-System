import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringSchedulesForDay, eventsForDay, generateTaskSegments, dbDayOfWeek } from '../src/utils/calendarUtils.js';
const sleep = {id: 1, type: 'Sleep', title: 'Sleep', day_of_week: 7, start_time: '23:00:00', end_time: '07:00:00'};
test('Sunday sleep splits into Sunday and Monday, including calendar events', () => {
  const sun = new Date(2030, 0, 6), mon = new Date(2030, 0, 7);
  assert.equal(recurringSchedulesForDay(sun,[sleep])[0].end_time,'24:00');
  assert.equal(recurringSchedulesForDay(mon,[sleep])[0].start_time,'00:00');
  assert.equal(eventsForDay(mon,[],[sleep])[0].data.end_time,'07:00:00');
  assert.equal(recurringSchedulesForDay(new Date(2030,0,8),[sleep]).length,0);
});
test('midnight end produces no zero-duration following-day event', () => {
  assert.equal(recurringSchedulesForDay(new Date(2030,0,7),[{...sleep,end_time:'00:00:00'}]).length,0);
});
test('same-day schedules remain unchanged', () => {
 const item={...sleep,start_time:'00:00:00'};
 assert.deepEqual(recurringSchedulesForDay(new Date(2030,0,6),[item]),[item]);
});
test('scheduler avoids both overnight portions', () => {
 const day = new Date(2030,0,7);
 const task = {id: 1, status:'Incomplete', priority:'High',estimated_hours: 1,created_at:'2030-01-07 08:00:00',due_date:'2030-01-07 22:00:00'};
 const schedules=[{...sleep,day_of_week:dbDayOfWeek(day),start_time:'18:00:00',end_time:'09:00:00'}, {...sleep,start_time:'23:00:00',end_time:'18:00:00'}];
 assert.equal(generateTaskSegments(task,schedules,[],[],{ now: new Date(2030,0,7,8) }).length,0);
 const segments=generateTaskSegments(task,[schedules[0]],[],[],{ now: new Date(2030,0,7,8) });
 assert.equal(segments.length,1);
 assert.ok(segments[0].end_time <= '18:00');
});
