import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, passwordInput, digest, token, safeEqual } from '../src/security.js';
test('password hashing uses unique salts and rejects wrong passwords', async () => {
 const password='a-long-test-passphrase';
 const [a,b]=await Promise.all([hashPassword(password),hashPassword(password)]);
 assert.notEqual(a,b);assert.ok(!a.includes(password));
 assert.equal(await verifyPassword(password,a),true);
 assert.equal(await verifyPassword('incorrect-password',a),false);
 assert.throws(()=>passwordInput('short'),{status:400});
 assert.throws(()=>passwordInput('x'.repeat(129)),{status:400});
});
test('session tokens are random, hashable and compared without coercion',()=>{
 const a=token(),b=token();assert.equal(a.length,64);assert.notEqual(a,b);
 assert.notEqual(digest(a),a);assert.equal(safeEqual(a,a),true);assert.equal(safeEqual(a,b),false);assert.equal(safeEqual(a,''),false);
});
