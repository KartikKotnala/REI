import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide
} from 'd3-force';
import { ZoomIn, ZoomOut, RotateCcw, Network, Sparkles } from 'lucide-react';

const TYPE_COLORS = {
  function: { fill: '#38bdf8', stroke: '#0284c7', label: 'Function' },
  class: { fill: '#c084fc', stroke: '#9333ea', label: 'Class' },
  endpoint: { fill: '#34d399', stroke: '#059669', label: 'REST Endpoint' },
  variable: { fill: '#fbbf24', stroke: '#d97706', label: 'Variable' },
  attribute: { fill: '#f87171', stroke: '#dc2626', label: 'Attribute' },
  module: { fill: '#94a3b8', stroke: '#64748b', label: 'Module' },
  default: { fill: '#a1a1aa', stroke: '#71717a', label: 'Entity' }
};

export default function DependencyCanvas({
  nodes = [],
  links = [],
  selectedEntity = null,
  onSelectEntity = () => {},
  searchTerm = '',
  selectedType = 'ALL'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // View state: 'FULL' | 'LOCAL_1' | 'LOCAL_2'
  const [focusMode, setFocusMode] = useState('FULL');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Camera transform: pan (x, y) and zoom (k)
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const dragTargetRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Compute node degrees (number of links per node)
  const degreeMap = useMemo(() => {
    const deg = new Map();
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      deg.set(s, (deg.get(s) || 0) + 1);
      deg.set(t, (deg.get(t) || 0) + 1);
    });
    return deg;
  }, [links]);

  // Filter nodes & links based on search, type, and focusMode (Local Graph vs Full)
  const { displayNodes, displayLinks } = useMemo(() => {
    let targetIds = new Set();

    if (focusMode !== 'FULL' && selectedEntity) {
      targetIds.add(selectedEntity.id);
      // 1-hop neighbors
      const hop1 = new Set();
      links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s === selectedEntity.id) hop1.add(t);
        if (t === selectedEntity.id) hop1.add(s);
      });
      hop1.forEach(id => targetIds.add(id));

      // 2-hop neighbors if requested
      if (focusMode === 'LOCAL_2') {
        const hop2 = new Set();
        links.forEach(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          if (hop1.has(s)) hop2.add(t);
          if (hop1.has(t)) hop2.add(s);
        });
        hop2.forEach(id => targetIds.add(id));
      }
    } else {
      // Full graph filtered by search & type
      nodes.forEach(n => {
        const matchSearch = !searchTerm ||
          n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = selectedType === 'ALL' || n.type === selectedType;
        if (matchSearch && matchType) {
          targetIds.add(n.id);
        }
      });
    }

    const filteredNodes = nodes
      .filter(n => targetIds.has(n.id))
      .map(n => {
        const deg = degreeMap.get(n.id) || 1;
        const radius = Math.max(5, Math.min(18, 5 + Math.sqrt(deg) * 2));
        return { ...n, radius };
      });

    const activeNodeIdSet = new Set(filteredNodes.map(n => n.id));

    const filteredLinks = links
      .filter(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return activeNodeIdSet.has(s) && activeNodeIdSet.has(t);
      })
      .map(l => ({
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
        relation: l.relation || 'DEPENDS_ON'
      }));

    return { displayNodes: filteredNodes, displayLinks: filteredLinks };
  }, [nodes, links, selectedEntity, focusMode, searchTerm, selectedType, degreeMap]);

  // Keep simulation and active nodes in refs to drive requestAnimationFrame
  const simulationRef = useRef(null);
  const simNodesRef = useRef([]);
  const simLinksRef = useRef([]);

  // Setup / restart d3-force simulation
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 550;

    // Preserve existing positions if available so nodes do not violently reset
    const existingPos = new Map(simNodesRef.current.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));

    const simNodes = displayNodes.map(n => {
      const prev = existingPos.get(n.id);
      return {
        ...n,
        x: prev ? prev.x : width / 2 + (Math.random() - 0.5) * 200,
        y: prev ? prev.y : height / 2 + (Math.random() - 0.5) * 200,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0
      };
    });

    const simLinks = displayLinks.map(l => ({ ...l }));

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks)
          .id(d => d.id)
          .distance(focusMode === 'FULL' ? 55 : 85)
          .strength(0.35)
      )
      .force('charge', forceManyBody().strength(focusMode === 'FULL' ? -90 : -180).distanceMax(500))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide().radius(d => d.radius + 6).iterations(2))
      .alpha(0.6)
      .alphaDecay(0.028);

    simulationRef.current = sim;
    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    return () => {
      sim.stop();
    };
  }, [displayNodes, displayLinks, focusMode]);

  // Canvas render loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;

      // Dark slate Obsidian canvas background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle background grid dots
      ctx.save();
      const dotSpacing = 30 * transformRef.current.k;
      if (dotSpacing > 12) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        const offsetX = (transformRef.current.x % dotSpacing + dotSpacing) % dotSpacing;
        const offsetY = (transformRef.current.y % dotSpacing + dotSpacing) % dotSpacing;
        for (let x = offsetX; x < width; x += dotSpacing) {
          for (let y = offsetY; y < height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();

      // Apply Pan & Zoom Transform
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      const currentHover = hoveredNode;
      const currentSelected = selectedEntity;
      const activeHighlightId = currentHover?.id || currentSelected?.id || null;

      // Identify direct neighbors of active highlighted node
      const neighborIds = new Set();
      if (activeHighlightId) {
        neighborIds.add(activeHighlightId);
        simLinksRef.current.forEach(l => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          if (sid === activeHighlightId) neighborIds.add(tid);
          if (tid === activeHighlightId) neighborIds.add(sid);
        });
      }

      // Draw Links
      simLinksRef.current.forEach(l => {
        const s = l.source;
        const t = l.target;
        if (!s || !t || s.x === undefined || t.x === undefined) return;

        const isConnected =
          activeHighlightId &&
          (s.id === activeHighlightId || t.id === activeHighlightId);
        const isDimmed = activeHighlightId && !isConnected;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isConnected) {
          ctx.strokeStyle = s.id === activeHighlightId ? '#38bdf8' : '#34d399';
          ctx.lineWidth = 2.2 / transformRef.current.k;
          ctx.globalAlpha = 0.95;
        } else if (isDimmed) {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 0.8 / transformRef.current.k;
          ctx.globalAlpha = 0.12;
        } else {
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.0 / transformRef.current.k;
          ctx.globalAlpha = 0.35;
        }

        ctx.stroke();

        // Directional arrow head on connected links
        if (isConnected) {
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist > (t.radius || 8) + 12) {
            const arrowPos = 0.65;
            const ax = s.x + dx * arrowPos;
            const ay = s.y + dy * arrowPos;
            const angle = Math.atan2(dy, dx);
            const arrowSize = 6 / transformRef.current.k;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-arrowSize, -arrowSize * 0.5);
            ctx.lineTo(-arrowSize, arrowSize * 0.5);
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
            ctx.restore();
          }
        }
      });

      ctx.globalAlpha = 1.0;

      // Draw Nodes
      simNodesRef.current.forEach(n => {
        if (n.x === undefined || n.y === undefined) return;

        const isHovered = currentHover && currentHover.id === n.id;
        const isSelected = currentSelected && currentSelected.id === n.id;
        const isNeighbor = neighborIds.has(n.id);
        const isDimmed = activeHighlightId && !isNeighbor;

        const colorCfg = TYPE_COLORS[n.type] || TYPE_COLORS.default;
        const r = n.radius || 6;

        ctx.save();
        if (isDimmed) {
          ctx.globalAlpha = 0.18;
        }

        // Outer glow on hover or select
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 7, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.35)' : 'rgba(56, 189, 248, 0.35)';
          ctx.fill();
        }

        // Main node body
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = colorCfg.fill;
        ctx.fill();
        ctx.lineWidth = (isSelected ? 2.5 : 1.5) / transformRef.current.k;
        ctx.strokeStyle = isSelected ? '#ffffff' : colorCfg.stroke;
        ctx.stroke();

        // Node labels
        const shouldShowLabel =
          isHovered ||
          isSelected ||
          (isNeighbor && transformRef.current.k > 0.7) ||
          r > 9 ||
          transformRef.current.k > 1.35;

        if (shouldShowLabel && !isDimmed) {
          const fontSize = Math.max(9, Math.min(13, 11 / transformRef.current.k));
          ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const textY = n.y + r + 3;
          const text = n.name || n.id.split('.').pop();

          // Subtle text shadow backing for readability
          ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
          const textWidth = ctx.measureText(text).width;
          ctx.fillRect(n.x - textWidth / 2 - 2, textY - 1, textWidth + 4, fontSize + 2);

          ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#38bdf8' : '#e2e8f0';
          ctx.fillText(text, n.x, textY);
        }

        ctx.restore();
      });

      ctx.restore(); // Restore pan & zoom
      ctx.restore(); // Restore dpr scale

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [hoveredNode, selectedEntity]);

  // Convert canvas mouse coordinates to world coordinates
  const screenToWorld = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    return {
      x: (mx - transformRef.current.x) / transformRef.current.k,
      y: (my - transformRef.current.y) / transformRef.current.k,
      screenX: mx,
      screenY: my
    };
  }, []);

  // Find node under cursor
  const findNodeAt = useCallback(
    (worldX, worldY) => {
      for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
        const n = simNodesRef.current[i];
        if (n.x === undefined) continue;
        const dist = Math.hypot(n.x - worldX, n.y - worldY);
        if (dist <= (n.radius || 6) + 5 / transformRef.current.k) {
          return n;
        }
      }
      return null;
    },
    []
  );

  // Mouse event handlers
  const handleMouseDown = (e) => {
    const { x, y, screenX, screenY } = screenToWorld(e.clientX, e.clientY);
    const hitNode = findNodeAt(x, y);

    if (hitNode) {
      isDraggingRef.current = true;
      dragTargetRef.current = hitNode;
      hitNode.fx = hitNode.x;
      hitNode.fy = hitNode.y;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
    } else {
      isPanningRef.current = true;
      panStartRef.current = {
        x: screenX - transformRef.current.x,
        y: screenY - transformRef.current.y
      };
    }
  };

  const handleMouseMove = (e) => {
    const { x, y, screenX, screenY } = screenToWorld(e.clientX, e.clientY);
    mousePosRef.current = { x: screenX, y: screenY };

    if (isDraggingRef.current && dragTargetRef.current) {
      dragTargetRef.current.fx = x;
      dragTargetRef.current.fy = y;
    } else if (isPanningRef.current) {
      transformRef.current.x = screenX - panStartRef.current.x;
      transformRef.current.y = screenY - panStartRef.current.y;
    } else {
      const hit = findNodeAt(x, y);
      if (hit !== hoveredNode) {
        setHoveredNode(hit);
        if (hit) {
          setTooltipPos({ x: screenX, y: screenY });
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && dragTargetRef.current) {
      dragTargetRef.current.fx = null;
      dragTargetRef.current.fy = null;
      dragTargetRef.current = null;
      isDraggingRef.current = false;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
    }
    isPanningRef.current = false;
  };

  const handleClick = (e) => {
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const hit = findNodeAt(x, y);
    if (hit) {
      onSelectEntity(hit);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const currentK = transformRef.current.k;
    const newK = Math.max(0.12, Math.min(4.5, currentK * zoomFactor));

    transformRef.current.x = mx - (mx - transformRef.current.x) * (newK / currentK);
    transformRef.current.y = my - (my - transformRef.current.y) * (newK / currentK);
    transformRef.current.k = newK;
  };

  // Zoom control buttons
  const handleZoom = (factor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const currentK = transformRef.current.k;
    const newK = Math.max(0.12, Math.min(4.5, currentK * factor));

    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / currentK);
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / currentK);
    transformRef.current.k = newK;
  };

  const handleReset = () => {
    transformRef.current = { x: 0, y: 0, k: 1 };
    if (simulationRef.current) {
      simulationRef.current.alpha(0.4).restart();
    }
  };

  return (
    <div className="relative w-full h-[600px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden select-none" ref={containerRef}>
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Obsidian-style Local Focus Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 px-2 py-1.5 rounded-lg shadow-lg pointer-events-auto">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Network className="w-3.5 h-3.5 text-indigo-400" /> Mode:
          </span>
          <button
            onClick={() => setFocusMode('FULL')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition ${
              focusMode === 'FULL'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Nodes ({displayNodes.length})
          </button>
          <button
            onClick={() => setFocusMode('LOCAL_1')}
            disabled={!selectedEntity}
            className={`px-2.5 py-1 text-xs font-medium rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
              focusMode === 'LOCAL_1'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Local (1-Hop)
          </button>
          <button
            onClick={() => setFocusMode('LOCAL_2')}
            disabled={!selectedEntity}
            className={`px-2.5 py-1 text-xs font-medium rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
              focusMode === 'LOCAL_2'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Local (2-Hop)
          </button>
        </div>

        {/* Right: Camera Zoom Tools */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg shadow-lg pointer-events-auto">
          <button
            onClick={() => handleZoom(1.25)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Hover Tooltip (Obsidian-Style) */}
      {hoveredNode && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3 py-2 rounded-lg shadow-2xl text-xs max-w-xs transition-opacity duration-150"
          style={{
            left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth || 600) - 240),
            top: Math.min(tooltipPos.y + 14, (containerRef.current?.clientHeight || 500) - 100)
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-white font-mono truncate">{hoveredNode.name}</span>
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border"
              style={{
                color: (TYPE_COLORS[hoveredNode.type] || TYPE_COLORS.default).fill,
                borderColor: (TYPE_COLORS[hoveredNode.type] || TYPE_COLORS.default).stroke,
                backgroundColor: 'rgba(15, 23, 42, 0.6)'
              }}
            >
              {hoveredNode.type}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate">{hoveredNode.file_path}</div>
          <div className="text-[10px] text-indigo-400 font-mono mt-1">
            Connected Edges: {degreeMap.get(hoveredNode.id) || 0}
          </div>
        </div>
      )}

      {/* Bottom Floating Legend & Hint */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg shadow-lg pointer-events-auto text-[11px] font-mono">
          {Object.entries(TYPE_COLORS)
            .filter(([k]) => k !== 'default')
            .map(([typeKey, cfg]) => (
              <div key={typeKey} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.fill }}></span>
                <span className="text-slate-300 capitalize">{cfg.label}</span>
              </div>
            ))}
        </div>

        {/* Interaction Hint */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 backdrop-blur border border-slate-800 px-2.5 py-1 rounded text-[11px] font-mono text-slate-400 pointer-events-auto">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Click node to inspect • Scroll to zoom • Drag to pan/rearrange</span>
        </div>
      </div>
    </div>
  );
}
