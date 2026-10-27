import React, { useState, useEffect } from 'react';
import ArchitecturesView from './components/ArchitecturesView';
import DependencyGraphView from './components/DependencyGraphView';
import VectorKBView from './components/VectorKBView';
import ImpactSimulatorView from './components/ImpactSimulatorView';
import EvaluationDashboardView from './components/EvaluationDashboardView';
import {
  Layers,
  GitGraph,
  Database,
  Activity,
  BarChart3,
  Terminal,
  GitBranch,
  Github,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState('architectures');
  const [health, setHealth] = useState(null);
  const [presets, setPresets] = useState([]);
  const [customRepoInput, setCustomRepoInput] = useState('');
  const [switchingRepo, setSwitchingRepo] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchHealth = () => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => {});
  };

  const fetchPresets = () => {
    fetch('/api/repository/presets')
      .then(res => res.json())
      .then(data => {
        if (data && data.presets) {
          setPresets(data.presets);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchHealth();
    fetchPresets();
  }, []);

  const switchRepo = async (target) => {
    if (!target || !target.trim()) return;
    const cleanTarget = target.trim();
    setSwitchingRepo(true);
    setErrorMessage(null);
    setStatusMessage(`Cloning and parsing '${cleanTarget}'... This extracts AST call-graphs and vectors.`);

    try {
      const res = await fetch('/api/repository/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: cleanTarget }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || `Failed to load ${cleanTarget}`);
      }

      setStatusMessage(`Successfully loaded ${data.repo_name || cleanTarget}! (${data.entities_count?.toLocaleString()} entities in ${data.processing_time_ms}ms)`);
      setCustomRepoInput('');
      fetchHealth();
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      setErrorMessage(err.message || 'Error loading repository');
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setSwitchingRepo(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customRepoInput.trim()) {
      switchRepo(customRepoInput);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/30">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                Repository Evolution Intelligence
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 font-mono">
                  v1.0.0
                </span>
              </h1>
              <div className="text-xs text-slate-400 font-mono">LLM-RAG Software Change-Impact Analysis Engine</div>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Ollama Status Badge */}
            {health?.ollama?.online ? (
              <div className="flex items-center gap-2 font-mono text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-700/60 px-3 py-1 rounded-full shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Ollama: Live ({health.ollama.active_model})
              </div>
            ) : (
              <div className="flex items-center gap-2 font-mono text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Ollama: Simulated Fallback
              </div>
            )}

            {/* Active Repository Badge */}
            <div className="flex items-center gap-2 font-mono text-xs text-indigo-300 bg-indigo-950/50 border border-indigo-800/60 px-3 py-1 rounded-full">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-white">{health?.repo_name || health?.target_repo || 'Loading...'}</span>
              {health?.entities_count ? (
                <span className="text-indigo-400 text-[11px]">
                  ({health.entities_count.toLocaleString()} entities &bull; {health.graph_nodes?.toLocaleString()} nodes)
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Dynamic GitHub Repository Ingestion Bar */}
        <div className="bg-slate-900 border-t border-slate-800/80 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Input Form for Any GitHub Repo */}
            <form onSubmit={handleCustomSubmit} className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Github className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={customRepoInput}
                  onChange={(e) => setCustomRepoInput(e.target.value)}
                  placeholder="Enter GitHub URL or owner/repo (e.g., https://github.com/psf/requests or tiangolo/fastapi)..."
                  disabled={switchingRepo}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={switchingRepo || !customRepoInput.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition flex items-center gap-1.5 shadow shadow-indigo-600/30 whitespace-nowrap"
              >
                {switchingRepo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting Repo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Load & Analyze
                  </>
                )}
              </button>
            </form>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <span className="text-[11px] font-mono text-slate-400 mr-1 whitespace-nowrap">Presets:</span>
              {(presets.length > 0 ? presets : [
                { id: 'pallets/flask', name: 'Flask' },
                { id: 'psf/requests', name: 'Requests' },
                { id: 'pallets/click', name: 'Click' },
                { id: 'SmartFix', name: 'SmartFix' }
              ]).map((p) => {
                const isActive = health?.target_repo === p.id || health?.repo_name === p.name.toLowerCase();
                return (
                  <button
                    key={p.id}
                    onClick={() => switchRepo(p.id)}
                    disabled={switchingRepo}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition flex items-center gap-1 whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white font-bold shadow'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <GitBranch className="w-3 h-3 text-indigo-400" />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status and Error Banners */}
          {statusMessage && (
            <div className="max-w-7xl mx-auto mt-2 text-xs font-mono text-indigo-300 bg-indigo-950/50 border border-indigo-800/80 rounded-md px-3 py-1.5 flex items-center gap-2">
              <Loader2 className={`w-3.5 h-3.5 text-indigo-400 ${switchingRepo ? 'animate-spin' : ''}`} />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="max-w-7xl mx-auto mt-2 text-xs font-mono text-rose-300 bg-rose-950/50 border border-rose-800/80 rounded-md px-3 py-1.5 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-6 flex space-x-1 overflow-x-auto">
          <button
            onClick={() => setActiveView('architectures')}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeView === 'architectures'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" /> Architectural Design & LLMs
          </button>

          <button
            onClick={() => setActiveView('graph')}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeView === 'graph'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitGraph className="w-4 h-4" /> Dependency Graph
          </button>

          <button
            onClick={() => setActiveView('vector_kb')}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeView === 'vector_kb'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" /> Vector Knowledge Base
          </button>

          <button
            onClick={() => setActiveView('simulator')}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeView === 'simulator'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" /> Impact Simulator
          </button>

          <button
            onClick={() => setActiveView('evaluation')}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeView === 'evaluation'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Evaluation & Metrics
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        {activeView === 'architectures' && <ArchitecturesView key={health?.target_repo} />}
        {activeView === 'graph' && <DependencyGraphView key={health?.target_repo} />}
        {activeView === 'vector_kb' && <VectorKBView key={health?.target_repo} />}
        {activeView === 'simulator' && <ImpactSimulatorView key={health?.target_repo} />}
        {activeView === 'evaluation' && <EvaluationDashboardView key={health?.target_repo} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500 font-mono">
        Repository Evolution Intelligence (REI) &bull; Phase 1 Skeleton & Infrastructure &bull; SmartFix Benchmark Target
      </footer>
    </div>
  );
}
