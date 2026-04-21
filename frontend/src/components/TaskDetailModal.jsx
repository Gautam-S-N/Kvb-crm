import { useState, useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import { 
  X, Calendar as CalIcon, User, Clock, 
  CheckCircle2, XCircle, Mic, Image, 
  AlertTriangle, Save, Edit2, Download
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

export default function TaskDetailModal({ taskId, onClose, onUpdate }) {
  const { user } = useAuthStore();
  const { tasks, updateTask, isLoading: storeLoading } = useTaskStore();
  const { users } = useUserStore();
  
  const [task, setTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const t = tasks.find(x => x.id === taskId);
    if (t) {
      setTask(t);
      setFormData({
        title: t.title,
        description: t.description || '',
        priority: t.priority,
        status: t.status,
        dueDate: new Date(t.dueDate).toISOString().slice(0, 16), // datetime-local format
        assignedToId: t.assignedToId
      });
    }
  }, [taskId, tasks]);

  if (!task) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateTask(task.id, formData);
    setSaving(false);
    if (res.success) {
      setIsEditing(false);
      if (onUpdate) onUpdate();
    }
  };

  const getAudioUrl = (url) =>
    `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${url}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>
            <h2 className="font-bold text-gray-900 truncate max-w-[300px]">Task Details</h2>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <button onClick={() => setIsEditing(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Task">
                <Edit2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-100 rounded-lg shadow-sm">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Title</label>
                <input required value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Description</label>
                <textarea rows={4} value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Priority</label>
                  <select value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {['LOW','MEDIUM','HIGH','URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Deadline</label>
                  <input type="datetime-local" value={formData.dueDate}
                    onChange={e => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Assigned To</label>
                  <select value={formData.assignedToId}
                    onChange={e => setFormData({...formData, assignedToId: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                  <select value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {['PENDING','IN_PROGRESS','COMPLETED','CANCELLED'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="flex-1 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2">
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Title and Meta */}
              <div>
                <h1 className="text-xl font-black text-gray-900 leading-tight mb-2">{task.title}</h1>
                <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-500">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg">
                    <CalIcon size={14} className="text-gray-400" />
                    <span>Due: {new Date(task.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg">
                    <User size={14} className="text-gray-400" />
                    <span>Assigned to: {task.assignedTo?.firstName} {task.assignedTo?.lastName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${task.priority === 'URGENT' ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <span className={PRIORITY_COLORS[task.priority]}>{task.priority} Priority</span>
                  </div>
                </div>
              </div>

              {/* Assignment Voice Note */}
              {task.assignmentVoiceUrl && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic size={16} className="text-blue-500" />
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Voice Instructions</span>
                  </div>
                  <audio src={getAudioUrl(task.assignmentVoiceUrl)} controls className="w-full h-10" />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-2">Detailed Instructions</label>
                <div className="text-sm text-gray-700 leading-relaxed bg-white border border-gray-100 p-4 rounded-2xl shadow-sm whitespace-pre-wrap">
                  {task.description || <span className="text-gray-300 italic">No description provided.</span>}
                </div>
              </div>

              {/* Completion Section */}
              {(task.status === 'COMPLETED' || task.status === 'CANCELLED') && (
                <div className={`p-5 rounded-2xl border ${task.status === 'COMPLETED' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    {task.status === 'COMPLETED' ? (
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={20} className="text-red-600" />
                    )}
                    <h3 className={`font-black text-sm uppercase tracking-wider ${task.status === 'COMPLETED' ? 'text-emerald-800' : 'text-red-800'}`}>
                      {task.status === 'COMPLETED' ? 'Submission Proof' : 'Incompletion Report'}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Text Note */}
                    {(task.completionVoiceNote || task.failureReason) && (
                      <div className="bg-white/80 p-3 rounded-xl border border-white text-sm text-gray-700 shadow-sm font-medium">
                        {task.status === 'COMPLETED' ? task.completionVoiceNote : task.failureReason}
                      </div>
                    )}

                    {/* Completion Voice */}
                    {task.completionVoiceUrl && (
                      <div className="bg-white/80 p-3 rounded-xl border border-white shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-gray-400 uppercase">
                          <Mic size={12} /> Voice Recording
                        </div>
                        <audio src={getAudioUrl(task.completionVoiceUrl)} controls className="w-full h-9" />
                      </div>
                    )}

                    {/* Attachment */}
                    {task.attachmentUrl && (
                      <a href={getAudioUrl(task.attachmentUrl)} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between p-3 bg-white/80 hover:bg-white rounded-xl border border-white shadow-sm transition-all group">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Image size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-800">Review Attachment</div>
                            <div className="text-[10px] text-gray-500">Image or Video evidence</div>
                          </div>
                        </div>
                        <Download size={16} className="text-gray-400 group-hover:text-blue-600" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
