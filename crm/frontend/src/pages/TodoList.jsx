import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { useTodoStore } from '../stores/todoStore';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Bell,
  Calendar,
  Flag,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Edit3,
  X,
  Search,
  Loader2,
  AlarmClock,
  ListChecks,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────── */
/*  CONSTANTS                                                    */
/* ──────────────────────────────────────────────────────────── */

const PRIORITY_META = {
  LOW:    { label: 'Low',    color: 'text-slate-500',   bg: 'bg-slate-100',   dot: 'bg-slate-400'   },
  MEDIUM: { label: 'Medium', color: 'text-amber-600',   bg: 'bg-amber-50',    dot: 'bg-amber-400'   },
  HIGH:   { label: 'High',   color: 'text-orange-600',  bg: 'bg-orange-50',   dot: 'bg-orange-500'  },
  URGENT: { label: 'Urgent', color: 'text-red-600',     bg: 'bg-red-50',      dot: 'bg-red-500'     },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

const isPast = (d) => d && new Date(d) < new Date();

/* ──────────────────────────────────────────────────────────── */
/*  EMPTY STATE                                                  */
/* ──────────────────────────────────────────────────────────── */

function EmptyState({ onAdd }) {
  return (
    <div className="todo-empty flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div className="todo-empty-icon">
        <ClipboardList size={56} className="text-emerald-300" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-700">You're all caught up!</p>
        <p className="text-sm text-gray-400 mt-1">Add your first to-do task to get started.</p>
      </div>
      <button onClick={onAdd} className="todo-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
        <Plus size={16} /> Add Task
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  TODO CARD                                                    */
/* ──────────────────────────────────────────────────────────── */

function TodoCard({ todo, onComplete, onDelete, onEdit, onToggleChecklist, completing }) {
  const pm = PRIORITY_META[todo.priority] || PRIORITY_META.MEDIUM;
  const overdue = todo.status !== 'COMPLETED' && isPast(todo.dueDate);
  const done = todo.status === 'COMPLETED';
  const checkCount = todo.checklist?.length || 0;
  const checkedCount = todo.checklist?.filter((c) => c.isCompleted).length || 0;

  return (
    <div
      className={`todo-card ${done ? 'todo-card-done' : ''} ${completing === todo.id ? 'todo-card-completing' : ''}`}
      style={{ '--priority-color': pm.dot }}
    >
      {/* Priority stripe */}
      <div className={`todo-priority-stripe ${pm.dot}`} />

      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Complete toggle */}
        <button
          onClick={() => !done && onComplete(todo.id)}
          className={`todo-check-btn ${done ? 'todo-check-btn-done' : 'todo-check-btn-pending'}`}
          disabled={done}
          title={done ? 'Completed' : 'Mark as complete'}
        >
          {done ? <CheckCircle2 size={22} className="text-emerald-500" /> : <Circle size={22} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`todo-title ${done ? 'line-through text-gray-400' : ''}`}>
              {todo.title}
            </h3>
            {/* Actions */}
            {!done && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEdit(todo)} className="todo-icon-btn" title="Edit">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => onDelete(todo.id)} className="todo-icon-btn todo-icon-btn-danger" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            {done && (
              <button onClick={() => onDelete(todo.id)} className="todo-icon-btn todo-icon-btn-danger shrink-0" title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {todo.description && (
            <p className={`todo-desc ${done ? 'line-through opacity-50' : ''}`}>{todo.description}</p>
          )}

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mt-2.5">
            {/* Priority */}
            <span className={`todo-chip ${pm.bg} ${pm.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pm.dot}`} />
              {pm.label}
            </span>
            {/* Due date */}
            <span className={`todo-chip ${overdue ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
              <Calendar size={11} />
              {fmtDate(todo.dueDate)}
              {overdue && <span className="font-bold"> · Overdue</span>}
            </span>
            {/* Reminder */}
            {todo.reminderAt && (
              <span className="todo-chip bg-violet-50 text-violet-600">
                <AlarmClock size={11} />
                {fmtDateTime(todo.reminderAt)}
              </span>
            )}
            {/* Completed badge */}
            {done && (
              <span className="todo-chip bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={11} /> Done · {fmtDate(todo.completedAt)}
              </span>
            )}
          </div>

          {/* Checklist */}
          {checkCount > 0 && (
            <div className="todo-checklist mt-3">
              <div className="todo-checklist-header">
                <ListChecks size={13} className="text-gray-400" />
                <span>{checkedCount}/{checkCount} subtasks</span>
                {/* Progress bar */}
                <div className="todo-progress-bar">
                  <div
                    className="todo-progress-fill"
                    style={{ width: `${checkCount ? (checkedCount / checkCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1 mt-2">
                {todo.checklist.map((item) => (
                  <label
                    key={item.id}
                    className={`todo-checklist-item ${item.isCompleted ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() => !done && onToggleChecklist(todo.id, item.id)}
                      disabled={done}
                      className="todo-checkbox"
                    />
                    <span className={item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}>
                      {item.content}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  MODAL (Add / Edit)                                          */
/* ──────────────────────────────────────────────────────────── */

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  dueDate: '',
  reminderAt: '',
  checklist: [],
};

function TodoModal({ open, onClose, onSubmit, initial = null, isSubmitting }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [checkInput, setCheckInput] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (initial) {
        const toLocal = (d) => {
          if (!d) return '';
          const dt = new Date(d);
          dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
          return dt.toISOString().slice(0, 16);
        };
        setForm({
          title: initial.title || '',
          description: initial.description || '',
          priority: initial.priority || 'MEDIUM',
          dueDate: toLocal(initial.dueDate),
          reminderAt: toLocal(initial.reminderAt),
          checklist: (initial.checklist || []).map((c) => c.content),
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setCheckInput('');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, initial]);

  const addCheckItem = () => {
    const val = checkInput.trim();
    if (!val) return;
    setForm((f) => ({ ...f, checklist: [...f.checklist, val] }));
    setCheckInput('');
  };

  const removeCheckItem = (i) => {
    setForm((f) => ({ ...f, checklist: f.checklist.filter((_, idx) => idx !== i) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  if (!open) return null;

  return (
    <div className="todo-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="todo-modal">
        {/* Header */}
        <div className="todo-modal-header">
          <h2 className="text-lg font-bold">{initial ? 'Edit Task' : 'Add New Task'}</h2>
          <button onClick={onClose} className="todo-icon-btn"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="todo-modal-body space-y-4">
          {/* Title */}
          <div>
            <label className="todo-label">Task Title *</label>
            <input
              ref={titleRef}
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Review monthly report"
              className="todo-input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="todo-label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional details..."
              rows={2}
              className="todo-input resize-none"
            />
          </div>

          {/* Priority + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="todo-label">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="todo-input"
              >
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="todo-label">Due Date *</label>
              <input
                required
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="todo-input"
              />
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="todo-label flex items-center gap-1.5">
              <Bell size={13} className="text-violet-500" />
              Reminder (optional)
            </label>
            <input
              type="datetime-local"
              value={form.reminderAt}
              onChange={(e) => setForm({ ...form, reminderAt: e.target.value })}
              className="todo-input"
            />
            <p className="text-xs text-gray-400 mt-0.5">You'll get an in-app notification at this time.</p>
          </div>

          {/* Checklist */}
          <div>
            <label className="todo-label flex items-center gap-1.5">
              <ListChecks size={13} className="text-emerald-500" />
              Sub-tasks / Checklist
            </label>
            <div className="flex gap-2">
              <input
                value={checkInput}
                onChange={(e) => setCheckInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCheckItem())}
                placeholder="Add a sub-task and press Enter"
                className="todo-input flex-1"
              />
              <button
                type="button"
                onClick={addCheckItem}
                className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors shrink-0"
              >
                <Plus size={16} />
              </button>
            </div>
            {form.checklist.length > 0 && (
              <ul className="mt-2 space-y-1">
                {form.checklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                    <Circle size={12} className="text-gray-300 shrink-0" />
                    <span className="flex-1">{item}</span>
                    <button type="button" onClick={() => removeCheckItem(i)} className="text-red-400 hover:text-red-600">
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (initial ? 'Save Changes' : 'Add Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                    */
/* ──────────────────────────────────────────────────────────── */

export default function TodoList() {
  const { todos, isLoading, fetchTodos, createTodo, updateTodo, completeTodo, deleteTodo, toggleChecklist } =
    useTodoStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTodo, setEditTodo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchTodos();
  }, []);

  /* ── Toast helper ────────────────────────────── */
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Filtered lists ──────────────────────────── */
  const filtered = todos.filter((t) => {
    const matchSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase());
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const active = filtered.filter((t) => t.status !== 'COMPLETED');
  const completed = filtered.filter((t) => t.status === 'COMPLETED');

  /* ── Handlers ────────────────────────────────── */
  const handleOpenAdd = () => {
    setEditTodo(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (todo) => {
    setEditTodo(todo);
    setModalOpen(true);
  };

  const handleSubmit = async (form) => {
    setIsSubmitting(true);
    let res;
    if (editTodo) {
      res = await updateTodo(editTodo.id, form);
    } else {
      res = await createTodo(form);
    }
    setIsSubmitting(false);
    if (res.success) {
      setModalOpen(false);
      showToast(editTodo ? 'Task updated!' : 'Task added!');
    } else {
      showToast(res.error || 'Something went wrong', 'error');
    }
  };

  const handleComplete = async (id) => {
    setCompleting(id);
    await new Promise((r) => setTimeout(r, 500)); // let animation play
    const res = await completeTodo(id);
    setCompleting(null);
    if (res.success) {
      showToast('🎉 Task completed!');
      setShowCompleted(true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await deleteTodo(id);
    showToast('Task deleted.', 'info');
  };

  /* ─────────────────────────────────────────────── */

  return (
    <>
      {/* ── Inline styles ── */}
      <style>{`
        /* ── Layout ── */
        .todo-page { max-width: 860px; margin: 0 auto; }

        /* ── Card ── */
        .todo-card {
          position: relative;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px 18px 18px 24px;
          overflow: hidden;
          transition: box-shadow 0.2s, transform 0.2s, opacity 0.4s;
          will-change: transform, opacity;
          animation: cardIn 0.3s ease;
        }
        .todo-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .todo-card-done { background: #f9fafb; border-color: #d1fae5; }
        .todo-card-completing { transform: scale(0.97) translateX(8px); opacity: 0.5; }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .todo-priority-stripe {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          border-radius: 14px 0 0 14px;
        }

        /* ── Complete button ── */
        .todo-check-btn {
          flex-shrink: 0; padding: 2px;
          border-radius: 50%; transition: transform 0.15s, color 0.15s;
          color: #d1d5db;
        }
        .todo-check-btn:hover:not(:disabled) { color: #10b981; transform: scale(1.15); }
        .todo-check-btn-done { cursor: default; }

        /* ── Typography ── */
        .todo-title { font-size: 0.95rem; font-weight: 600; color: #111827; line-height: 1.4; }
        .todo-desc  { font-size: 0.8rem; color: #6b7280; margin-top: 2px; line-height: 1.5; }

        /* ── Chips ── */
        .todo-chip {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 0.7rem; font-weight: 500;
          padding: 2px 8px; border-radius: 9999px;
        }

        /* ── Checklist ── */
        .todo-checklist { background: #f9fafb; border: 1px solid #f0f0f0; border-radius: 10px; padding: 10px 12px; }
        .todo-checklist-header { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: #9ca3af; font-weight: 500; }
        .todo-progress-bar { flex: 1; height: 4px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }
        .todo-progress-fill { height: 100%; background: #10b981; border-radius: 9999px; transition: width 0.4s ease; }
        .todo-checklist-item { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer; padding: 2px 0; }
        .todo-checkbox { width: 14px; height: 14px; accent-color: #10b981; cursor: pointer; }

        /* ── Icon buttons ── */
        .todo-icon-btn {
          padding: 5px; border-radius: 7px; color: #9ca3af;
          transition: background 0.15s, color 0.15s;
        }
        .todo-icon-btn:hover { background: #f3f4f6; color: #374151; }
        .todo-icon-btn-danger:hover { background: #fee2e2; color: #ef4444; }

        /* ── Primary button ── */
        .todo-btn-primary {
          background: linear-gradient(135deg, #059669, #10b981);
          color: #fff; border-radius: 10px; font-weight: 600;
          transition: opacity 0.2s, transform 0.1s; box-shadow: 0 2px 8px rgba(16,185,129,0.3);
        }
        .todo-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .todo-btn-primary:active { transform: scale(0.97); }

        /* ── Empty ── */
        .todo-empty-icon {
          width: 90px; height: 90px; border-radius: 50%;
          background: linear-gradient(135deg, #d1fae5, #ecfdf5);
          display: flex; align-items: center; justify-content: center;
          animation: pulse-slow 2.5s ease-in-out infinite;
        }
        @keyframes pulse-slow {
          0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.25); }
          50%      { box-shadow: 0 0 0 14px rgba(16,185,129,0); }
        }

        /* ── Completed section slide ── */
        .todo-completed-list {
          overflow: hidden;
          animation: slideDown 0.3s ease;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Modal overlay ── */
        .todo-overlay {
          position: fixed; inset: 0; z-index: 60;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .todo-modal {
          background: #fff; border-radius: 18px;
          width: 100%; max-width: 520px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
          animation: modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
          display: flex; flex-direction: column; max-height: 90vh;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .todo-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px; border-bottom: 1px solid #f0f0f0;
          background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
          border-radius: 18px 18px 0 0;
        }
        .todo-modal-body { padding: 20px; overflow-y: auto; }

        /* ── Form inputs ── */
        .todo-label { display: block; font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 4px; }
        .todo-input {
          width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb;
          border-radius: 10px; font-size: 0.85rem; color: #111827;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
          background: #fafafa;
        }
        .todo-input:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.12); background: #fff; }

        /* ── Toast ── */
        .todo-toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 99;
          display: flex; align-items: center; gap-10px;
          padding: 12px 18px; border-radius: 12px; font-size: 0.85rem; font-weight: 500;
          box-shadow: 0 6px 24px rgba(0,0,0,0.15);
          animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .todo-toast-success { background: #064e3b; color: #fff; }
        .todo-toast-error   { background: #7f1d1d; color: #fff; }
        .todo-toast-info    { background: #1e3a5f; color: #fff; }
      `}</style>

      <Layout>
        <div className="todo-page">
          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={24} className="text-emerald-500" />
                My To-Do List
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage your personal tasks, set reminders, and track progress.
              </p>
            </div>
            <button onClick={handleOpenAdd} className="todo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
              <Plus size={18} /> Add Task
            </button>
          </div>

          {/* ── Stats bar ── */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Active', count: todos.filter(t => t.status !== 'COMPLETED').length, color: 'bg-amber-50 border-amber-200 text-amber-700' },
              { label: 'Completed', count: todos.filter(t => t.status === 'COMPLETED').length, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { label: 'Overdue', count: todos.filter(t => t.status !== 'COMPLETED' && isPast(t.dueDate)).length, color: 'bg-red-50 border-red-200 text-red-700' },
            ].map(s => (
              <div key={s.label} className={`${s.color} border rounded-xl px-4 py-3 text-center`}>
                <div className="text-2xl font-bold">{s.count}</div>
                <div className="text-xs font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Filters ── */}
          <div className="flex gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="todo-input pl-8"
              />
            </div>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="todo-input w-40"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* ── Loading ── */}
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-emerald-500" />
            </div>
          ) : active.length === 0 && completed.length === 0 ? (
            <EmptyState onAdd={handleOpenAdd} />
          ) : (
            <>
              {/* ── Active Tasks ── */}
              {active.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    Active ({active.length})
                  </h2>
                  {active.map(todo => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      onComplete={handleComplete}
                      onDelete={handleDelete}
                      onEdit={handleOpenEdit}
                      onToggleChecklist={toggleChecklist}
                      completing={completing}
                    />
                  ))}
                </div>
              )}

              {active.length === 0 && completed.length > 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 size={40} className="text-emerald-400 mb-2" />
                  <p className="text-emerald-600 font-semibold">All tasks completed! 🎉</p>
                </div>
              )}

              {/* ── Completed Tasks (collapsible) ── */}
              {completed.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowCompleted(v => !v)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-3 transition-colors"
                  >
                    {showCompleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Completed ({completed.length})
                  </button>

                  {showCompleted && (
                    <div className="todo-completed-list space-y-3">
                      {completed.map(todo => (
                        <TodoCard
                          key={todo.id}
                          todo={todo}
                          onComplete={handleComplete}
                          onDelete={handleDelete}
                          onEdit={handleOpenEdit}
                          onToggleChecklist={toggleChecklist}
                          completing={completing}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Modal ── */}
        <TodoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          initial={editTodo}
          isSubmitting={isSubmitting}
        />

        {/* ── Toast ── */}
        {toast && (
          <div className={`todo-toast todo-toast-${toast.type}`}>
            {toast.msg}
          </div>
        )}
      </Layout>
    </>
  );
}
