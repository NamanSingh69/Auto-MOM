import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, FileAudio, FileVideo, Loader2, Sparkles, AlertCircle, Settings } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import AgentModal from './AgentModal';
import { Skeleton } from './components/Skeleton';
import { EmptyState } from './components/EmptyState';
import { RateLimitBadge, consumeRateLimit, canMakeRequest } from './components/RateLimitBadge';

type AppState = 'IDLE' | 'RECORDING' | 'UPLOADING' | 'ANALYZING' | 'SUCCESS' | 'ERROR';

export default function App() {
  const [state, setState] = useState<AppState>('IDLE');
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [minutesData, setMinutesData] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<'pro' | 'fast'>('fast');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3.1-flash-lite-preview');
  const [quota, setQuota] = useState({ remaining: 1000, limit: 1000 });
  const [rateLimitOk, setRateLimitOk] = useState(true);

  const DAILY_LIMITS: Record<string, Record<string, number>> = {
    "pro": { "3.1": 50, "2.5": 25 },
    "flash": { "3.1": 500, "2.5": 250 },
    "flash-lite": { "3.1": 1000, "2.5": 500 }
  };

  const updateQuota = (currentMode: 'pro' | 'fast') => {
    const stored = localStorage.getItem("automom_rate_limits");
    const today = new Date().toISOString().slice(0, 10);
    let limits = { date: today, used: {} as Record<string, number> };
    if (stored) {
      const p = JSON.parse(stored);
      if (p.date === today) limits = p;
    } else {
      localStorage.setItem("automom_rate_limits", JSON.stringify(limits));
    }
    const tier = currentMode === "pro" ? "pro" : "flash-lite";
    const limit = DAILY_LIMITS[tier]?.["3.1"] || 1000;
    const used = limits.used[tier] || 0;
    setQuota({ remaining: Math.max(0, limit - used), limit });
  };

  const trackUsage = (modelName: string) => {
    const tier = modelName.includes("pro") ? "pro" : modelName.includes("flash-lite") ? "flash-lite" : "flash";
    const stored = localStorage.getItem("automom_rate_limits");
    const today = new Date().toISOString().slice(0, 10);
    let limits = { date: today, used: {} as Record<string, number> };
    if (stored) {
      const p = JSON.parse(stored);
      if (p.date === today) limits = p;
    }
    limits.used[tier] = (limits.used[tier] || 0) + 1;
    localStorage.setItem("automom_rate_limits", JSON.stringify(limits));
    updateQuota(mode);
  };

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll rate limit status for button state
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitOk(canMakeRequest());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    const savedModel = localStorage.getItem('gemini_model');
    const savedMode = localStorage.getItem('gemini_mode') as 'pro' | 'fast';
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setModel(savedModel);
    if (savedMode) setMode(savedMode);
    updateQuota(savedMode || 'fast');
  }, []);

  const handleSaveConfig = (key: string, selectedModel: string, selectedMode: 'pro' | 'fast') => {
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('gemini_model', selectedModel);
    localStorage.setItem('gemini_mode', selectedMode);
    setApiKey(key);
    setModel(selectedModel);
    setMode(selectedMode);
    updateQuota(selectedMode);
    toast.success('Agent logic saved to local persistent storage');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioChunks(chunks);
        setAudioUrl(url);
      };

      mediaRecorder.current.start();
      setState('RECORDING');
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (err) {
      toast.error('Microphone access denied or unavailable');
      setState('ERROR');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && state === 'RECORDING') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setState('IDLE');
      toast.success('Recording saved locally');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioChunks([file]); // Wrap file as Blob
      toast.success(`Attached ${file.name}`);
    }
  };

  const generateMinutes = async () => {
    if (!audioUrl || audioChunks.length === 0) {
      toast.error('Please upload or record a media file first.', { id: 'analyze-validation' });
      return;
    }
    
    if (state === 'RECORDING') {
      toast.error('Please stop recording before synthesizing.', { id: 'analyze-validation' });
      return;
    }

    if (state === 'UPLOADING' || state === 'ANALYZING') {
      return; // Silently ignore multiple clicks while already processing
    }

    // Check per-minute rate limit
    if (!consumeRateLimit()) return;

    const currentApiKey = localStorage.getItem('gemini_api_key') || "";
    const currentModel = localStorage.getItem('gemini_model') || "gemini-3.1-flash-lite-preview";

    setState('UPLOADING');
    
    const formData = new FormData();
    // Check if it's a File (from upload) or Blob (from recorder)
    const isFile = audioChunks.length === 1 && audioChunks[0] instanceof File;
    if (isFile) {
      const file = audioChunks[0] as File;
      formData.append('media', file);
    } else {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      formData.append('media', blob, 'meeting.webm');
    }
    
    formData.append('model', currentModel);

    try {
      toast.loading('Uploading audio to multimodal AI cluster...', { id: 'analyze' });

      const API_URL = import.meta.env.PROD ? '/api/synthesize' : 'http://localhost:5000/api/synthesize';

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'X-Gemini-Key': currentApiKey
        },
        body: formData
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("⏳ Rate limit reached — try again in ~1 minute, or switch to Fast mode.");
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server rejected the request with status ${response.status}`);
      }

      setState('ANALYZING');
      const data = await response.json();
      trackUsage(data._model_used || currentModel);

      toast.success('Minutes generated successfully!', { id: 'analyze' });
      setMinutesData(data);
      setState('SUCCESS');

    } catch (err: any) {
      toast.error(err.message || 'Synthesis failed. Please try again.', { id: 'analyze' });
      setState('ERROR');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen p-6 md:p-12 lg:p-24 flex flex-col items-center relative overflow-hidden bg-surface">
      <Toaster theme="dark" position="top-center" />
      <AgentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveConfig} initialMode={mode} initialModel={model} quotaRemaining={quota.remaining} quotaLimit={quota.limit} />

      {/* Settings Gear & Mode Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
        <RateLimitBadge />
        <button
          onClick={() => {
            const newMode = mode === 'pro' ? 'fast' : 'pro';
            const newModel = newMode === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview';
            handleSaveConfig(apiKey, newModel, newMode);
          }}
          aria-label={`Switch to ${mode === 'pro' ? 'Fast' : 'Pro'} mode`}
          className={`px-4 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all border ${mode === 'pro'
            ? 'bg-gradient-to-br from-indigo-600 to-brand-600 border-indigo-500/30 text-white shadow-lg shadow-indigo-500/20'
            : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 text-slate-300'
            }`}
        >
          {mode === 'pro' ? '⚡ PRO' : '🚀 FAST'}
        </button>
        <button
          onClick={() => setIsModalOpen(true)}
          aria-label="Open settings"
          className="p-3 min-h-[44px] min-w-[44px] rounded-xl bg-surface-2 border border-slate-800 text-slate-400 hover:text-white hover:border-brand-500/50 transition-all relative flex items-center justify-center"
        >
          <Settings size={20} />
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#12141d] ${quota.remaining / quota.limit > 0.5 ? 'bg-brand-500' : 'bg-rose-500'}`}></div>
        </button>
      </div>

      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-[100px] -z-10" />

      <div className="max-w-4xl w-full z-10 flex flex-col items-center">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Sparkles size={14} /> Auto MOM Web
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Autonomous <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-rose-300">Minutes of Meeting</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            In-browser audio capture and LLM inference. Record your sync or upload an existing media file to generate structured action items instantly.
          </p>
        </div>

        {/* Core Interface */}
        <div className="glass-card w-full max-w-xl p-8 flex flex-col items-center relative overflow-hidden border-rose-500/20 mb-12">
          {state === 'RECORDING' && (
            <div className="absolute inset-0 bg-brand-500/5 animate-pulse pointer-events-none" />
          )}

          <div className="text-6xl font-mono text-white mb-8 tracking-wider">
            {formatTime(recordingTime)}
          </div>

          <div className="flex gap-6 mb-8">
            {state === 'RECORDING' ? (
              <button
                onClick={stopRecording}
                aria-label="Stop recording"
                className="w-20 h-20 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center transition-transform hover:scale-105 shadow-[0_0_30px_rgba(244,63,94,0.4)]"
              >
                <Square className="w-8 h-8 fill-white text-white" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={state === 'UPLOADING' || state === 'ANALYZING'}
                aria-label="Start recording meeting"
                className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 hover:border-brand-500/50 hover:bg-slate-700 flex items-center justify-center transition-all disabled:opacity-50 group"
              >
                <Mic className="w-8 h-8 text-brand-400 group-hover:text-brand-300 transition-colors" />
              </button>
            )}
          </div>

          <div className="w-full h-px bg-slate-800 my-6 relative flex items-center justify-center">
            <span className="bg-surface px-4 text-xs text-slate-500 font-bold uppercase tracking-widest">OR</span>
          </div>

          <div className="w-full flex justify-between items-center gap-4">
            <input
              type="file"
              accept="audio/*,video/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload media file"
              className="px-4 py-3 min-h-[44px] bg-slate-800/50 border border-slate-700 rounded-xl flex-1 flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors text-slate-300"
            >
              {audioChunks.length > 0 && audioChunks[0].type.startsWith('video/') ? <FileVideo size={18} /> : <FileAudio size={18} />}
              {audioUrl ? 'Change File' : 'Upload Media'}
            </button>

            <button
              onClick={generateMinutes}
              aria-label="Synthesize meeting minutes"
              className={`px-6 py-3 min-h-[44px] rounded-xl flex-1 flex items-center justify-center gap-2 transition-colors font-bold text-white shadow-lg ${
                state === 'UPLOADING' || state === 'ANALYZING' || !rateLimitOk
                  ? 'bg-slate-800 text-slate-500 shadow-none cursor-pointer'
                  : 'bg-brand-600 hover:bg-brand-500'
              }`}
            >
              {state === 'UPLOADING' || state === 'ANALYZING' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Synthesize
            </button>
          </div>

          {audioUrl && state !== 'RECORDING' && (
            <div className="w-full mt-6 p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center gap-4">
              {audioChunks.length > 0 && audioChunks[0].type.startsWith('video/') ? (
                <video src={audioUrl} controls className="w-full max-h-64 rounded bg-black" />
              ) : (
                <audio src={audioUrl} controls className="w-full h-10 custom-audio" />
              )}
            </div>
          )}

          {!audioUrl && state !== 'RECORDING' && (
            <EmptyState />
          )}

        </div>

        {/* Results Section */}
        {(state === 'UPLOADING' || state === 'ANALYZING') && (
          <Skeleton />
        )}

        {state === 'SUCCESS' && minutesData && (
          <div className="w-full glass-card p-8 border-brand-500/20 bg-slate-900/60 transition-all duration-500">
            <div className="flex justify-between items-start border-b border-slate-800 pb-6 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{minutesData.title}</h2>
                <p className="text-slate-400">{minutesData.date}</p>
              </div>
              <div className="bg-brand-500/10 text-brand-400 px-3 py-1 rounded border border-brand-500/20 text-xs font-bold uppercase">
                Verified
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-200 mb-2">Executive Summary</h3>
                <p className="text-slate-400 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">{minutesData.summary}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-rose-300 mb-3 flex items-center gap-2">
                    <Upload size={18} /> Action Items
                  </h3>
                  <ul className="space-y-2">
                    {minutesData.actionItems.map((item: string, i: number) => (
                      <li key={i} className="flex gap-3 text-slate-300 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                        <div className="w-5 h-5 rounded-full border border-rose-500/50 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-brand-300 mb-3 flex items-center gap-2">
                    <AlertCircle size={18} /> Key Decisions
                  </h3>
                  <ul className="space-y-2">
                    {minutesData.decisions.map((item: string, i: number) => (
                      <li key={i} className="flex gap-3 text-slate-300 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                        <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
