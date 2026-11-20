import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateStudyPlan, durationMinutes, studyTotals } from "../src/utils/calendarUtils.js";

const task = {
  id: 1, title: "Research assignment", priority: "High", status: "Incomplete",
  estimated_hours: 3, due_date: "2030-01-10 21:00:00",
};
const now = new Date(2030, 0, 7, 9);
const session = (status, completed_minutes, day = "07") => ({
  task_id: 1, session_date: `2030-01-${day}`, start_time: "08:00", end_time: "09:00",
  status, completed_minutes,
});

test("check-ins replan only the remaining minutes and update daily and weekly totals", () => {
  const history = [
    session("Complete", 60, "06"),
    session("Partially Complete", 25),
    { ...session("Missed", 0), start_time: "07:00", end_time: "08:00" },
  ];
  const plan = calculateStudyPlan([task], [], [], history, now);
  assert.equal(plan.blocks.reduce((total, block) => total + durationMinutes(block), 0), 95);
  assert.ok(plan.blocks.every((block) => block.session_date >= "2030-01-07"));
  assert.equal(plan.unscheduled.length, 0);
  const all = [...history, ...plan.blocks.map((block) => ({ ...block, status: "Planned", completed_minutes: 0 }))];
  assert.deepEqual(studyTotals(all, "2030-01-07", "2030-01-14"), { target: 120, completed: 25 });
  assert.deepEqual(studyTotals(all, "2030-01-06", "2030-01-07"), { target: 60, completed: 60 });
});

test("a past session stays available for check-in and missed time is replanned", () => {
  const oneHour = { ...task, estimated_hours: 1 };
  assert.equal(calculateStudyPlan([oneHour], [], [], [session("Planned", 0)], now).blocks.length, 0);
  assert.equal(calculateStudyPlan([oneHour], [], [], [session("Missed", 0)], now).blocks.length, 1);
});

test("unfinished work is reported when commitments leave no time before the deadline", () => {
  const sameDay = { ...task, due_date: "2030-01-07 10:00:00", estimated_hours: 1 };
  const busy = [{ type: "Lecture", day_of_week: 1, start_time: "08:00", end_time: "11:00" }];
  const plan = calculateStudyPlan([sameDay], busy, [], [session("Partially Complete", 20)], now);
  assert.equal(plan.blocks.length, 0);
  assert.equal(plan.unscheduled[0].minutes, 40);
});
