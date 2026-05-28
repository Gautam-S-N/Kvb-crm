/**
 * QuotationNumberBox
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the auto-generated quotation number prominently at the top of the
 * quotation form. Handles reservation, countdown timer, and manual overrides.
 *
 * Props:
 *   templateType  – e.g. 'SOLAR_TUNNEL_DRYER'
 *   value         – controlled quotation number string
 *   onChange      – fn(newNumber) called when user edits or reservation arrives
 *   onReservation – fn({ reservationId, expiresAt }) called when reserved
 *   reservationId – current reservation id (to release on unmount)
 *   disabled      – disable manual edits
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuotationStore } from '../stores/quotationStore';
import { Lock, RefreshCw, Clock, Edit3, CheckCircle } from 'lucide-react';

export default function QuotationNumberBox({
  templateType,
  value,
  onChange,
  onReservation,
  reservationId,
  disabled = false,
  autoReserve = true,
}) {
  const { reserveNumber, releaseReservation } = useQuotationStore();

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [editing, setEditing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const timerRef  = useRef(null);
  const prevType  = useRef(null);

  // ── Reserve number when templateType changes ─────────────────────────────
  const reserve = useCallback(async (type) => {
    setLoading(true);
    setError('');
    const res = await reserveNumber(type);
    setLoading(false);
    if (res.success) {
      onChange(res.data.quotationNumber);
      onReservation?.({ reservationId: res.data.reservationId, expiresAt: res.data.expiresAt });
      startTimer(res.data.expiresAt);
    } else {
      setError('Could not reserve number. Check connection.');
    }
  }, [reserveNumber, onChange, onReservation]);

  useEffect(() => {
    if (!templateType || !autoReserve) return;
    if (prevType.current === templateType) return; // no re-reserve on same type
    prevType.current = templateType;
    reserve(templateType);
    return () => clearInterval(timerRef.current);
  }, [templateType, reserve, autoReserve]);

  // ── Countdown timer ──────────────────────────────────────────────────────
  const startTimer = (expiresAt) => {
    clearInterval(timerRef.current);
    const deadline = new Date(expiresAt).getTime();
    const tick = () => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(secs);
      if (secs === 0) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  };

  // ── Release reservation when component unmounts (form cancelled) ─────────
  const resIdRef = useRef(reservationId);
  useEffect(() => { resIdRef.current = reservationId; }, [reservationId]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (resIdRef.current) releaseReservation(resIdRef.current).catch(() => {});
    };
  }, []); // Only run on unmount

  const fmt = (s) => s != null ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '--:--';

  const isExpired = secondsLeft === 0;
  const isOk = !loading && !error && value && !isExpired;

  return (
    <div className={`rounded-2xl border-2 p-4 mb-5 transition-all ${
      isOk ? 'border-violet-400 bg-gradient-to-r from-violet-50 to-indigo-50'
           : isExpired ? 'border-red-300 bg-red-50'
           : error ? 'border-orange-300 bg-orange-50'
           : 'border-gray-200 bg-gray-50'
    }`}>
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isOk ? 'bg-violet-500' : 'bg-gray-300'}`}>
            <Lock size={14} className="text-white" />
          </div>
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
            Quotation Number
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Countdown badge */}
          {secondsLeft != null && !isExpired && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              secondsLeft > 120 ? 'bg-green-100 text-green-700' :
              secondsLeft > 60  ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700 animate-pulse'
            }`}>
              <Clock size={10} />
              {fmt(secondsLeft)}
            </div>
          )}

          {/* Edit toggle */}
          {!disabled && value && (
            <button
              type="button"
              onClick={() => setEditing(e => !e)}
              title={editing ? 'Lock number' : 'Override manually'}
              className="p-1 rounded-lg hover:bg-white/60 text-gray-400 hover:text-violet-600 transition-colors"
            >
              {editing ? <CheckCircle size={15} className="text-violet-500" /> : <Edit3 size={14} />}
            </button>
          )}

          {/* Re-reserve */}
          {(isExpired || error) && (
            <button
              type="button"
              onClick={() => reserve(templateType)}
              className="flex items-center gap-1 px-2 py-1 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700 transition-colors"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* ── Number display / input ── */}
      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Reserving quotation number…</span>
        </div>
      ) : error ? (
        <p className="text-sm text-orange-700 font-medium py-1">{error}</p>
      ) : isExpired ? (
        <p className="text-sm text-red-600 font-semibold py-1">⚠ Reservation expired — click Refresh to get a new number.</p>
      ) : editing ? (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full font-mono font-bold text-xl text-violet-800 bg-white border border-violet-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          placeholder="QTN.KVB.STD.001.A.010426"
        />
      ) : (
        <div
          className="font-mono font-bold text-2xl text-violet-800 tracking-widest py-1 cursor-default select-all"
          title="This is your assigned quotation number"
        >
          {value || '─'}
        </div>
      )}

      {/* ── Info row ── */}
      {isOk && !editing && autoReserve && (
        <p className="text-[10px] text-violet-500 mt-1 font-medium">
          🔒 Reserved exclusively for you · expires in {fmt(secondsLeft)}
        </p>
      )}
      {isOk && !editing && !autoReserve && (
        <p className="text-[10px] text-violet-500 mt-1 font-medium">
          📝 Revision Mode
        </p>
      )}
    </div>
  );
}
