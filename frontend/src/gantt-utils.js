export const DAY = 86400000;
export const ROW_HEIGHT = 84;
export const dateNumber = value => Date.parse(value + 'T00:00:00Z') / DAY;
export const dateString = value => new Date(value * DAY).toISOString().slice(0, 10);

// Sort prerequisites before dependents, keeping each project's work together.
export function orderedRows(tasks, milestones, origin, days) {
  const end = origin + days - 1;
  const visible = tasks.filter(t => (t.start_date || t.due_date)
    && dateNumber(t.due_date || t.start_date) >= origin
    && dateNumber(t.start_date || t.due_date) <= end);
  const byId = new Map(visible.map(task => [task.id, task]));
  const sorted = [...visible].sort((a, b) =>
    (a.project_name || 'Personal').localeCompare(b.project_name || 'Personal')
    || (a.start_date || a.due_date).localeCompare(b.start_date || b.due_date)
    || a.title.localeCompare(b.title));
  const visited = new Set(), result = [];
  function visit(task) {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    for (const id of task.dependency_ids || []) if (byId.has(id)) visit(byId.get(id));
    result.push({kind:'task', key:'t' + task.id, item:task,
      from:task.start_date || task.due_date, to:task.due_date || task.start_date});
  }
  sorted.forEach(visit);
  for (const milestone of milestones) {
    if (dateNumber(milestone.due_date) < origin || dateNumber(milestone.due_date) > end) continue;
    const row = {kind:'milestone', key:'m' + milestone.id, item:milestone,
      from:milestone.due_date, to:milestone.due_date};
    const last = result.findLastIndex(r => r.item.project_id === milestone.project_id);
    result.splice(last < 0 ? result.length : last + 1, 0, row);
  }
  return result;
}

export function barBounds(row, origin, days, dayWidth) {
  const left = 24 + Math.max(0, dateNumber(row.from) - origin) * dayWidth + 4;
  const right = 24 + Math.min(days, dateNumber(row.to) - origin + 1) * dayWidth - 4;
  return {left, right};
}

// Elbows travel through the space between rows. Longer links use a clear
// channel beyond every bar they pass, rather than crossing another task.
export function dependencyPoints(rows, source, target, origin, days, dayWidth, lane = 0) {
  const a = barBounds(rows[source], origin, days, dayWidth);
  const b = barBounds(rows[target], origin, days, dayWidth);
  const y1 = source * ROW_HEIGHT + 42, y2 = target * ROW_HEIGHT + 42;
  const direction = target > source ? 1 : -1;
  const exit = a.right + 10, entry = b.left - 12;
  if (Math.abs(target - source) === 1) {
    const gap = direction > 0 ? (source + 1) * ROW_HEIGHT : source * ROW_HEIGHT;
    return [[a.right,y1],[exit,y1],[exit,gap],[entry,gap],[entry,y2],[b.left,y2]];
  }
  const top = Math.min(source,target), bottom = Math.max(source,target);
  const rail = Math.max(...rows.slice(top,bottom + 1).map(row =>
    barBounds(row,origin,days,dayWidth).right)) + 24 + lane % 6 * 9;
  const sourceGap = direction > 0 ? (source + 1) * ROW_HEIGHT : source * ROW_HEIGHT;
  const targetGap = direction > 0 ? target * ROW_HEIGHT : (target + 1) * ROW_HEIGHT;
  return [[a.right,y1],[exit,y1],[exit,sourceGap],[rail,sourceGap],
    [rail,targetGap],[entry,targetGap],[entry,y2],[b.left,y2]];
}

export function roundedPath(points, radius = 5) {
  let path = `M ${points[0].join(' ')}`;
  for (let i=1; i<points.length-1; i++) {
    const [x,y] = points[i], [px,py] = points[i-1], [nx,ny] = points[i+1];
    const before = Math.hypot(x-px,y-py), after = Math.hypot(nx-x,ny-y);
    if (!before || !after) continue;
    const r = Math.min(radius,before/2,after/2);
    path += ` L ${x-(x-px)/before*r} ${y-(y-py)/before*r} Q ${x} ${y} ${x+(nx-x)/after*r} ${y+(ny-y)/after*r}`;
  }
  return path + ` L ${points.at(-1).join(' ')}`;
}
