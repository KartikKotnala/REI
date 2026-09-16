import React, { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, CheckCircle, Zap, Shield, HardDrive, Award } from 'lucide-react';

export default function EvaluationDashboardView() {
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchEvaluation = () => {
    setLoading(true);
    fetch('/api/eval/benchmark')
      .then(res => res.json())
      .then(d => {
        setEvalData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEvaluation();
  }, []);

  if (!evalData && loading) return <div className="p-8 text-slate-400">Running Benchmark Evaluation Scripts...</div>;
  if (!evalData) return <div className="p-8 text-slate-400">Click below to run evaluation benchmark suite.</div>;

  const { static_dependency_rag, hybrid_intelligent_analysis, scenarios_evaluated, scenarios_detail } = evalData;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-indigo-400" /> Evaluation Metrics & Benchmarking Suite
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Empirical comparison of Prediction Quality, Ranking Quality, and System Performance across {scenarios_evaluated} controlled SmartFix change scenarios.
          </p>
        </div>
        <button
          onClick={fetchEvaluation}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Evaluating...' : 'Re-run Evaluation Benchmark'}
        </button>
      </div>

      {/* Metrics Cards Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prediction Quality Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="text-amber-400 w-4 h-4" /> Prediction Quality
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">Precision / Recall / F1</span>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Precision</span>
                <span className="text-indigo-400">{static_dependency_rag.prediction_quality.mean_precision} (Static)</span>
                <span className="text-emerald-400 font-bold">{hybrid_intelligent_analysis.prediction_quality.mean_precision} (Hybrid)</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width: `${static_dependency_rag.prediction_quality.mean_precision * 100}%` }}></div>
                <div className="bg-emerald-500 h-full" style={{ width: `${hybrid_intelligent_analysis.prediction_quality.mean_precision * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Recall</span>
                <span className="text-indigo-400">{static_dependency_rag.prediction_quality.mean_recall} (Static)</span>
                <span className="text-emerald-400 font-bold">{hybrid_intelligent_analysis.prediction_quality.mean_recall} (Hybrid)</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width: `${static_dependency_rag.prediction_quality.mean_recall * 100}%` }}></div>
                <div className="bg-emerald-500 h-full" style={{ width: `${hybrid_intelligent_analysis.prediction_quality.mean_recall * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>F1-Score</span>
                <span className="text-indigo-400">{static_dependency_rag.prediction_quality.mean_f1} (Static)</span>
                <span className="text-emerald-400 font-bold">{hybrid_intelligent_analysis.prediction_quality.mean_f1} (Hybrid)</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width: `${static_dependency_rag.prediction_quality.mean_f1 * 100}%` }}></div>
                <div className="bg-emerald-500 h-full" style={{ width: `${hybrid_intelligent_analysis.prediction_quality.mean_f1 * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Ranking Quality Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="text-emerald-400 w-4 h-4" /> Ranking Quality
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">MRR / MAP / NDCG</span>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>MRR (Mean Reciprocal Rank)</span>
                <span className="text-indigo-400">{static_dependency_rag.ranking_quality.mrr}</span>
                <span className="text-emerald-400 font-bold">{hybrid_intelligent_analysis.ranking_quality.mrr}</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width: `${static_dependency_rag.ranking_quality.mrr * 100}%` }}></div>
                <div className="bg-emerald-500 h-full" style={{ width: `${hybrid_intelligent_analysis.ranking_quality.mrr * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>MAP (Mean Avg Precision)</span>
                <span className="text-indigo-400">{static_dependency_rag.ranking_quality.map}</span>
                <span className="text-emerald-400 font-bold">{hybrid_intelligent_analysis.ranking_quality.map}</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width: `${static_dependency_rag.ranking_quality.map * 100}%` }}></div>
                <div className="bg-emerald-500 h-full" style={{ width: `${hybrid_intelligent_analysis.ranking_quality.map * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>NDCG @ K=5</span>
                <span className="text-indigo-400">{static_dependency_rag.ranking_quality.ndcg_at_5}</span>
                <span className="text-emerald-400 font-bold">{hybrid_intelligent_analysis.ranking_quality.ndcg_at_5}</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width: `${static_dependency_rag.ranking_quality.ndcg_at_5 * 100}%` }}></div>
                <div className="bg-emerald-500 h-full" style={{ width: `${hybrid_intelligent_analysis.ranking_quality.ndcg_at_5 * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* System Performance Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="text-purple-400 w-4 h-4" /> System Performance
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">Resource Overhead</span>
          </div>

          <div className="space-y-4 font-mono text-xs text-slate-300">
            <div className="flex justify-between bg-slate-950 p-3 rounded border border-slate-800">
              <span>Avg Latency (ms)</span>
              <span className="text-purple-400 font-bold">{static_dependency_rag.system_performance.avg_latency_ms} ms</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-3 rounded border border-slate-800">
              <span>Peak RAM Usage (MB)</span>
              <span className="text-amber-400 font-bold">{static_dependency_rag.system_performance.max_memory_mb} MB</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-3 rounded border border-slate-800">
              <span>CPU Utilization</span>
              <span className="text-emerald-400 font-bold">{static_dependency_rag.system_performance.cpu_utilization_pct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controlled Benchmark Scenarios List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">SmartFix Synthetic Controlled Change Scenarios ({scenarios_detail.length})</h3>
        <div className="space-y-3">
          {scenarios_detail.map((sc, idx) => (
            <div key={idx} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-indigo-400 font-mono">{sc.scenario_id}: {sc.title}</span>
                <span className="text-xs font-mono text-slate-400">{sc.file_path}</span>
              </div>
              <p className="text-xs text-slate-300">{sc.description}</p>
              <div className="bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px] text-slate-400 whitespace-pre">
                {sc.diff_snippet}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
