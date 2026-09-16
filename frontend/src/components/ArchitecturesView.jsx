import React, { useState, useEffect } from 'react';
import { Layers, Cpu, ShieldCheck, GitBranch, ArrowRight, Zap, Database } from 'lucide-react';

export default function ArchitecturesView() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/architectures')
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err));
  }, []);

  if (!data) return <div className="p-8 text-slate-400">Loading Architecture Specifications...</div>;

  const { sub_13b_model_matrix, architectures } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="text-indigo-400" /> Architectural Design & Sub-13B LLM Matrix
        </h2>
        <p className="text-slate-400 mt-1">
          Comparative data flows, interfaces, and candidate model taxonomy for Repository Evolution Intelligence (REI).
        </p>
      </div>

      {/* Dual Architecture Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Architecture 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg hover:border-indigo-500/50 transition">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full text-xs font-semibold uppercase tracking-wider">
              Architecture 1: Multi-stage Pipeline
            </span>
            <span className="text-xs text-slate-400 font-mono">Deterministic Structure</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Static Dependency + RAG</h3>
          <p className="text-slate-400 text-sm mb-4">
            A multi-stage pipeline combining static structural call-graph traversal with dense vector code chunk retrieval.
          </p>
          <div className="space-y-3 mb-6 bg-slate-950/60 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
            {architectures[0].stages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{stage}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-indigo-300 bg-indigo-950/40 p-3 rounded border border-indigo-900/50">
            <strong>Key Strength:</strong> {architectures[0].strengths}
          </div>
        </div>

        {/* Architecture 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg hover:border-emerald-500/50 transition">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold uppercase tracking-wider">
              Architecture 2: Agentic Orchestration
            </span>
            <span className="text-xs text-slate-400 font-mono">Semantic-Symbolic Reasoning</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Hybrid Intelligent Impact Analysis</h3>
          <p className="text-slate-400 text-sm mb-4">
            An autonomous, graph-informed multi-LLM agentic orchestration system with cross-attention re-ranking.
          </p>
          <div className="space-y-3 mb-6 bg-slate-950/60 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
            {architectures[1].components.map((comp, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{comp}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-emerald-300 bg-emerald-950/40 p-3 rounded border border-emerald-900/50">
            <strong>Key Strength:</strong> {architectures[1].strengths}
          </div>
        </div>
      </div>

      {/* Sub-13B Model Selection Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Cpu className="text-amber-400" /> Specialized LLM Selection Matrix (Strictly &le; 13B Parameters)
        </h3>
        <p className="text-slate-400 text-xs mb-6">
          Task-specialized candidate models deployed across sub-system components to optimize latency and local execution.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                <th className="py-3 px-4">Sub-Task Role</th>
                <th className="py-3 px-4">Primary Candidate (&le; 13B)</th>
                <th className="py-3 px-4">Fallback Candidate</th>
                <th className="py-3 px-4">Params</th>
                <th className="py-3 px-4">Specialization Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 text-xs">
              {Object.entries(sub_13b_model_matrix).map(([key, item]) => (
                <tr key={key} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 font-semibold text-indigo-300">{item.role}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{item.primary_model}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{item.fallback_model}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded font-mono text-[11px]">
                      {item.param_count}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{item.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
