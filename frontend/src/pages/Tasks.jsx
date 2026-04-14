import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useTaskStore } from '../stores/taskStore';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import VoiceRecorder from '../components/VoiceRecorder/VoiceRecorder';
import {
  CheckSquare, Plus, Search, Calendar as CalIcon,
  Mic, Clock, User, CheckCircle2, XCircle, Image,
  AlertTriangle, ChevronDown, Filter
} from 'lucide-react';

const STATUS_COLORS = {
  PENDING:     'bg-yellow-100 text-yellow-800 border-yellow-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED:   'bg-green-100 text-green-800 border-green-200',
  OVERDUE:     'bg-red-100 text-red-800 border-red-200',
  CANCELLED:   'bg-gray-100 text-gray-600 border-gray-200',
};

const PRIORITY_COLORS = {
  LOW:    'text-gray-500',
  MEDIUM: 'text-yellow-600',
  HIGH:   'text-orange-600',
  URGENT: 'text-red-600',
};

const PRIORITY_DOT = {
  LOW:    'bg-gray-400',
  MEDIUM: 'bg-yellow-400',
  HIGH:   'bg-orange-500',
  URGENT: 'bg-red-500',
};

export default function Tasks() {
  const { user } = useAuthStore();
  const { tasks, isLoading, fetchTasks, createTask, completeTask, failTask } = useTaskStore();
  const { users, fetchUsers } = useUserStore();

  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({
    title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: ''
  });
  const [assignVoice, setAssignVoice] = useState(null);
  const [assigning, setAssigning]   = useState(false);

  // Complete modal
  const [completeTask_, setCompleteTask_] = useState(null);
  const [completeText,  setCompleteText]  = useState('');
  const [completeVoice, setCompleteVoice] = useState(null);
  const [completeImg,   setCompleteImg]   = useState(null);
  const [completing,    setCompleting]    = useState(false);

  // Fail / Cannot-Complete modal
  const [failTask_, setFailTask_]    = useState(null);
  const [failReason, setFailReason]  = useState('');
  const [failVoice,  setFailVoice]   = useState(null);
  const [failing,    setFailing]     = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTasks({ search, status: statusFilter });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setAssigning(true);
    // Always send type:'TEAM' so the task appears in the shared task list
    // (the getTasks query filters out PERSONAL type tasks)
    const res = await createTask({ ...assignForm, type: 'TEAM' }, assignVoice);
    setAssigning(false);
    if (res.success) {
      setShowAssign(false);
      setAssignForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' });
      setAssignVoice(null);
      fetchTasks();
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!completeTask_) return;
    setCompleting(true);
    const res = await completeTask(completeTask_.id, completeVoice, completeText, completeImg);
    setCompleting(false);
    if (res.success) {
      setCompleteTask_(null);
      setCompleteText('');
      setCompleteVoice(null);
      setCompleteImg(null);
    }
  };

  const handleFail = async (e) => {
    e.preventDefault();
    if (!failTask_) return;
    setFailing(true);
    const res = await failTask(failTask_.id, failReason, failVoice);
    setFailing(false);
    if (res.success) {
      setFailTask_(null);
      setFailReason('');
      setFailVoice(null);
    }
  };

  const getAudioUrl = (url) =>
    `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${url}`;

  const isAdmin   = user?.role === 'ADMIN';
  const employees = users.filter(u => u.role === 'EMPLOYEE' || u.role === 'ADMIN');

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign tasks, track progress, receive completion proof.</p>
        </div>
        {(isAdmin || user?.role === 'EMPLOYEE') && (
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <Plus size={18} /> Assign Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Status</option>
            {['PENDING','IN_PROGRESS','COMPLETED','OVERDUE','CANCELLED'].map(s =>
              <option key={s} value={s}>{s.replace('_',' ')}</option>
            )}
          </select>
          <button type="submit"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-2">
            <Filter size={14} /> Filter
          </button>
        </form>
      </div>

      {/* Task Cards */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center p-16 bg-white rounded-xl border border-gray-100">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-20 text-gray-500" />
          <p className="text-gray-500">No tasks found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map(task => {
            const isAssignee = task.assignedToId === user?.id;
            const canAct     = isAdmin || isAssignee;
            const isPending  = task.status !== 'COMPLETED' && task.status !== 'CANCELLED';

            return (
              <div key={task.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col hover:shadow-md transition-all duration-200">

                {/* Status + Priority row */}
                <div className="flex justify-between items-center mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[task.status] || STATUS_COLORS.PENDING}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                    <span className={`text-xs font-bold ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 text-base mb-1 leading-snug">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1"
                    dangerouslySetInnerHTML={{ __html: task.description }} />
                )}

                {/* Assignment voice note */}
                {task.assignmentVoiceUrl && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2">
                    <Mic size={14} className="text-blue-500 flex-shrink-0" />
                    <audio src={getAudioUrl(task.assignmentVoiceUrl)} controls className="h-8 flex-1 max-w-full" />
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4 py-3 border-t border-gray-50">
                  <div className="flex items-center gap-1">
                    <CalIcon size={13} />
                    {new Date(task.dueDate).toLocaleDateString('en-IN')}
                  </div>
                  <div className="flex items-center gap-1" title="Assigned To">
                    <User size={13} />
                    {task.assignedTo?.firstName} {task.assignedTo?.lastName}
                  </div>
                </div>

                {/* Completion proof */}
                {task.status === 'COMPLETED' && (
                  <div className="mb-3 space-y-2">
                    {task.completionVoiceNote && (
                      <p className="text-xs text-gray-600 bg-green-50 rounded-lg p-2 border border-green-100">
                        📝 {task.completionVoiceNote}
                      </p>
                    )}
                    {task.completionVoiceUrl && (
                      <div className="p-2 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                        <audio src={getAudioUrl(task.completionVoiceUrl)} controls className="h-8 flex-1" />
                      </div>
                    )}
                    {task.attachmentUrl && (
                      <a href={getAudioUrl(task.attachmentUrl)} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:underline p-2 bg-blue-50 border border-blue-100 rounded-lg">
                        <Image size={13} /> View Completion Photo/Video
                      </a>
                    )}
                  </div>
                )}

                {/* Failure/Cancellation reason */}
                {task.status === 'CANCELLED' && (
                  <div className="mb-3 space-y-2">
                    {task.failureReason && (
                      <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2 border border-red-100">
                        ❌ {task.failureReason}
                      </p>
                    )}
                    {task.completionVoiceUrl && (
                      <div className="p-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
                        <XCircle size={14} className="text-red-500 flex-shrink-0" />
                        <audio src={getAudioUrl(task.completionVoiceUrl)} controls className="h-8 flex-1" />
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons — only for assignee or admin, only if task is active */}
                {canAct && isPending && (
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => setCompleteTask_(task)}
                      className="flex-1 py-2 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-bold rounded-lg transition-colors border border-green-200 flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} /> Mark Complete
                    </button>
                    <button onClick={() => setFailTask_(task)}
                      className="flex-1 py-2 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded-lg transition-colors border border-red-200 flex items-center justify-center gap-1.5">
                      <XCircle size={14} /> Can't Complete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ASSIGN MODAL ── */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-lg text-gray-900">Assign Task</h2>
              <button onClick={() => setShowAssign(false)} className="text-gray-400 hover:text-black text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Task Title *</label>
                <input required value={assignForm.title}
                  onChange={e => setAssignForm({ ...assignForm, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Description</label>
                {/* Plain textarea instead of ReactQuill — avoids white-page crash */}
                <textarea rows={4} value={assignForm.description}
                  onChange={e => setAssignForm({ ...assignForm, description: e.target.value })}
                  placeholder="Task details, steps, requirements..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Assign To *</label>
                  <select required value={assignForm.assignedToId}
                    onChange={e => setAssignForm({ ...assignForm, assignedToId: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">-- Select Employee --</option>
                    {employees.map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Priority</label>
                  <select value={assignForm.priority}
                    onChange={e => setAssignForm({ ...assignForm, priority: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {['LOW','MEDIUM','HIGH','URGENT'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Due Date & Time *</label>
                <input required type="datetime-local" value={assignForm.dueDate}
                  onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">Voice Instructions (Optional)</label>
                <VoiceRecorder onRecordingComplete={blob => setAssignVoice(blob)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssign(false)}
                  className="flex-1 py-2.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={assigning}
                  className="flex-1 py-2.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-sm">
                  {assigning ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── COMPLETE MODAL ── */}
      {completeTask_ && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-green-100 flex justify-between items-center bg-green-50">
              <h2 className="font-bold text-lg text-green-900">Mark Task Complete</h2>
              <button onClick={() => setCompleteTask_(null)} className="text-green-400 hover:text-green-800 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleComplete} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Completing: <strong className="text-gray-900">{completeTask_.title}</strong>
              </p>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Completion Summary</label>
                <textarea rows={3} value={completeText}
                  onChange={e => setCompleteText(e.target.value)}
                  placeholder="Describe what was accomplished..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">Attach Photo / Video Proof</label>
                <input type="file" accept="image/*,video/*"
                  onChange={e => setCompleteImg(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">Voice Note Proof (Optional)</label>
                <VoiceRecorder onRecordingComplete={blob => setCompleteVoice(blob)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCompleteTask_(null)}
                  className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={completing}
                  className="flex-1 py-2.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition-colors">
                  <CheckCircle2 size={16} />
                  {completing ? 'Saving...' : 'Confirm Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FAIL / CANNOT COMPLETE MODAL ── */}
      {failTask_ && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 flex justify-between items-center bg-red-50">
              <div>
                <h2 className="font-bold text-lg text-red-900">Cannot Complete Task</h2>
                <p className="text-xs text-red-600 mt-0.5">Please explain why this task couldn't be done</p>
              </div>
              <button onClick={() => setFailTask_(null)} className="text-red-400 hover:text-red-800 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleFail} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Task: <strong className="text-gray-900">{failTask_.title}</strong>
              </p>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Reason for Incompletion <span className="text-red-500">*</span>
                </label>
                <textarea required rows={4} value={failReason}
                  onChange={e => setFailReason(e.target.value)}
                  placeholder="Explain what happened and why the task could not be completed..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">Voice Message (Optional)</label>
                <VoiceRecorder onRecordingComplete={blob => setFailVoice(blob)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setFailTask_(null)}
                  className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
                  Go Back
                </button>
                <button type="submit" disabled={failing}
                  className="flex-1 py-2.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition-colors">
                  <AlertTriangle size={15} />
                  {failing ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
