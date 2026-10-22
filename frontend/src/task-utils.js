export const statusLabels = { todo: 'To do', in_progress: 'In progress', done: 'Completed' };
export const priorities = { low: 'Low', medium: 'Medium', high: 'High' };

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function deadline(task, now = new Date()) {
  if (!task.due_date) return { label: 'No due date', tone: 'neutral', date: '' };
  const date = new Date(`${task.due_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (task.status === 'done') return { label: 'Due date', tone: 'neutral', date };
  const today = localDateKey(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (task.due_date < today) return { label: 'Overdue', tone: 'overdue', date };
  if (task.due_date === today) return { label: 'Due today', tone: 'today', date };
  if (task.due_date === localDateKey(tomorrow)) return { label: 'Due tomorrow', tone: 'tomorrow', date };
  return { label: 'Upcoming', tone: 'neutral', date };
}

export function selectTasks(tasks, { status = 'all', priority = 'all', query = '', sort = 'newest' }) {
  const text = query.trim().toLowerCase();
  const selected = tasks.filter(task =>
    (status === 'all' || task.status === status) &&
    (priority === 'all' || task.priority === priority) &&
    `${task.title} ${task.description}`.toLowerCase().includes(text));
  const newest = (a, b) => new Date(b.created_at) - new Date(a.created_at) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  const rank = { high: 0, medium: 1, low: 2 };
  return selected.sort((a, b) => {
    if (sort === 'due') return (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99') || newest(a, b);
    if (sort === 'priority') return rank[a.priority] - rank[b.priority] || newest(a, b);
    return newest(a, b);
  });
}
