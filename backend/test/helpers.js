import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

export async function startApi(t, db, options = {}) {
  const server = createApp({ db, logger: { error() {} }, ...options }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let cookie = ''; let csrf = '';
    async function request(path, { method = 'GET', body, raw, binary = false, headers = {}, status = 200 } = {}) {
      const response = await fetch(base + path, {
        method,
        headers: { 'X-Taskflow-Request':'1', ...(cookie ? {Cookie:cookie} : {}), ...(csrf ? {'X-CSRF-Token':csrf}:{}), ...(body !== undefined || raw !== undefined ? {'Content-Type':'application/json'}:{}), ...headers },
        body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined
      });
      request.lastResponse = response;
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      if (binary) { assert.equal(response.status,status); return Buffer.from(await response.arrayBuffer()); }
      const text = await response.text();
      assert.equal(response.status, status, `${method} ${path}: ${text}`);
      if (status === 204) { assert.equal(text, ''); return; }
      assert.match(response.headers.get('content-type'), /application\/json/);
      const data = JSON.parse(text);
      if (data.csrf) csrf = data.csrf;
      if (status >= 400) assert.equal(typeof data.error, 'string');
      return data;
    }
    request.newClient = client; request.base = base;
    return request;
  }
  return client();
}
