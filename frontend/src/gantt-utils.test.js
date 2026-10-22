import test from 'node:test';
import assert from 'node:assert/strict';
import { barBounds, dateNumber, dependencyPoints, orderedRows, roundedPath, ROW_HEIGHT } from './gantt-utils.js';

const origin = dateNumber('2026-10-13');
const tasks = [
  {id:'3',title:'Release notes',project_id:'1',project_name:'Launch',start_date:'2026-10-17',due_date:'2026-10-21',dependency_ids:['2']},
  {id:'2',title:'Launch checklist',project_id:'1',project_name:'Launch',start_date:'2026-10-17',due_date:'2026-10-20',dependency_ids:['1']},
  {id:'1',title:'Design',project_id:'1',project_name:'Launch',start_date:'2026-10-15',due_date:'2026-10-18',dependency_ids:[]},
  {id:'4',title:'Review',project_id:'1',project_name:'Launch',start_date:'2026-10-14',due_date:'2026-10-24',dependency_ids:[]}
];
test('prerequisites precede their dependents even when their dates overlap',()=>{
  const rows=orderedRows(tasks,[],origin,28),ids=rows.map(r=>r.item.id);
  assert.ok(ids.indexOf('1')<ids.indexOf('2'));
  assert.ok(ids.indexOf('2')<ids.indexOf('3'));
  assert.equal(tasks[0].id,'3');
  const clipped=orderedRows(tasks,[],dateNumber('2026-10-22'),28);
  assert.deepEqual(clipped.map(r=>r.item.id),['4']);
});
test('dependency connections avoid unrelated task bars at every zoom level',()=>{
  const rows=tasks.map(t=>({kind:'task',item:t,from:t.start_date,to:t.due_date}));
  for(const dayWidth of [22,26,34,51]){
    for(const [source,target] of [[0,1],[0,3],[3,0],[1,3],[3,2]]){
      const points=dependencyPoints(rows,source,target,origin,28,dayWidth,5);
      assert.deepEqual(points[0],[barBounds(rows[source],origin,28,dayWidth).right,source*ROW_HEIGHT+42]);
      assert.deepEqual(points.at(-1),[barBounds(rows[target],origin,28,dayWidth).left,target*ROW_HEIGHT+42]);
      assert.ok(!roundedPath(points).includes('NaN'));
      for(let i=1;i<points.length;i++){
        const [x1,y1]=points[i-1],[x2,y2]=points[i];
        assert.ok(x1===x2||y1===y2,'Connections use horizontal or vertical segments');
        rows.forEach((row,index)=>{
          if(index===source||index===target)return;
          const {left,right}=barBounds(row,origin,28,dayWidth),top=index*ROW_HEIGHT+26,bottom=top+32;
          const hit=x1===x2
            ? x1>left&&x1<right&&Math.max(y1,y2)>top&&Math.min(y1,y2)<bottom
            : y1>top&&y1<bottom&&Math.max(x1,x2)>left&&Math.min(x1,x2)<right;
          assert.equal(hit,false,'A connection must not pass through another task');
        });
      }
    }
  }
});
test('clipped tasks stay inside the timeline and milestones stay with their project',()=>{
  const milestone={id:'9',project_id:'1',title:'Release',due_date:'2026-10-24'};
  const rows=orderedRows([...tasks,{id:'5',title:'Long task',start_date:'2026-09-01',due_date:'2026-12-31'}],[milestone],origin,28);
  const long=rows.find(r=>r.item.id==='5'),bounds=barBounds(long,origin,28,34);
  assert.equal(bounds.left,28);assert.equal(bounds.right,24+28*34-4);
  const milestoneIndex=rows.findIndex(r=>r.kind==='milestone');
  assert.equal(rows[milestoneIndex-1].item.project_id,'1');
});
