import React, { useState } from 'react';
import { Play, Activity, AlertTriangle, CheckCircle, ShieldAlert, Cpu, Layers, ListOrdered } from 'lucide-react';

export default function ImpactSimulatorView() {
  const [targetSymbol, setTargetSymbol] = useState('RAGService.retrieve');
  const [filePath, setFilePath] = useState('services/rag/rag_engine.py');
  const [diffSnippet, setDiffSnippet] = useState('- def retrieve(query, top_k=5):\n+ def retrieve(query, top_k=5, enable_rerank=True):');
  const [activeTab, setActiveTab] = useState('HYBRID');

  const [staticResult, setStaticResult] = useState(null);
  const [hybridResult, setHybridResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = () => {
    setLoading(true);

    const changeInput = {
      target_symbol: targetSymbol,
      file_path: filePath,
      diff_snippet: diffSnippet,
      change_type: 'MODIFICATION'
    };

    Promise.all([
      fetch('/api/impact/simulate/static', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_input: changeInput, fusion_alpha: 0.6 })
      }).then(r => r.json()),
      fetch('/api/impact/simulate/hybrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_input: changeInput })
      }).then(r => r.json())
    ])
      .then(([sRes, hRes]) => {
        setStaticResult(sRes);
        setHybridResult(hRes);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-indigo-400" /> Change Impact Simulator
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Simulate code modifications on SmartFix components and compare predicted impact propagation across both architectures.
        </p>
      </div>

      {/* Target Input Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Configure Synthetic Code Modification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Symbol / Function</label>
            <input
              type="text"
              value={targetSymbol}
              onChange={(e) => setTargetSymbol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">File Path</label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Diff Snippet</label>
          <textarea
            rows={3}
            value={diffSnippet}
            onChange={(e) => setDiffSnippet(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg flex items-center gap-2 transition disabled:opacity-50"
        >
          <Play className="w-4 h-4 fill-current" /> {loading ? 'Running Impact Engines...' : 'Execute Impact Analysis'}
        </button>
      </div>

      {/* Results View */}
      {(staticResult || hybridResult) && (
        <div className="space-y-6">
          {/* Architecture Switch Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setActiveTab('HYBRID')}
              className={`px-6 py-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
                activeTab === 'HYBRID'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" /> Hybrid Intelligent Analysis (Agentic)
            </button>
            <button
              onClick={() => setActiveTab('STATIC')}
              className={`px-6 py-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
                activeTab === 'STATIC'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" /> Static Dependency + RAG (Pipeline)
            </button>
          </div>

          {/* Hybrid Intelligent Result View */}
          {activeTab === 'HYBRID' && hybridResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Overall Risk Level</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">{hybridResult.overall_risk_level}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Consensus Score</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">{(hybridResult.consensus_score * 100).toFixed(1)}%</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Execution Latency</div>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">{hybridResult.execution_latency_ms} ms</div>
                </div>
              </div>

              {/* Multi-Agent Reasoning Step Outputs */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Multi-Agent Sub-Task Outputs (&le; 13B Models)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {hybridResult.agent_outputs.map((agent, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-emerald-400">{agent.agent_name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          {(agent.confidence_score * 100).toFixed(0)}% Conf
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{agent.specialized_llm_used}</div>
                      <p className="text-xs text-slate-300 italic">{agent.reasoning_summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Traceable Proof Chain */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Traceable Proof Chain</h3>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 font-mono text-xs text-slate-300">
                  {hybridResult.proof_chain.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Static RAG Result View */}
          {activeTab === 'STATIC' && staticResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Graph Candidates</div>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">{staticResult.static_graph_candidates_count}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Vector Chunks</div>
                  <div className="text-2xl font-bold text-blue-400 mt-1">{staticResult.vector_retrieved_chunks_count}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Execution Latency</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">{staticResult.execution_latency_ms} ms</div>
                </div>
              </div>

              {/* Pipeline Stages */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pipeline Execution Stages</h3>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 font-mono text-xs text-slate-300">
                  {staticResult.pipeline_stages.map((st, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-indigo-300 font-semibold">{st.stage}</span>
                      <span className="text-slate-400">{st.output_count !== undefined ? `${st.output_count} items` : st.model}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Impacted Candidates Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Predicted Impacted Repository Entities</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-3 px-4">Entity ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">File Path</th>
                    <th className="py-3 px-4">Impact Score</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Impact Mechanism</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {((activeTab === 'HYBRID' ? hybridResult?.ranked_impacts : staticResult?.predicted_impacts) || []).map((imp, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-indigo-300 font-semibold">{imp.name}</td>
                      <td className="py-3 px-4 uppercase">{imp.type}</td>
                      <td className="py-3 px-4 text-slate-400">{imp.file_path}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">{imp.impact_score.toFixed(3)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          imp.severity === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {imp.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{imp.impact_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
