import React, { useState, useEffect } from 'react';
import { GitGraph, Search, Filter, Code, Box, Link, Tag } from 'lucide-react';

export default function DependencyGraphView() {
  const [graphData, setGraphData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedEntity, setSelectedEntity] = useState(null);

  useEffect(() => {
    fetch('/api/graph/dependency')
      .then(res => res.json())
      .then(d => {
        setGraphData(d);
        if (d.nodes && d.nodes.length > 0) {
          setSelectedEntity(d.nodes[0]);
        }
      })
      .catch(err => console.error(err));
  }, []);

  if (!graphData) return <div className="p-8 text-slate-400">Loading Dependency Knowledge Graph...</div>;

  const filteredNodes = graphData.nodes.filter(n => {
    const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          n.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'ALL' || n.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getEntityConnections = (nodeId) => {
    if (!nodeId) return { incoming: [], outgoing: [] };
    const incoming = graphData.links.filter(l => l.target === nodeId);
    const outgoing = graphData.links.filter(l => l.source === nodeId);
    return { incoming, outgoing };
  };

  const connections = selectedEntity ? getEntityConnections(selectedEntity.id) : { incoming: [], outgoing: [] };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitGraph className="text-indigo-400" /> SmartFix Dependency Knowledge Graph
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            AST entity graph extracted from SmartFix Python repository ({graphData.total_nodes} entities, {graphData.total_edges} dependencies).
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg font-mono text-xs text-indigo-300">
          <span>{graphData.total_nodes} Nodes</span>
          <span className="text-slate-600">|</span>
          <span>{graphData.total_edges} Edges</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search function, variable, attribute, or endpoint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Entity Types</option>
            <option value="function">Function</option>
            <option value="class">Class</option>
            <option value="variable">Variable</option>
            <option value="attribute">Attribute</option>
            <option value="endpoint">REST Endpoint</option>
            <option value="module">Module</option>
          </select>
        </div>
      </div>

      {/* Main Split Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entity List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-h-[600px] overflow-y-auto space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Matching Entities ({filteredNodes.length})
          </div>
          {filteredNodes.slice(0, 80).map((node) => (
            <div
              key={node.id}
              onClick={() => setSelectedEntity(node)}
              className={`p-3 rounded-lg border cursor-pointer transition ${
                selectedEntity && selectedEntity.id === node.id
                  ? 'bg-indigo-950/60 border-indigo-500 text-white'
                  : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm font-mono truncate">{node.name}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                  node.type === 'function' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                  node.type === 'class' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                  node.type === 'variable' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  node.type === 'attribute' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                  node.type === 'endpoint' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}>
                  {node.type}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-mono truncate mt-1">{node.file_path}</div>
            </div>
          ))}
        </div>

        {/* Selected Entity & Graph Inspector */}
        <div className="lg:col-span-2 space-y-6">
          {selectedEntity ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white font-mono">{selectedEntity.name}</h3>
                  <span className="text-xs px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full font-mono uppercase">
                    {selectedEntity.type}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-1">{selectedEntity.id}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">File: {selectedEntity.file_path}</div>
              </div>

              {/* Signature */}
              {selectedEntity.signature && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300">
                  {selectedEntity.signature}
                </div>
              )}

              {/* Graph Edges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Incoming Edges (Dependents / Callers) */}
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-blue-400" /> Incoming Dependencies ({connections.incoming.length})
                  </h4>
                  {connections.incoming.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">No incoming dependency edges</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {connections.incoming.map((link, idx) => (
                        <div key={idx} className="text-xs font-mono bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-blue-400">{link.relation}</span> from <span className="text-slate-200">{link.source.split('.').pop()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outgoing Edges (Callees / Target Dependencies) */}
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-emerald-400" /> Outgoing Dependencies ({connections.outgoing.length})
                  </h4>
                  {connections.outgoing.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">No outgoing dependency edges</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {connections.outgoing.map((link, idx) => (
                        <div key={idx} className="text-xs font-mono bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-emerald-400">{link.relation}</span> to <span className="text-slate-200">{link.target.split('.').pop()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
              Select an entity from the list to inspect its graph connections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
