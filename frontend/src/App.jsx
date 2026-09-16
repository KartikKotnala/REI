import React, { useState } from 'react';
import ArchitecturesView from './components/ArchitecturesView';
import DependencyGraphView from './components/DependencyGraphView';
import VectorKBView from './components/VectorKBView';
import ImpactSimulatorView from './components/ImpactSimulatorView';
import EvaluationDashboardView from './components/EvaluationDashboardView';
import { Layers, GitGraph, Database, Activity, BarChart3, Terminal } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState('architectures');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/30">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">Repository Evolution Intelligence</h1>
              <div className="text-xs text-slate-400 font-mono">LLM-RAG Software Change-Impact Analysis Engine</div>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-900/60 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Target Repo: SmartFix (29 files / 690 entities)
          </div>
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
        {activeView === 'architectures' && <ArchitecturesView />}
        {activeView === 'graph' && <DependencyGraphView />}
        {activeView === 'vector_kb' && <VectorKBView />}
        {activeView === 'simulator' && <ImpactSimulatorView />}
        {activeView === 'evaluation' && <EvaluationDashboardView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500 font-mono">
        Repository Evolution Intelligence (REI) &bull; Phase 1 Skeleton & Infrastructure &bull; SmartFix Benchmark Target
      </footer>
    </div>
  );
}
