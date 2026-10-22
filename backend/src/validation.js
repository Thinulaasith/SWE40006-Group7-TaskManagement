export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = message => { throw new HttpError(400, message); };
const priorities = ['low', 'medium', 'high'];
const statuses = ['todo', 'in_progress', 'done'];
const fields = ['title', 'description', 'priority', 'status', 'due_date', 'project_id', 'assignee_id', 'start_date'];

export function validateId(id) {
  if (typeof id !== 'string' || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) fail('Invalid ID.');
}

export function parseTask(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Request body must be a JSON object.');
  const result = {};
  const defaults = { description: '', priority: 'medium', status: 'todo', due_date: null, project_id: null, assignee_id: null, start_date: null };
  for (const field of fields) {
    if (partial && !Object.hasOwn(body, field)) continue;
    let value = body[field] === undefined ? defaults[field] : body[field];
    if (field === 'title') {
      if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > 150) fail('Title is required (maximum 150 characters).');
      value = value.trim();
    } else if (field === 'description') {
      if (typeof value !== 'string' || [...value].length > 2000) fail('Description must be 2000 characters or fewer.');
      value = value.trim();
    } else if (field === 'priority' && !priorities.includes(value)) {
      fail('Invalid priority. Use low, medium or high.');
    } else if (field === 'status' && !statuses.includes(value)) {
      fail('Invalid status. Use todo, in_progress or done.');
    } else if (field === 'due_date' || field === 'start_date') {
      if (value === '') value = null;
      if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || value.startsWith('0000') || Number.isNaN(Date.parse(value))
        || new Date(value).toISOString().slice(0, 10) !== value)) fail('Invalid due date (use YYYY-MM-DD, years 0001-9999).');
    }
    if (field === 'project_id' || field === 'assignee_id') {
      if (value === '') value = null;
      if (value !== null) { if (typeof value !== 'string') fail('IDs must be strings.'); validateId(value); }
    }
    if (typeof value === 'string' && value.includes('\u0000')) fail('Task fields cannot contain null characters.');
    result[field] = value;
  }
  if (partial && !Object.keys(result).length) fail('Provide at least one task field to update.');
  if (result.start_date && result.due_date && result.start_date > result.due_date) fail('Start date must be on or before the due date.');
  return result;
}

export function textInput(value, label, max, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.includes('\u0000') || [...value.trim()].length > max || (!optional && !value.trim())) fail(`${label} must be ${optional ? 'at most' : 'between 1 and'} ${max} characters.`);
  return value.trim();
}
export function emailInput(value) {
  const email = textInput(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
  return email;
}

export function parseFilters(query) {
  const result = {};
  for (const [field, allowed] of [['status', statuses], ['priority', priorities]]) {
    const value = query[field];
    if (value !== undefined && (typeof value !== 'string' || ![...allowed, 'all', ''].includes(value))) fail(`Invalid ${field} filter.`);
    result[field] = value;
  }
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 200 || query.q.includes('\u0000'))) fail('Search must be a string of at most 200 characters without null characters.');
  result.q = query.q?.trim();
  for (const field of ['limit', 'offset']) {
    const value = query[field];
    if (value === undefined) continue;
    const min = field === 'limit' ? 1 : 0;
    const max = field === 'limit' ? 100 : 2147483647;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))
      || Number(value) < min || Number(value) > max) fail(`${field} must be an integer between ${min} and ${max}.`);
    result[field] = Number(value);
  }
  return result;
}
