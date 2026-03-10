

export function Skeleton() {
    return (
        <div className="w-full glass-card p-8 border-brand-500/20 bg-slate-900/60 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-6 mb-6">
                <div className="w-2/3">
                    <div className="h-8 bg-slate-800 rounded w-full mb-3"></div>
                    <div className="h-4 bg-slate-800/50 rounded w-1/3"></div>
                </div>
                <div className="h-6 w-20 bg-brand-500/20 rounded"></div>
            </div>

            <div className="space-y-6">
                {/* Summary Skeleton */}
                <div>
                    <div className="h-6 bg-slate-800 rounded w-1/4 mb-3"></div>
                    <div className="space-y-2 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                        <div className="h-4 bg-slate-800/50 rounded w-full"></div>
                        <div className="h-4 bg-slate-800/50 rounded w-5/6"></div>
                        <div className="h-4 bg-slate-800/50 rounded w-4/6"></div>
                    </div>
                </div>

                {/* Two Column Skeleton */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <div className="h-6 bg-rose-900/40 rounded w-1/3 mb-3"></div>
                        <ul className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <li key={i} className="flex gap-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                    <div className="w-5 h-5 rounded-full bg-slate-800 flex-shrink-0" />
                                    <div className="h-4 bg-slate-800/50 rounded w-full mt-0.5"></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div className="h-6 bg-brand-900/40 rounded w-1/3 mb-3"></div>
                        <ul className="space-y-2">
                            {[1, 2].map((i) => (
                                <li key={i} className="flex gap-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                    <div className="w-5 h-5 rounded-full bg-slate-800 flex-shrink-0" />
                                    <div className="h-4 bg-slate-800/50 rounded w-full mt-0.5"></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
