function blockKey(block) {
  return `${block.task_id}|${block.session_date}|${block.start_time}|${block.end_time}`;
}

export function needsPlanUpdate(plan, sessions) {
  const current = sessions.filter((session) =>
    session.status === "Planned" && `${session.session_date} ${session.start_time}` >= plan.cutoff
  );
  if (current.length !== plan.blocks.length) return true;
  const keys = new Set(current.map(blockKey));
  return plan.blocks.some((block) => !keys.has(blockKey(block)));
}

export async function loadPlanningEvents(from, to, loadEvents) {
  const results = [];
  let start = from;
  while (start < to) {
    const end = new Date(Math.min(+to, +start + 90 * 86400000));
    const { data } = await loadEvents(start.toISOString(), end.toISOString());
    results.push(...data.events);
    start = end;
  }
  return [...new Map(results.map((event) => [event.id, event])).values()];
}
