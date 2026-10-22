import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

// Mock the DB boundary so these tests cannot read or modify real user tasks.
const query = jest.fn();
jest.unstable_mockModule('../src/db.js', () => ({ pool: { query } }));
const { default: app, parseTask } = await import('../src/app.js');

const example = (overrides = {}) => ({
  id: '1', title: 'Demo task', description: '', priority: 'medium',
  status: 'todo', due_date: null, created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(), ...overrides
});

beforeEach(() => { query.mockReset(); });

describe('Task validation (unit)', () => {
  test('rejects missing, empty and long titles', () => {
    expect(parseTask({}).error).toMatch(/Title/);
    expect(parseTask({ title: '  ' }).error).toMatch(/Title/);
    expect(parseTask({ title: 'a'.repeat(151) }).error).toMatch(/Title/);
  });
  test('applies defaults and trims title', () => {
    expect(parseTask({ title: ' Hello ' }).data).toEqual(['Hello', '', 'medium', 'todo', null]);
  });
  test('rejects invalid description, priority and status', () => {
    expect(parseTask({ title: 'A', description: 99 }).error).toMatch(/Description/);
    expect(parseTask({ title: 'A', description: 'x'.repeat(2001) }).error).toMatch(/Description/);
    expect(parseTask({ title: 'A', priority: 'urgent' }).error).toMatch(/priority/);
    expect(parseTask({ title: 'A', status: 'unknown' }).error).toMatch(/status/);
  });
  test('validates real calendar dates and allows no due date', () => {
    expect(parseTask({ title: 'A', due_date: '2026-02-30' }).error).toMatch(/date/);
    expect(parseTask({ title: 'A', due_date: 'tomorrow' }).error).toMatch(/date/);
    expect(parseTask({ title: 'A', due_date: '' }).data[4]).toBeNull();
    expect(parseTask({ title: 'A', due_date: '2028-02-29' }).data[4]).toBe('2028-02-29');
  });
});

describe('Task REST API (Supertest with isolated mocked database)', () => {
  test('health endpoint checks database', async () => {
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });
  test('list returns rows; status/priority filters use parameterized SQL', async () => {
    query.mockResolvedValueOnce({ rows: [example()] });
    const res = await request(app).get('/api/tasks?status=todo&priority=medium');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('status = $1');
    expect(sql).toContain('priority = $2');
    expect(params).toEqual(['todo', 'medium']);
  });
  test('list with no filters and all filters', async () => {
    query.mockResolvedValue({ rows: [] });
    expect((await request(app).get('/api/tasks')).status).toBe(200);
    expect((await request(app).get('/api/tasks?status=all&priority=all')).status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([]);
  });
  test('invalid filters are rejected before querying', async () => {
    expect((await request(app).get('/api/tasks?status=bad')).status).toBe(400);
    expect((await request(app).get('/api/tasks?priority=bad')).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  test('create returns 201 and sends normalized values to DB', async () => {
    query.mockResolvedValueOnce({ rows: [example()] });
    const res = await request(app).post('/api/tasks').send({ title: ' Demo task ' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Demo task');
    expect(query.mock.calls[0][1]).toEqual(['Demo task', '', 'medium', 'todo', null]);
  });
  test('invalid creation returns 400 without querying', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  test('update returns updated row', async () => {
    query.mockResolvedValueOnce({ rows: [example({ status: 'done' })] });
    const res = await request(app).put('/api/tasks/1').send({ title: 'Demo task', status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(query.mock.calls[0][1]).toEqual(['Demo task', '', 'medium', 'done', null, '1']);
  });
  test('update validates ID, body and missing record', async () => {
    expect((await request(app).put('/api/tasks/abc').send({ title: 'A' })).status).toBe(400);
    expect((await request(app).put('/api/tasks/1').send({ title: '' })).status).toBe(400);
    query.mockResolvedValueOnce({ rows: [] });
    expect((await request(app).put('/api/tasks/999').send({ title: 'A' })).status).toBe(404);
  });
  test('delete returns 204', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/tasks/1');
    expect(res.status).toBe(204);
    expect(query.mock.calls[0][1]).toEqual(['1']);
  });
  test('delete validates ID and missing record', async () => {
    expect((await request(app).delete('/api/tasks/not-a-number')).status).toBe(400);
    query.mockResolvedValueOnce({ rowCount: 0 });
    expect((await request(app).delete('/api/tasks/999')).status).toBe(404);
  });
  test('database errors return safe 500 response', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      query.mockRejectedValueOnce(new Error('internal connection string secret'));
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Database or server error.');
      expect(JSON.stringify(res.body)).not.toContain('secret');
    } finally { spy.mockRestore(); }
  });
});
