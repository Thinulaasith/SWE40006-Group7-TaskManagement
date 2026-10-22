import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Flag, Link2 } from 'lucide-react';
import { localDate } from './api.js';
import { statusLabels } from './task-utils.js';
import { barBounds, dateNumber, dateString, dependencyPoints, orderedRows, roundedPath, ROW_HEIGHT, DAY } from './gantt-utils.js';
import './gantt.css';

const labelWidth = 256;
const shortDate = value => new Date(value + 'T00:00:00Z').toLocaleDateString(undefined,{day:'numeric',month:'short',timeZone:'UTC'});

export function GanttChart({tasks, milestones, origin, days, onOpen, onMilestone}) {
  const container = useRef(null);
  const [viewport,setViewport] = useState(0);
  const [hovered,setHovered] = useState(null), [focused,setFocused] = useState(null);
  const [connections,setConnections] = useState('all');
  const active = hovered || focused;
  const marker = useId().replaceAll(':','');
  useEffect(()=>{
    const observer = new ResizeObserver(([entry])=>setViewport(entry.contentRect.width));
    observer.observe(container.current);
    return ()=>observer.disconnect();
  },[]);
  const dayWidth = Math.max(days===28?34:days===56?26:22,(viewport-labelWidth-112)/days);
  const width = days*dayWidth+112;
  const rows = useMemo(()=>orderedRows(tasks,milestones,origin,days),[tasks,milestones,origin,days]);
  const byId = new Map(tasks.map(t=>[t.id,t]));
  const indexes = new Map(rows.filter(r=>r.kind==='task').map(r=>[r.item.id,rows.indexOf(r)]));
  const edges = [];
  rows.forEach((row,target)=>{
    if (row.kind!=='task') return;
    for (const id of row.item.dependency_ids || []) {
      if (!indexes.has(id)) continue;
      const source = indexes.get(id), predecessor = rows[source].item;
      const conflict = !!(predecessor.due_date && row.item.start_date && row.item.start_date<=predecessor.due_date);
      const points = dependencyPoints(rows,source,target,origin,days,dayWidth,edges.length);
      edges.push({id:id+'-'+row.item.id,source:rows[source],target:row,conflict,points,path:roundedPath(points)});
    }
  });
  const related = new Set(active?[active]:[]);
  edges.filter(edge=>edge.source.key===active||edge.target.key===active)
    .forEach(edge=>{related.add(edge.source.key);related.add(edge.target.key);});
  const activeRow = rows.find(row=>row.key===active);
  const dates = Array.from({length:days},(_,i)=>new Date((origin+i)*DAY));
  const months = [];
  dates.forEach(date=>{
    const label = date.toLocaleDateString(undefined,{month:'long',year:'numeric',timeZone:'UTC'});
    if(months.at(-1)?.label===label)months.at(-1).count++;
    else months.push({label,count:1});
  });
  const today = localDate(), todayIndex=dateNumber(today)-origin;
  const conflictCount=rows.filter(row=>row.kind==='task'&&(row.item.dependency_ids||[]).some(id=>{
    const prerequisite=byId.get(id);
    return prerequisite?.due_date&&row.item.start_date&&row.item.start_date<=prerequisite.due_date;
  })).length;
  return <div className="schedule-chart">
    <div className="schedule-summary">
      <div><strong>{shortDate(dateString(origin))} — {shortDate(dateString(origin+days-1))}</strong>
        <span>{rows.filter(r=>r.kind==='task').length} tasks · {rows.filter(r=>r.kind==='milestone').length} milestones</span></div>
      <label className="schedule-connection-control"><Link2 size={16}/>Connections
        <select value={connections} onChange={e=>setConnections(e.target.value)} aria-label="Show dependency connections">
          <option value="all">Show all</option><option value="focus">On hover / focus</option><option value="none">Hide</option>
        </select>
      </label>
    </div>
    <div className="schedule-scroll" ref={container} tabIndex={0} aria-label="Scrollable Gantt chart">
      <div className="schedule-grid" style={{width:labelWidth+width,gridTemplateColumns:`${labelWidth}px ${width}px`}}>
        <div className="schedule-heading"><span>PROJECT WORK</span><strong>Tasks & milestones</strong></div>
        <div className="schedule-axis">
          <div className="schedule-months" style={{paddingLeft:24}}>{months.map(month=><span key={month.label} style={{width:month.count*dayWidth}}>{month.label}</span>)}</div>
          <div className="schedule-days" style={{paddingLeft:24}}>
            {dates.map((date,i)=><div key={i} style={{width:dayWidth}} className={`${[0,6].includes(date.getUTCDay())?'weekend':''} ${dateString(origin+i)===today?'today':''}`}>
              <small>{date.toLocaleDateString(undefined,{weekday:'narrow',timeZone:'UTC'})}</small><b>{date.getUTCDate()}</b>
            </div>)}
          </div>
        </div>
        <div className="schedule-labels">{rows.map((row,i)=>{
          const task=row.item,conflict=row.kind==='task'&&(task.dependency_ids||[]).some(id=>byId.get(id)?.due_date&&task.start_date&&task.start_date<=byId.get(id).due_date);
          return <div key={row.key} className={`schedule-label ${related.has(row.key)?'is-related':''}`} style={{height:ROW_HEIGHT}}
            onMouseEnter={()=>setHovered(row.key)} onMouseLeave={()=>setHovered(null)}>
            <span className={`schedule-state state-${row.kind==='milestone'?'milestone':task.status}`}>{row.kind==='milestone'?<Flag size={14}/>:task.status==='done'?<Check size={14}/>:String(i+1).padStart(2,'0')}</span>
            <div><button onFocus={()=>setFocused(row.key)} onBlur={()=>setFocused(null)} title={task.title}
              onClick={()=>row.kind==='task'?onOpen(task):onMilestone(task)}>{task.title}</button>
              <small>{task.project_name||'Personal'} · {row.kind==='milestone'?(task.done?'Reached':'Milestone'):`${dateNumber(row.to)-dateNumber(row.from)+1}d`}</small>
            </div>{conflict&&<AlertTriangle className="schedule-alert" size={15} aria-label="Scheduling conflict"/>}
          </div>;
        })}</div>
        <div className="schedule-tracks" style={{width,height:Math.max(rows.length*ROW_HEIGHT,130)}}>
          {dates.map((date,i)=><div key={i} className={`schedule-column ${[0,6].includes(date.getUTCDay())?'weekend':''}`} style={{left:24+i*dayWidth,width:dayWidth}}/>)}
          {rows.map((row,i)=><div key={row.key} className={`schedule-row ${related.has(row.key)?'is-related':''}`} style={{top:i*ROW_HEIGHT,height:ROW_HEIGHT}}/>)}
          {todayIndex>=0&&todayIndex<days&&<div className="schedule-today" style={{left:24+(todayIndex+.5)*dayWidth}}><span>Today</span></div>}
          {connections!=='none'&&<svg className="schedule-links" width={width} height={rows.length*ROW_HEIGHT} aria-hidden="true">
            <defs>{['normal','conflict'].map(tone=><marker key={tone} id={`${marker}-${tone}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 L7 4 L1 7" className={`schedule-arrow arrow-${tone}`}/></marker>)}</defs>
            {edges.map(edge=>{
              const highlighted=edge.source.key===active||edge.target.key===active;
              if(connections==='focus'&&!highlighted)return null;
              return <g key={edge.id} className={`schedule-link ${edge.conflict?'has-conflict':''} ${highlighted?'is-active':active?'is-muted':''}`}>
                <title>{edge.source.item.title} → {edge.target.item.title}{edge.conflict?' — dates overlap':''}</title>
                <path className="link-halo" d={edge.path}/><path className="link-line" d={edge.path} markerEnd={`url(#${marker}-${edge.conflict?'conflict':'normal'})`}/>
                <circle cx={edge.points[0][0]} cy={edge.points[0][1]} r="3" className="link-origin"/>
              </g>;
            })}
          </svg>}
          {rows.map((row,i)=>{
            const bounds=barBounds(row,origin,days,dayWidth),task=row.item;
            const common={onMouseEnter:()=>setHovered(row.key),onMouseLeave:()=>setHovered(null),onFocus:()=>setFocused(row.key),onBlur:()=>setFocused(null)};
            if(row.kind==='milestone')return <button key={row.key} {...common} className={`schedule-milestone ${task.done?'reached':''}`} style={{left:(bounds.left+bounds.right)/2-11,top:i*ROW_HEIGHT+31}}
              onClick={()=>onMilestone(task)} aria-label={`${task.title}, milestone, ${shortDate(row.from)}, ${task.done?'reached':'planned'}`} title={`${task.title} · ${shortDate(row.from)}`}><span/></button>;
            return <button key={row.key} {...common} className={`schedule-bar bar-${task.status} ${related.has(row.key)?'is-related':''} ${active&&!related.has(row.key)?'is-muted':''}`}
              style={{left:bounds.left,width:bounds.right-bounds.left,top:i*ROW_HEIGHT+26}}
              onClick={()=>onOpen(task)} aria-label={`${task.title}, ${shortDate(row.from)} to ${shortDate(row.to)}, ${statusLabels[task.status]}`}
              title={`${task.title}\n${shortDate(row.from)} – ${shortDate(row.to)} · ${statusLabels[task.status]}`}>
              <span>{task.title}</span>{bounds.right-bounds.left>110&&<small>{dateNumber(row.to)-dateNumber(row.from)+1}d</small>}
            </button>;
          })}
          {!rows.length&&<div className="schedule-empty">No scheduled work in this date range.</div>}
        </div>
      </div>
    </div>
    <div className="schedule-footer">
      <div className="schedule-legend"><span><i className="legend-todo"/>To do</span><span><i className="legend-progress"/>In progress</span><span><i className="legend-done"/>Completed</span><span><i className="legend-milestone"/>Milestone</span><span><ArrowRight size={16}/>Dependency</span></div>
      {conflictCount>0&&<span className="schedule-conflict-note"><AlertTriangle size={14}/>{conflictCount} task{conflictCount===1?' has':'s have'} overlapping prerequisites</span>}
    </div>
    <div className="schedule-inspector">
      {activeRow?<><strong>{activeRow.item.title}</strong><span>{shortDate(activeRow.from)} – {shortDate(activeRow.to)}</span>
        {activeRow.kind==='task'&&<span>Prerequisites: {(activeRow.item.dependency_ids||[]).map(id=>byId.get(id)?.title).filter(Boolean).join(', ')||'None'}</span>}</>:
        <><Link2 size={16}/><span>Hover or focus a task to trace its connections. Click to open details.</span></>}
    </div>
  </div>;
}
