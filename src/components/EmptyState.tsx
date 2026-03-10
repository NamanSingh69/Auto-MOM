import { Mic } from 'lucide-react';

export function EmptyState() {
    return (
        <div className="w-full glass-card p-12 mt-8 border-dashed border-2 border-slate-800/50 bg-slate-900/30 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700">
                <Mic className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-300 mb-2">No Meeting Data Yet</h3>
            <p className="text-slate-500 max-w-sm">
                Click the microphone above to start recording, or upload an existing meeting audio file to generate your minutes.
            </p>
        </div>
    );
}
