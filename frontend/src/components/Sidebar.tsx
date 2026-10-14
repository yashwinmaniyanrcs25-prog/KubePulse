import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Layers,
  Network,
  Activity,
  Bell,
  PlayCircle,
  Terminal,
  Settings,
  HeartHandshake,
} from 'lucide-react';
import { NavTab, ClusterStatus } from '../types';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  clusterStatus?: ClusterStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  clusterStatus,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'workloads', label: 'Workloads', icon: Boxes },
    { id: 'pods', label: 'Pods & Recovery', icon: Layers },
    { id: 'services', label: 'Services', icon: Network },
    { id: 'health', label: 'Health Checks', icon: Activity },
    { id: 'events', label: 'Events Stream', icon: Bell },
    { id: 'demo', label: 'Hackathon Demo', icon: PlayCircle, badge: 'Prob 8' },
    { id: 'guide', label: 'PowerShell Guide', icon: Terminal },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isConnected = clusterStatus?.is_connected === true;

  return (
    <aside className="w-64 bg-navy-900 border-r border-navy-700/60 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-navy-700/60 gap-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <HeartHandshake className="w-5 h-5 text-navy-950 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base text-white tracking-tight">KubePulse</span>
            <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">v1.0</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">Self-Healing & Scaling</p>
        </div>
      </div>

      {/* Real Cluster Connection Pill */}
      <div className="px-4 py-3 border-b border-navy-800">
        <div className="bg-navy-950/80 rounded-lg p-2.5 border border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <div className="text-left">
              <p className="text-[11px] font-medium text-slate-300 truncate max-w-[120px]">
                {isConnected ? clusterStatus?.cluster_name : 'Cluster Offline'}
              </p>
              <p className="text-[10px] text-slate-400">
                {isConnected ? `${clusterStatus?.auth_type}` : 'Disconnected'}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            isConnected
              ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/60'
              : 'text-red-400 bg-red-950/80 border-red-800/60'
          }`}>
            {clusterStatus?.active_namespace || 'kubepulse'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-300 border-l-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-navy-700/60 text-xs text-slate-400">
        <div className="bg-navy-950/60 p-2.5 rounded-lg border border-navy-800">
          <p className="text-[11px] font-medium text-slate-300">DevOps Hackathon</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Problem 8: App Deployment & Scaling</p>
        </div>
      </div>
    </aside>
  );
};
