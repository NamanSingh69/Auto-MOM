

export function Skeleton() {
    return (
        <div className="w-full glass-card p-8 border-brand-500/20 bg-slate-900/60">
            {/* Header Skeleton */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-6 mb-6">
                <div className="w-2/3">
                    <div className="skeleton-shimmer h-8 w-full mb-3"></div>
                    <div className="skeleton-shimmer h-4 w-1/3"></div>
                </div>
                <div className="skeleton-shimmer h-6 w-20"></div>
            </div>

            <div className="space-y-6">
                {/* Summary Skeleton */}
                <div>
                    <div className="skeleton-shimmer h-6 w-1/4 mb-3"></div>
                    <div className="space-y-2 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                        <div className="skeleton-shimmer h-4 w-full"></div>
                        <div className="skeleton-shimmer h-4 w-5/6"></div>
                        <div className="skeleton-shimmer h-4 w-4/6"></div>
                    </div>
                </div>

                {/* Two Column Skeleton */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <div className="skeleton-shimmer h-6 w-1/3 mb-3"></div>
                        <ul className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <li key={i} className="flex gap-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                    <div className="w-5 h-5 rounded-full skeleton-shimmer flex-shrink-0" />
                                    <div className="skeleton-shimmer h-4 w-full mt-0.5"></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div className="skeleton-shimmer h-6 w-1/3 mb-3"></div>
                        <ul className="space-y-2">
                            {[1, 2].map((i) => (
                                <li key={i} className="flex gap-3 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                    <div className="w-5 h-5 rounded-full skeleton-shimmer flex-shrink-0" />
                                    <div className="skeleton-shimmer h-4 w-full mt-0.5"></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
