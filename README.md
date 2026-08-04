# CinemaLit Studio 🎬

> **Director-Led Agentic Production System**
> Turn raw scripts into governed, production-ready decisions through specialized CLI & MCP crew tools.

CinemaLit Studio treats the human user as the **Director**. The Director provides creative, budget, schedule, or production intent, and CinemaLit coordinates a network of specialized studio crews to analyze, challenge, plan, and execute next steps.

---

## 🌟 Core Vision & Architecture

Every production department has both a **CLI interface** for humans and an **MCP server** for Gemini agents. The underlying core logic powers both, so the Director can operate through terminal commands while Gemini can call the same tools as part of a multi-step agentic workflow.

```text
Director Intent  (e.g., "Make this shootable in 2 days under $5k")
  │
  ▼
CinemaLit Director Layer
  │
  ├─► Story Crew         (Scenes, dialogue, characters, tone, continuity)
  ├─► Production Crew    (Props, gear, locations, Risk Radar)
  ├─► Budget Crew        (Cost pressure estimates, tactical savings)
  ├─► Schedule Crew      (2-day shoot stripboard optimization)
  ├─► Ops Crew           (Actionable tasks, prep checklists, call sheets)
  ├─► Governance Crew    (Greenlight gates, approvals, audit log)
  └─► Studio Memory      (Structured project knowledge & ClickHouse query engine)
```

---

## 🚀 Quickstart Guide

### 1. Installation & Environment Setup

Clone the repository and install executable links:

```bash
git clone https://github.com/your-org/cinemalit.git
cd cinemalit
chmod +x bin/*
export PATH="$PWD/bin:$PATH"
```

### 2. Director One-Line Command Workflow

Run the end-to-end director mission:

```bash
# Initialize a new film project
cinemalit init "Neon Echoes"

# Ingest Fountain screenplay
cinemalit ingest scripts/sample_script.fountain

# Direct the studio crews
cinemalit direct "Turn this short-film script into a 2-day shoot plan under $5k"

# Check production status, risk radar, and greenlight gates
cinemalit status

# Approve governance greenlight gate
cinemalit approve gate-budget-cap
cinemalit approve gate-risk-threshold
```

---

## 🛠️ Specialized Department CLIs

Each department ships as a focused command-line utility:

```bash
cinemalit-story analyze scripts/sample_script.fountain
cinemalit-production breakdown
cinemalit-budget risks
cinemalit-schedule plan
cinemalit-ops tasks
cinemalit-governance approvals
```

---

## 🤖 MCP Server Tools (Gemini Agent Integration)

Launch the unified MCP server to connect Gemini and MCP-aware agents:

```bash
cinemalit mcp serve-all
```

Exposed MCP Tools:

| MCP Tool Name | Department | Function |
| :--- | :--- | :--- |
| `story.analyze_script` | Story | Parse scenes, character matrix, and page counts |
| `story.list_scenes` | Story | List all extracted scenes with metadata |
| `production.find_risks` | Production | Extract high-risk items (firearms, rain, night exteriors) |
| `production.breakdown` | Production | Departmental prop, cast, location & gear breakdown |
| `budget.estimate_pressure` | Budget | Estimate costs and compare against $5k target cap |
| `budget.suggest_savings` | Budget | Suggest tactical cost trade-offs and savings |
| `schedule.generate_plan` | Schedule | Build 2-day shoot stripboard plan |
| `ops.create_tasks` | Ops | Generate actionable departmental task list |
| `governance.request_approval` | Governance | Submit Director approval for greenlight gate |
| `governance.audit_log` | Governance | Retrieve full decision audit trail |
| `studio.query_memory` | Memory | Query structured project knowledge & ClickHouse metrics |

---

## 🧠 Studio Memory & ClickHouse Track Alignment (`mcp-clickhouse`)

CinemaLit Studio is submitted under the **ClickHouse Partner Track** for the *Agentic Cinema* hackathon.

At runtime, CinemaLit Studio Memory connects to **ClickHouse Cloud** or local ClickHouse clusters via the official **`mcp-clickhouse`** server protocol:

1. **SQL Schema Setup**: Initialize project tables (`scenes`, `risk_radar`, `budget_summary`, `audit_logs`):
   ```bash
   clickhouse-client --queries-file scripts/setup_clickhouse_schema.sql
   ```

2. **Environment Variables**:
   ```bash
   export CLICKHOUSE_HOST="your-clickhouse-cloud-host.clickhouse.cloud"
   export CLICKHOUSE_PORT="8123"
   export CLICKHOUSE_USER="default"
   export CLICKHOUSE_PASSWORD="your-password"
   ```

3. **Gemini Query Engine via `mcp-clickhouse`**:
   Gemini can query Studio Memory directly using natural language or ClickHouse analytical SQL queries:

   ```text
   SELECT * FROM cinemalit.scenes WHERE setting = 'EXT' AND time_of_day = 'NIGHT';
   SELECT location, count(*) FROM cinemalit.scenes GROUP BY location;
   SELECT * FROM cinemalit.risk_radar WHERE severity IN ('HIGH', 'CRITICAL');
   ```

---

## 🌐 Web Studio Dashboard

Launch the interactive dark-mode Web Studio Visualizer:

```bash
cinemalit web
```

Open [http://localhost:8000](http://localhost:8000) in your browser to experience real-time interactive risk radar, budget pressure meters, stripboard schedule cards, and approval gate controls.

---

## 🧪 Verification & Testing

Run the full end-to-end integration test suite:

```bash
python3 scripts/test_director_flow.py
```
