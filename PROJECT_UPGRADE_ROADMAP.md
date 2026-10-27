# REI: Repository Evolution Intelligence
## Project Updates & Team Work Breakdown

---

## 1. Summary of What We Have Done

We have upgraded the REI platform from a static two-repository demonstration into a dynamic, polyglot software change-impact analysis engine. The major upgrades include:

1. **Direct GitHub Repository Link Ingestion**:
   - Users can now paste any public GitHub repository URL (e.g. `psf/requests`, `tiangolo/fastapi`, `facebookarchive/php-graph-sdk`) directly into the frontend.
   - The system validates the URL, performs a shallow clone (`--depth 1`), caches the repository locally in `~/.cache/rei/repos`, parses it using multi-language Tree-sitter parsers (Python, JavaScript, TypeScript, PHP, etc.), and reactively refreshes all analysis views.
   - Repositories are indexed once and reused across all tabs without repeated cloning.

2. **Structured & Interactive Dependency Graph**:
   - **Canvas Fix**: Eliminated the canvas bug where high-DPI scaling magnified coordinates exponentially, fixing the blank screen and enabling smooth 60 FPS rendering.
   - **Top Architectural Hubs Overview**: The default view automatically renders the top 20 architectural hubs using radial constellation physics so nodes cluster cleanly instead of repelling off-screen.
   - **3 Layout Engines**: Users can toggle between **Force-Directed physics**, **Hierarchical top-down DAG**, and **Concentric radial horizon rings**.
   - **Transitive Impact Path Tracer**: Pinned a floating HUD at the top center of the canvas (`Path: Source → Target [Trace Path]`). Fixed mouse-glide tooltip vanishing, added active amber checkmarks (`✓ Source` / `✓ Target`), quick selection buttons (`[Src]`, `[Tgt]`) on connected entities, and animated golden particle flow along the shortest impact route.

3. **Dynamic Evaluation & Automated Model Selection**:
   - **Real Git Ground Truth**: Scenarios are dynamically generated from real historical commits and diff headers rather than hardcoded synthetic examples.
   - **Multi-Metric Evaluation**: Evaluates models on Precision, Recall, F1, Mean Reciprocal Rank (MRR), NDCG@5, Hallucination Rate, and Latency Efficiency.
   - **Automated Model Selection**: Uses a multi-criteria utility function across 3 profiles (Balanced, Safety-Critical, CI/CD) to automatically evaluate, rank, and select the optimal local LLM (e.g. Qwen 2.5 Coder, StarCoder2, CodeLlama) for the loaded project.

---


## 4. End-to-End Verification Walkthrough


1. **Test Repository Intake**:
   - Go to `http://localhost:3000/`.
   - In the top bar, enter `https://github.com/facebookarchive/php-graph-sdk` or click the `FastAPI` preset.
   - Notice the loading spinner, shallow clone caching, and automatic data refresh across all tabs.

2. **Test Graph & Path Tracer**:
   - Click on the **Dependency Graph** tab.
   - Observe the Top 20 Architectural Hubs rendered smoothly at 60 FPS in a radial constellation layout.
   - Switch between **Force**, **Hierarchical**, and **Concentric** layouts.
   - Click any entity, click **Set as Path Source**, then click **Tgt** on an outgoing dependency.
   - Observe the top-center floating HUD update and click **Trace Path Now** to see the animated golden particle flow.

3. **Test Dynamic Evaluation & Model Selection**:
   - Click on the **Evaluation & Benchmarking** tab.
   - Select a criteria profile (e.g. `Balanced Production` or `Safety-Critical`).
   - Click **Run Model Benchmark & Auto-Select**.
   - Observe real Git commit scenarios evaluated, the scorecard table generated, and the best model automatically selected and applied.
