import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Plus, Search, CheckCircle2, Circle, Clock3, ListTodo, X, RefreshCcw, CalendarDays, Layers3, Menu, SlidersHorizontal, ArrowUpDown, Columns3, FolderOpen, Users, Bell, Settings, LogOut } from 'lucide-react';
import { priorities, selectTasks, statusLabels } from './task-utils.js';
import { api, json, localDate, setCsrf } from './api.js';
import { Dialog, ErrorMessage, TaskModal, DeleteDialog, TaskCard } from './ui.jsx';
import { AuthScreen, AccountSettings, useTheme } from './account.jsx';
import { Projects, Team, TaskDetails, Notifications } from './collaboration.jsx';
import { Files, Analytics, Administration, Activity } from './management.jsx';
import { Timeline } from './planning.jsx';
import { Kanban, Calendar } from './views.jsx';

const navigation = [ ['dashboard','Dashboard',LayoutDashboard], ['list','Task list',ListTodo], ['board','Kanban board',Columns3], ['calendar','Calendar',CalendarDays], ['timeline','Timeline',CalendarDays], ['files','Files',FolderOpen], ['analytics','Analytics',LayoutDashboard], ['activity','Activity',ListTodo], ['admin','Administration',Users], ['projects','Projects',FolderOpen], ['team','Team',Users], ['notifications','Notifications',Bell], ['settings','Account settings',Settings] ];
const summaries = [ ['all','Total tasks',ListTodo,'blue'], ['todo','To do',Circle,'purple'], ['in_progress','In progress',Clock3,'amber'], ['done','Completed',CheckCircle2,'green'] ];
function Sidebar({ user, view, navigate, unread, onLogout, busy }) {
  return <><div className="brand"><div className="brand-symbol"><Layers3 size={24}/></div><div><strong>taskflow<span>.</span></strong><small>YOUR WORKSPACE</small></div></div><div className="side-section-label">WORKSPACE</div><nav aria-label="Main navigation">{navigation.filter(([id])=>id!=='admin'||user.role==='admin').map(([id,label,Icon])=><button key={id} className={`nav-link ${view===id?'nav-active':''}`} aria-current={view===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={18}/><span>{label}</span>{id==='notifications'&&unread>0&&<span className="nav-count">{unread}</span>}</button>)}</nav><div className="side-bottom"><div className="avatar">{user.name.slice(0,2).toUpperCase()}</div><div className="user-label"><strong>{user.name}</strong><small>Personal workspace</small></div></div><button className="nav-link logout" disabled={busy} onClick={onLogout}><LogOut size={17}/>Sign out</button></>;
}
export default function App() {
  const [user,setUser] = useState(null); const [booting,setBooting] = useState(true); const [authError,setAuthError] = useState('');
  useTheme(user?.theme || 'system');
  useEffect(()=>{
    let active=true;
    api('/auth/me').then(result=>{if(active){setCsrf(result.csrf);setUser(result.user);}}).catch(error=>{if(active&&error.status!==401)setAuthError(error.message);}).finally(()=>{if(active)setBooting(false);});
    const expired=()=>{setCsrf('');setUser(null);setAuthError('Your session ended. Please sign in again.');};
    window.addEventListener('session-expired',expired);
    return()=>{active=false;window.removeEventListener('session-expired',expired);};
  },[]);
  if(booting)return <main className="boot-screen" role="status"><RefreshCcw className="spinner"/><p>Opening your workspace...</p></main>;
  if(!user)return <AuthScreen initialError={authError} onSignedIn={value=>{setAuthError('');setUser(value);}}/>;
  return <Workspace key={user.id} user={user} onUser={setUser} onSignedOut={()=>{setCsrf('');setAuthError('');setUser(null);}}/>;
}
function Workspace({ user, onUser, onSignedOut }) {
  const [tasks,setTasks] = useState([]); const [projects,setProjects] = useState([]); const [notifications,setNotifications] = useState([]);
  const [view,setView] = useState('dashboard'); const [loading,setLoading] = useState(true); const [error,setError] = useState('');
  const [filter,setFilter] = useState('all'); const [priority,setPriority] = useState('all'); const [sort,setSort] = useState('newest'); const [query,setQuery] = useState(''); const [projectId,setProjectId] = useState('all'); const [assigned,setAssigned] = useState(false);
  const [modal,setModal] = useState(undefined); const [deleting,setDeleting] = useState(null); const [detail,setDetail] = useState(null); const [dialogError,setDialogError] = useState(''); const [busy,setBusy] = useState(false); const [toast,setToast] = useState(null); const [menuOpen,setMenuOpen] = useState(false); const [now,setNow] = useState(()=>new Date());
  const requestVersion=useRef(0); const operationPending=useRef(false);
  const notify=message=>setToast({message,id:Date.now()});
  const refresh=useCallback(async (foreground=false)=>{
    const version=++requestVersion.current;
    if(foreground)setLoading(true);
    try {
      await api('/notifications/sync',json('POST',{date:localDate()}));
      const [nextTasks,nextProjects,nextNotes]=await Promise.all([api('/tasks'),api('/projects'),api('/notifications')]);
      if(version===requestVersion.current){setTasks(nextTasks);setProjects(nextProjects);setNotifications(nextNotes);setError('');setNow(new Date());}
    }catch(failure){if(version===requestVersion.current)setError(failure.message);}
    finally{if(version===requestVersion.current)setLoading(false);}
  },[]);
  useEffect(()=>{
    refresh(true); const timer=setInterval(()=>{if(!document.hidden&&!operationPending.current)refresh();},15000);
    const focus=()=>{if(!operationPending.current)refresh();};window.addEventListener('focus',focus);
    return()=>{requestVersion.current++;clearInterval(timer);window.removeEventListener('focus',focus);};
  },[refresh]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),6000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{if(projectId!=='all'&&projectId!=='personal'&&!projects.some(p=>p.id===projectId))setProjectId('all');},[projects,projectId]);
  const stats=useMemo(()=>({all:tasks.length,todo:tasks.filter(t=>t.status==='todo').length,in_progress:tasks.filter(t=>t.status==='in_progress').length,done:tasks.filter(t=>t.status==='done').length}),[tasks]);
  const shown=useMemo(()=>selectTasks(tasks,{status:filter,priority,query,sort}).filter(task=>(projectId==='all'||(projectId==='personal'?!task.project_id:task.project_id===projectId))&&(!assigned||task.assignee_id===user.id)),[tasks,filter,priority,query,sort,projectId,assigned,user.id]);
  const hasFilters=filter!=='all'||priority!=='all'||!!query||projectId!=='all'||assigned;
  const resetFilters=()=>{setFilter('all');setPriority('all');setQuery('');setProjectId('all');setAssigned(false);};
  const navigate=id=>{setView(id);setMenuOpen(false);};
  const openForm=task=>{setDialogError('');setModal(task);};
  const closeDialog=()=>{if(!operationPending.current){setModal(undefined);setDeleting(null);setDialogError('');}};
  const begin=()=>{if(operationPending.current)return false;operationPending.current=true;requestVersion.current++;setBusy(true);setError('');setDialogError('');return true;};
  const end=()=>{operationPending.current=false;setBusy(false);};
  async function save(form){
    if(!begin())return;
    try{const editing=!!modal?.id;const saved=await api(editing?`/tasks/${modal.id}`:'/tasks',json(editing?'PUT':'POST',{title:form.title,description:form.description,priority:form.priority,status:form.status,due_date:form.due_date||null,start_date:form.start_date||null,project_id:form.project_id||null,assignee_id:form.assignee_id||null}));setTasks(previous=>editing?previous.map(task=>task.id===saved.id?saved:task):[saved,...previous]);setModal(undefined);notify(editing?'Changes saved.':'Task created.');await refresh();}catch(failure){setDialogError(failure.message);}finally{end();}
  }
  async function remove(){
    if(!begin())return;
    try{await api(`/tasks/${deleting.id}`,{method:'DELETE'});setTasks(previous=>previous.filter(task=>task.id!==deleting.id));setDeleting(null);notify('Task deleted.');await refresh();}catch(failure){setDialogError(failure.message);}finally{end();}
  }
  async function changeStatus(task,status){
    if(task.can_edit===false||task.status===status||!begin())return;
    try{const saved=await api(`/tasks/${task.id}`,json('PATCH',{status}));setTasks(previous=>previous.map(item=>item.id===saved.id?saved:item));notify(status==='done'?'Task completed.':`Task moved to ${statusLabels[status].toLowerCase()}.`);await refresh();requestAnimationFrame(()=>{if(document.activeElement===document.body)document.getElementById('page-title')?.focus();});}catch(failure){setError(failure.message);}finally{end();}
  }
  async function logout(){if(!begin())return;try{await api('/auth/logout',{method:'POST'});onSignedOut();}catch(failure){setError(failure.message);}finally{end();}}
  async function openNotification(id){try{setDetail(await api(`/tasks/${id}`));}catch(failure){setError(failure.message);}}
  const disabled=busy||loading;const unread=notifications.filter(n=>!n.read_at).length;
  const taskView=['dashboard','list','board','calendar'].includes(view);
  const pageTitle=navigation.find(item=>item[0]===view)?.[1];
  const cardProps={onEdit:openForm,onDelete:task=>{setDialogError('');setDeleting(task);},onStatus:changeStatus,onDetails:setDetail,busy:disabled,now};
  return <><a className="skip-link" href="#main-content">Skip to main content</a><div className="layout"><aside className="sidebar"><Sidebar user={user} view={view} navigate={navigate} unread={unread} onLogout={logout} busy={busy}/></aside><main className="main" id="main-content" tabIndex={-1}><header className="topbar"><div className="topbar-left"><button className="icon-button menu-toggle" onClick={()=>setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen}><Menu size={22}/></button><div className="breadcrumb">Workspace <span>/</span><b>{pageTitle}</b></div></div><div className="topbar-right"><span className="live-label">Updates every 15s</span><button className="icon-button notification-bell" aria-label={`Notifications, ${unread} unread`} onClick={()=>navigate('notifications')}><Bell size={20}/>{unread>0&&<span>{unread}</span>}</button></div></header><div className="content"><section className="heading"><div><div className="eyebrow">MAKE ROOM FOR PROGRESS</div><h1 id="page-title" tabIndex={-1}>{pageTitle}<span className="title-dot">.</span></h1><p>{view==='dashboard'?`Welcome back, ${user.name}. Here's where things stand.`:'Your priorities, your progress. All in one place.'}</p></div>{(taskView||view==='timeline')&&<button id="new-task" onClick={()=>openForm(null)} className="btn primary create-button" disabled={disabled}><Plus size={18}/><span>New task</span></button>}</section>
    {view==='dashboard'&&<div className="stats" aria-label="Filter by task status">{summaries.map(([value,label,Icon,tone])=><button key={value} className={`stat-card ${filter===value?'stat-selected':''}`} aria-pressed={filter===value} aria-label={`${label}: ${stats[value]}. Filter tasks`} onClick={()=>setFilter(value)}><div className="stat-head"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18}/></span></div><div className="stat-bottom"><strong>{loading?'–':stats[value]}</strong><small>{value==='all'?'Personal & project tasks':`${stats[value]} of ${stats.all} tasks`}</small></div></button>)}</div>}
    <ErrorMessage message={error} onDismiss={()=>setError('')}/>
    {taskView&&<section className={view==='board'?'board-section':'tasks-section'}><div className="task-header"><div><h2>Tasks <span className="count">{shown.length}</span></h2><p>{hasFilters?`Showing ${shown.length} of ${tasks.length} tasks`:'Personal tasks and projects you belong to.'}</p></div><button className="icon-button refresh" onClick={()=>refresh(true)} disabled={disabled} aria-label="Refresh tasks"><RefreshCcw size={18} className={loading?'spinner':''}/></button></div><div className="toolbar"><div className="tabs" role="group" aria-label="Task status filter">{[['all','All tasks'],...Object.entries(statusLabels)].map(([value,label])=><button key={value} className={filter===value?'selected':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div><div className="search"><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tasks..." aria-label="Search tasks"/>{query&&<button className="icon-button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={16}/></button>}</div></div><div className="filter-row"><div className="filter-controls"><label className="filter-control"><FolderOpen size={15}/><span>Project</span><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="all">All projects</option><option value="personal">Personal tasks</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="filter-control"><SlidersHorizontal size={15}/><span>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">All priorities</option>{Object.entries(priorities).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="filter-control"><ArrowUpDown size={15}/><span>Sort</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="due">Nearest due date</option><option value="priority">Highest priority</option></select></label><label className="checkbox-label assigned-filter"><input type="checkbox" checked={assigned} onChange={e=>setAssigned(e.target.checked)}/>Assigned to me</label></div>{hasFilters&&<button className="text-button" onClick={resetFilters}>Clear filters</button>}</div>
    {loading?<div className="empty" role="status"><RefreshCcw className="spinner"/><h3>Loading your tasks...</h3></div>:view==='calendar'?<Calendar tasks={shown} onOpen={setDetail}/>:view==='board'?<Kanban tasks={shown} cardProps={cardProps} onStatus={changeStatus} busy={disabled}/>:shown.length?<div className={view==='list'?'task-list-view':'task-grid'}>{shown.map(task=><TaskCard key={task.id} task={task} {...cardProps}/>)}</div>:<div className="empty"><ListTodo size={32}/><h3>{error?'Tasks could not be loaded':hasFilters?'No matching tasks':'Your workspace is ready'}</h3><p>{hasFilters?'Try a different search, project or priority.':'Create a task or start a project with your team.'}</p><button className="btn secondary" onClick={error?()=>refresh(true):hasFilters?resetFilters:()=>openForm(null)}>{error?'Try again':hasFilters?'Clear filters':'Create your first task'}</button></div>}<span className="sr-only" aria-live="polite">{loading?'Loading tasks':`${shown.length} tasks shown`}</span></section>}
    {view==='files'&&<Files tasks={tasks} projects={projects} onRefresh={refresh} notify={notify}/>}
    {view==='analytics'&&<Analytics projects={projects}/>}
    {view==='activity'&&<Activity projects={projects}/>}
    {view==='admin'&&<Administration user={user} notify={notify}/>}
    {view==='timeline'&&<Timeline tasks={tasks} projects={projects} onOpen={setDetail} onEdit={openForm} notify={notify}/>}
    {view==='projects'&&<Projects projects={projects} onRefresh={refresh} notify={notify} onOpen={id=>{resetFilters();setProjectId(id);setView('list');}}/>}
    {view==='team'&&<Team projects={projects} onRefresh={refresh} notify={notify}/>}
    {view==='notifications'&&<Notifications items={notifications} onRefresh={refresh} onOpen={openNotification} notify={notify}/>}
    {view==='settings'&&<AccountSettings user={user} onUser={onUser} notify={notify}/>}
    <footer><span>Taskflow · Group 7</span><span>A little progress, every day.</span></footer></div></main></div>
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">{toast&&<div className="toast" key={toast.id}><CheckCircle2 size={20}/><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={17}/></button></div>}</div>
    {modal!==undefined&&<TaskModal task={modal} onClose={closeDialog} onSave={save} busy={busy} error={dialogError} projects={projects} user={user} defaultProject={projects.some(p=>p.id===projectId&&p.role!=='viewer')?projectId:null}/>}
    {deleting&&<DeleteDialog task={deleting} onClose={closeDialog} onConfirm={remove} busy={busy} error={dialogError}/>}
    {detail&&<TaskDetails tasks={tasks} task={tasks.find(t=>t.id===detail.id)||detail} user={user} onClose={()=>setDetail(null)} onRefresh={refresh} notify={notify}/>}
    {menuOpen&&<Dialog titleId="navigation-title" className="nav-drawer" onClose={()=>setMenuOpen(false)}><div className="drawer-head"><h2 id="navigation-title">Navigation</h2><button data-autofocus className="icon-button" onClick={()=>setMenuOpen(false)} aria-label="Close navigation"><X size={22}/></button></div><Sidebar user={user} view={view} navigate={navigate} unread={unread} onLogout={logout} busy={busy}/></Dialog>}
  </>;
}
