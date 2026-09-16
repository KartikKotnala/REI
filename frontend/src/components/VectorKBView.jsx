import React, { useState } from 'react';
import { Database, Search, Sparkles, FileCode, CheckCircle } from 'lucide-react';

export default function VectorKBView() {
  const [query, setQuery] = useState('safety engine evaluate equipment rules');
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    fetch('/api/vector-db/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK })
    })
      .then(res => res.json())
      .then(d => {
        setResults(d);
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
          <Database className="text-indigo-400" /> Vector Knowledge Base Search
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Perform semantic code vector retrieval over SmartFix AST entities, docstrings, and code chunks.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Semantic Search Query
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. RAG service document retrieval function..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Top-K Chunks
            </label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg flex items-center gap-2 transition disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" /> {loading ? 'Searching Vector Space...' : 'Perform Vector Search'}
        </button>
      </form>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Retrieved Vector Matches ({results.count})</h3>
            <span className="text-xs font-mono text-slate-400">Embedding: Nomic-Embed-Code / CodeBERT</span>
          </div>

          <div className="space-y-4">
            {results.results.map((item, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center justify-center font-mono">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="font-mono font-bold text-white">{item.name}</h4>
                      <div className="text-xs font-mono text-slate-400">{item.file_path}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono font-bold">
                      Score: {item.similarity_score}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono uppercase">
                      {item.type}
                    </span>
                  </div>
                </div>

                {item.signature && (
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-xs font-mono text-indigo-300">
                    {item.signature}
                  </div>
                )}

                <div className="bg-slate-950/60 p-3 rounded border border-slate-800/80 text-xs font-mono text-slate-400">
                  {item.snippet}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
