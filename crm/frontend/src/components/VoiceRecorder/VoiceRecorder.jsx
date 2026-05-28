import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';

const formatTime = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/**
 * Self-contained voice recorder that calls onRecordingComplete(blob) with
 * the ACTUAL blob from the onstop handler — not from a stale state closure.
 */
export default function VoiceRecorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording]   = useState(false);
  const [audioUrl,    setAudioUrl]      = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Use a ref to capture the blob from the async onstop event
  const blobRef          = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const streamRef        = useRef(null);
  const timerRef         = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        // Create blob here — this is the ONLY correct place to access it
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url  = URL.createObjectURL(blob);

        // Store in ref so handleStop/clear can read it
        blobRef.current = blob;
        setAudioUrl(url);

        // Immediately notify parent with the real blob
        onRecordingComplete(blob);

        // Stop mic tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioUrl(null);
      blobRef.current = null;

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Could not access microphone. Please grant permission.');
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const handleClear = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
    blobRef.current = null;
    onRecordingComplete(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  }, [audioUrl, isRecording, onRecordingComplete]);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
      {!audioUrl ? (
        <>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="font-mono text-sm font-medium text-gray-700">
              {formatTime(recordingTime)}
            </span>
            {isRecording && (
              <span className="text-xs text-red-500 animate-pulse font-medium ml-2">Recording...</span>
            )}
          </div>

          <div className="flex gap-2">
            {!isRecording ? (
              <button type="button" onClick={startRecording}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-medium text-sm rounded-lg transition-colors">
                <Mic size={16} /> Record Voice Note
              </button>
            ) : (
              <button type="button" onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white hover:bg-gray-900 font-medium text-sm rounded-lg transition-colors shadow-sm">
                <Square size={16} /> Stop
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="w-full flex items-center justify-between gap-4">
          <audio src={audioUrl} controls className="h-10 flex-1 max-w-full" />
          <button type="button" onClick={handleClear}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Recording">
            <Trash2 size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
