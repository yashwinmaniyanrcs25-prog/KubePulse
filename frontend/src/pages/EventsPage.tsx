import React, { useState } from 'react';
import { Bell, Search, Filter, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { EventItem } from '../types';

interface EventsPageProps {
  events: EventItem[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const EventsPage: React.FC<EventsPageProps> = ({
  events,
  onRefresh,
  isRefreshing,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Normal' | 'Warning'>('ALL');

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      evt.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.object_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || evt.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-cyan-400" />
            <span>Kubernetes Cluster Events Stream</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit log of scheduling, scaling, container lifecycle, and probe events.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Events</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-navy-900/80 p-3.5 rounded-xl border border-navy-700/60">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by reason, pod, or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-navy-950 border border-navy-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Type:</span>
          {(['ALL', 'Normal', 'Warning'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-navy-950 text-slate-400 hover:text-slate-200 border border-navy-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Events Timeline List */}
      <div className="glass-card divide-y divide-navy-800">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((evt) => {
            const isWarning = evt.type === 'Warning';
            return (
              <div key={evt.id} className="p-4 hover:bg-navy-800/30 transition-colors flex items-start gap-3.5">
                <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  isWarning ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                }`}>
                  {isWarning ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{evt.reason}</span>
                      <span className="text-[10px] font-mono bg-navy-950 text-slate-400 px-2 py-0.5 rounded border border-navy-800">
                        {evt.object_kind}: {evt.object_name}
                      </span>
                      {evt.count > 1 && (
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded">
                          x{evt.count}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'just now'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 leading-relaxed font-mono">
                    {evt.message}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            No events match your filter criteria.
          </div>
        )}
      </div>
    </div>
  );
};
