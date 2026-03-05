import { useState, useEffect } from 'react';
import { Key, Save, X, Sparkles } from 'lucide-react';

interface AgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: string, model: string) => void;
}

export default function AgentModal({ isOpen, onClose, onSave }: AgentModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-1.5-flash');

    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        const savedModel = localStorage.getItem('gemini_model');
        if (savedKey) setApiKey(savedKey);
        if (savedModel) setModel(savedModel);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface-2 border border-slate-700/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden shadow-brand-500/10">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-brand-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Agent Config</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                            <Key size={16} className="text-brand-400" /> API Boundary (Gemini)
                        </label>
                        <input
                            type="password"
                            placeholder="AIzaSy..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full bg-surface border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 transition-all font-mono text-sm"
                            autoComplete="off"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300">Inference Engine</label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-surface border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 transition-all appearance-none"
                        >
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Context)</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast Audio)</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Experimental)</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-900/50 border-t border-slate-700/50 flex justify-end">
                    <button
                        onClick={() => {
                            onSave(apiKey, model);
                            onClose();
                        }}
                        disabled={!apiKey.trim()}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(225,29,72,0.3)] disabled:shadow-none"
                    >
                        <Save size={18} /> Default Profile
                    </button>
                </div>
            </div>
        </div>
    );
}
