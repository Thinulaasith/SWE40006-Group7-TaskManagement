import test from 'node:test';
import assert from 'node:assert/strict';
import { csvText } from './report-utils.js';
test('CSV preserves quoted text and neutralizes spreadsheet formulas',()=>{
  assert.equal(csvText([['Task','Notes'],['plan, review','Say "ready"\nnext']]),'"Task","Notes"\r\n"plan, review","Say ""ready""\nnext"');
  for(const value of ['=SUM(A1:A2)',' +1','-2','@SUM(A1)','\tvalue','\rvalue','\nvalue'])assert.ok(csvText([[value]]).startsWith('"\''));
  assert.equal(csvText([[null,0,'ordinary']]),'"","0","ordinary"');
});
