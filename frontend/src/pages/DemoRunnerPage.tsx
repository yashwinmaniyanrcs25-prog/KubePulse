import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Terminal,
  Play,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import { DemoStage } from '../types';
import { api } from '../services/api';

export const DemoRunnerPage: React.FC = () => {
  const [stages, setStages] = useState<DemoStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningStageId, setRunningStageId] = useState<number | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const fetchStages = async () => {
    try {
      const data = await api.getDemoStages();
      setStages(data);
    } catch (err: any) {
      console.error('Error fetching demo stages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const handleRunStep = async (stageId: number) => {
    setRunningStageId(stageId);
    try {
      const updated = await api.runDemoStep(stageId);
      setStages((prev) => prev.map((s) => (s.stage_id === stageId ? updated : s)));
    } catch (err: any) {
      alert(`Error running step ${stageId}: ${err.message}`);
    } finally {
      setRunningStageId(null);
    }
  };

  const handleReset = async () => {
    try {
      await api.resetDemoStages();
      await fetchStages();
    } catch (err: any) {
      alert(`Error resetting stages: ${err.message}`);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const passedCount = stages.filter((s) => s.status === 'passed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              Official Hackathon Test Suite
            </span>
            <span className="text-xs text-slate-400">Problem 8: App Deployment & Scaling</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5 mt-1">
            <PlayCircle className="w-5 h-5 text-emerald-400" />
            <span>10-Stage Guided Demonstration Runner</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Execute each problem requirement sequentially with live verification of Kubernetes state and actual observed output.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs text-slate-300 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Stages</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-300 font-medium">Demonstration Progress:</span>
          <span className="font-mono text-emerald-400 font-semibold">{passedCount} of 10 Stages Verified</span>
        </div>
        <div className="w-full bg-navy-950 rounded-full h-2.5 overflow-hidden border border-navy-800">
          <div
            className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${(passedCount / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* 10 Stages List */}
      <div className="space-y-3.5">
        {stages.map((stage) => {
          const isRunning = runningStageId === stage.stage_id;
          const isPassed = stage.status === 'passed';
          const isFailed = stage.status === 'failed';

          return (
            <div
              key={stage.stage_id}
              className={`glass-card p-5 transition-all border ${
                isPassed
                  ? 'border-emerald-500/30 bg-navy-900/90'
                  : isFailed
                  ? 'border-red-500/40 bg-navy-900/90'
                  : 'border-navy-700/60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Title & Stage ID */}
                <div className="flex items-start gap-3.5">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                    isPassed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isFailed
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-navy-800 text-slate-400 border border-navy-700'
                  }`}>
                    {isPassed ? <CheckCircle2 className="w-4 h-4" /> : stage.stage_id}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{stage.title}</h3>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.2 rounded-full ${
                        isPassed
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isFailed
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-navy-800 text-slate-400'
                      }`}>
                        {stage.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{stage.description}</p>
                  </div>
                </div>

                {/* Execute Step Button */}
                <button
                  onClick={() => handleRunStep(stage.stage_id)}
                  disabled={isRunning}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    isPassed
                      ? 'bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-navy-950 font-bold shadow-md shadow-emerald-500/20'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isPassed ? 'Re-verify Step' : `Run Stage ${stage.stage_id}`}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Command Box */}
              <div className="mt-4 bg-navy-950/80 p-3 rounded-xl border border-navy-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1 font-mono">
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    <span>Command:</span>
                  </span>
                  <button
                    onClick={() => handleCopy(stage.command, `cmd-${stage.stage_id}`)}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
                  >
                    {copiedCmd === `cmd-${stage.stage_id}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="font-mono text-xs text-slate-200 select-all overflow-x-auto">
                  {stage.command}
                </pre>
              </div>

              {/* Expected vs Actual Result */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                <div className="bg-navy-950/50 p-2.5 rounded-lg border border-navy-850">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Expected Result:</span>
                  <p className="text-slate-300 leading-relaxed font-mono text-[11px]">{stage.expected_result}</p>
                </div>

                <div className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                  stage.actual_result
                    ? 'bg-navy-950/90 border-emerald-500/30 text-emerald-300'
                    : 'bg-navy-950/30 border-navy-800 text-slate-500'
                }`}>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Actual Observed Result:</span>
                  <p className="leading-relaxed">
                    {stage.actual_result || 'Stage has not yet run. Click "Run Stage" to execute verification.'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
