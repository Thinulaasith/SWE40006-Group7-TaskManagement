import test from 'node:test';
import assert from 'node:assert/strict';
import { deadline, selectTasks } from './task-utils.js';

test('deadline labels use local calendar dates, including month and year boundaries', () => {
  const now = new Date(2026, 11, 31, 23, 30);
  const task = { status: 'todo' };
  assert.equal(deadline(task, now).label, 'No due date');
  assert.equal(deadline({ ...task, due_date: '2026-12-30' }, now).label, 'Overdue');
  assert.equal(deadline({ ...task, due_date: '2026-12-31' }, now).label, 'Due today');
  assert.equal(deadline({ ...task, due_date: '2027-01-01' }, now).label, 'Due tomorrow');
  assert.equal(deadline({ ...task, due_date: '2027-01-02' }, now).label, 'Upcoming');
  const completed = deadline({ status: 'done', due_date: '2026-12-30' }, now);
  assert.equal(completed.tone, 'neutral');
  assert.equal(completed.label, 'Due date');
  assert.ok(completed.date);
  assert.equal(deadline({ ...task, due_date: '2026-10-05' }, new Date(2026, 9, 4, 23, 30)).label, 'Due tomorrow');
});

const tasks = [
  { id: '1', title: 'Plan release', description: 'Write docs', priority: 'low', status: 'todo', due_date: '2026-10-20', created_at: '2026-10-18T01:00:00Z' },
  { id: '2', title: 'Review', description: 'Release checklist', priority: 'high', status: 'in_progress', due_date: null, created_at: '2026-10-19T01:00:00Z' },
  { id: '3', title: 'Ship release', description: '', priority: 'medium', status: 'done', due_date: '2026-10-18', created_at: '2026-10-19T01:00:00Z' }
];
const ids = list => list.map(task => task.id);
test('status, priority and case-insensitive search combine without mutating tasks', () => {
  assert.deepEqual(ids(selectTasks(tasks, { query: ' RELEASE ' })), ['3', '2', '1']);
  assert.deepEqual(ids(selectTasks(tasks, { query: 'release', priority: 'high', status: 'in_progress' })), ['2']);
  assert.deepEqual(selectTasks(tasks, { priority: 'low', status: 'done' }), []);
  assert.deepEqual(ids(tasks), ['1', '2', '3']);
});
test('sorting is deterministic and places tasks without dates last', () => {
  assert.deepEqual(ids(selectTasks(tasks, { sort: 'newest' })), ['3', '2', '1']);
  assert.deepEqual(ids(selectTasks(tasks, { sort: 'priority' })), ['2', '3', '1']);
  assert.deepEqual(ids(selectTasks(tasks, { sort: 'due' })), ['3', '1', '2']);
});
