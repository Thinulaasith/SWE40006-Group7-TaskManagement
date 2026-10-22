import { useEffect, useRef, useState } from 'react';
import { AlertCircle, X, RefreshCcw, Check, Trash2, Pencil, CalendarDays, Circle, CheckCircle2 } from 'lucide-react';
import { deadline, priorities, statusLabels } from './task-utils.js';
import { api } from './api.js';
const blank = {title:'',description:'',priority:'medium',status:'todo',due_date:'',start_date:'',project_id:null,assignee_id:null};
export function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;
  return <div className="error" role="alert"><AlertCircle size={18} /><span>{message}</span>{onDismiss && <button className="icon-button" onClick={onDismiss} aria-label="Dismiss error"><X size={18} /></button>}</div>;
}

// Native modal dialogs provide focus containment and make the background inert.
export function Dialog({ titleId, children, onClose, busy = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    (dialog.querySelector('[data-autofocus]') || dialog).focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected && !previous.disabled) previous.focus();
      else document.getElementById('new-task')?.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={titleId} aria-busy={busy} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const focusable = [...ref.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) { event.preventDefault(); ref.current.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => {
    if (busy || event.target !== ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>{children}</dialog>;
}

export function TaskModal({ task, onClose, onSave, busy, error, projects = [], user, defaultProject = null }) {
  const [form, setForm] = useState(task ? { ...task, due_date: task.due_date || '', start_date: task.start_date || '' } : { ...blank, project_id: defaultProject });
  const [members, setMembers] = useState([]);
  const [memberError, setMemberError] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  useEffect(() => {
    let active = true; setMemberError('');
    if (!form.project_id) { setMembers(user ? [user] : []); setMembersLoading(false); return; }
    setMembersLoading(true);
    api(`/projects/${form.project_id}/members`).then(data => { if (active) setMembers(data); }).catch(error => { if (active) setMemberError(error.message); }).finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, [form.project_id, user]);
  const update = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  return <Dialog titleId="task-modal-title" onClose={onClose} busy={busy}>
    <div className="modal-head"><div><div className="eyebrow">TASK DETAILS</div><h2 id="task-modal-title">{task ? 'Edit task' : 'Create a new task'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close task form" disabled={busy}><X size={21} /></button></div>
    <form onSubmit={event => { event.preventDefault(); if (!busy) onSave(form); }}>
      <fieldset disabled={busy}>
        <label>Task title <span aria-hidden="true">*</span><input data-autofocus required maxLength={150} value={form.title} onChange={event => update('title', event.target.value)} placeholder="What needs to get done?" /></label>
        <label>Description <small>(optional)</small><textarea maxLength={2000} rows={3} value={form.description} onChange={event => update('description', event.target.value)} placeholder="Add a little context..." /></label>
        <div className="form-grid"><label>Priority<select value={form.priority} onChange={event => update('priority', event.target.value)}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Status<select value={form.status} onChange={event => update('status', event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <label>Start date <small>(optional)</small><input type="date" min="0001-01-01" max={form.due_date||"9999-12-31"} value={form.start_date} onChange={event=>update('start_date',event.target.value)}/></label><label>Due date <small>(optional)</small><input type="date" min={form.start_date||"0001-01-01"} max="9999-12-31" value={form.due_date} onChange={event => update('due_date', event.target.value)} /></label>
        <div className="form-grid"><label>Project<select disabled={!!task && task.owner_id !== user?.id} value={form.project_id || ''} onChange={event => setForm(previous => ({ ...previous, project_id: event.target.value || null, assignee_id: null }))}><option value="">Personal tasks</option>{projects.filter(p=>p.role!=='viewer').map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Assign to<select value={form.assignee_id || ''} disabled={membersLoading} onChange={event => update('assignee_id', event.target.value || null)}><option value="">Unassigned</option>{members.filter(m=>!m.disabled&&m.role!=='viewer').map(member => <option key={member.id} value={member.id}>{member.name}{member.id === user?.id ? ' (you)' : ''}</option>)}</select></label></div>
        <ErrorMessage message={memberError} />
      </fieldset>
      <ErrorMessage message={error} />
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn primary" disabled={busy || !form.title.trim()} type="submit">{busy ? <RefreshCcw className="spinner" size={17} /> : <Check size={17} />}{busy ? 'Saving...' : task ? 'Save changes' : 'Create task'}</button></div>
    </form>
  </Dialog>;
}

export function DeleteDialog({ task, onClose, onConfirm, busy, error }) {
  return <Dialog titleId="delete-title" onClose={onClose} busy={busy} className="delete-modal">
    <div className="modal-head"><div className="delete-symbol"><Trash2 size={24} /></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close delete confirmation"><X size={21} /></button></div>
    <h2 id="delete-title">Delete this task?</h2><p className="delete-copy">“<strong>{task.title}</strong>” will be permanently removed. This cannot be undone.</p>
    <ErrorMessage message={error} />
    <div className="modal-actions"><button data-autofocus className="btn secondary" onClick={onClose} disabled={busy}>Keep task</button><button className="btn danger" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting...' : 'Delete task'}</button></div>
  </Dialog>;
}

export function TaskCard({ task, onEdit, onDelete, onStatus, onDetails, busy, now }) {
  busy = busy || task.can_edit === false;
  const due = deadline(task, now);
  const completed = task.status === 'done';
  return <article className={`task-card ${completed ? 'is-complete' : ''}`} aria-label={task.title}>
    <div className="task-card-top"><span className={`priority priority-${task.priority}`}><span className="priority-dot" />{priorities[task.priority]}</span><div className="task-actions"><button className="icon-button" disabled={busy} title="Edit task" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}><Pencil size={17} /></button><button className="icon-button delete-action" disabled={busy} title="Delete task" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}><Trash2 size={17} /></button></div></div>
    <h3><button className="task-title-button" onClick={() => onDetails(task)}>{task.title}</button></h3>{task.description && <p className="task-desc">{task.description}</p>}
    <div className="task-meta"><span>{task.project_name || 'Personal'}</span>{task.assignee_name && <span>Assigned: {task.assignee_name}</span>}</div>
    <button className="task-detail-link" onClick={() => onDetails(task)}>{task.subtask_done || 0}/{task.subtask_count || 0} subtasks · {task.comment_count || 0} comments ? {task.attachment_count || 0} files</button>
    <div className="task-status-row"><label className={`status-control status-${task.status}`}><span className="sr-only">Status for {task.title}</span><select value={task.status} disabled={busy} onChange={event => onStatus(task, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="task-card-bottom"><div className={`due due-${due.tone}`}><CalendarDays size={16} /><div><span className="deadline-label">{due.label}</span>{due.date && <time dateTime={task.due_date}>{due.date}</time>}</div></div><button disabled={busy} className={`complete-button ${completed ? 'completed' : ''}`} onClick={() => onStatus(task, completed ? 'todo' : 'done')} title={completed ? 'Reopen task' : 'Mark completed'} aria-label={`${completed ? 'Reopen' : 'Complete'} ${task.title}`}>{completed ? <CheckCircle2 size={23} /> : <Circle size={23} />}</button></div>
  </article>;
}

