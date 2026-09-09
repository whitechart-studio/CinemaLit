# Devpost submission form — field-by-field answers

Everything the *Agentic Cinema: The Blockbuster Hackathon* form asks for, ready to paste.
The long project description lives in [`SUBMISSION.md`](SUBMISSION.md) — paste that whole file into the **Project Description** editor (Devpost renders Markdown + LaTeX).

**Deadline:** September 9, 2026 · 2:00 PM PDT.

---

## 1. Project name

```
CinemaLit Studio
```

## 2. Tagline / elevator pitch (≈200 chars)

```
Upload a screenplay, get a complete costed pre-production package — breakdown, budget, stripboard, shot list and storyboards — built end to end by a Gemini + ADK Director Agent living in ClickHouse.
```

**Alternates**, if you want a different angle:

- `An autonomous Director Agent that turns a raw screenplay into a queryable film production database in minutes, not a week.`
- `Pre-production is a week of clerical work derivable from the script. CinemaLit's Gemini agent derives it — into ClickHouse, in minutes.`

## 3. Partner track

```
ClickHouse Track
```

> Pick this one. ClickHouse is the single system of record — not a logging sink bolted on. Every agent write, the job/progress bus, the audit trail and the in-app SQL console all run on ClickHouse Cloud, and the submission documents concrete engine-level learnings (`ReplacingMergeTree` upsert-by-insert, `FINAL` on the read path, mutation/insert ordering, one `transform()` mutation instead of N).

## 4. Links

| Field | Value |
| --- | --- |
| **Public code repository** | `https://github.com/whitechart-studio/CinemaLit` |
| **Hosted project URL** | `<FILL IN — the deployed Cloud Run URL>` |
| **Demo video (3 min, public)** | `<FILL IN — YouTube / Vimeo, set to Public, not Unlisted>` |
| **License** | MIT, `LICENSE` at repo root ✅ |

> ⚠️ **Three things to confirm before you submit:**
> 1. The repo is **public** (it is currently pushed to `whitechart-studio/CinemaLit` — verify visibility).
> 2. The hosted URL loads for a logged-out stranger and lets them register.
> 3. The video is **Public**, in English or subtitled, and **under 3:00**.

## 5. Built with (Devpost tag list)

```
google-adk, gemini, google-genai, google-cloud, google-identity-services,
clickhouse, clickhouse-cloud, mcp, python, react, typescript, vite, zustand,
pydantic, pyjwt, docker, cloud-run, fountain, github-actions
```

## 6. Project description

Paste [`SUBMISSION.md`](SUBMISSION.md) verbatim. It is already written against Devpost's Markdown + LaTeX support:

- headings, tables, fenced code blocks, task-free bullets — all basic/extended Markdown Devpost documents;
- inline math with `\\(...\\)` and display math with `$$...$$`, exactly as their LaTeX guide specifies;
- no custom macros, no LaTeX environments, no unsupported packages.

---

## 7. Judging-criteria crosswalk

Use this as the spine of both the video and any live Q&A. Each row is a claim you can point at a file for.

### Technological Implementation
> *"How well is the project built, and how effectively does it use Google Cloud and the Partner services?"*

| Claim | Where it lives |
| --- | --- |
| Real ADK agent, 27 tools, flat root agent | `cinemalit_agent/agent.py`, `tools.py`, `crew_tools.py`, `pipeline.py` |
| Two zero-tool, `output_schema`-constrained Gemini sub-agents with `include_contents="none"` | `cinemalit_agent/pipeline.py` (`breakdown_agent`, `storyboard_agent`) |
| Agent owns every write — the app asks the agent in English to ingest a project | `web/server.py:_handle_create_project` → `_spawn_agent_job` |
| ClickHouse Cloud is the only store: 12 tables, `ReplacingMergeTree` + `FINAL` | `scripts/migrate_v2.py`, `web/db.py` |
| Deterministic `crc32` ids ⇒ re-ingest is an idempotent upsert, no per-row mutations | `cinemalit_agent/pipeline.py:_id`, `_save_breakdown` |
| Insert-then-sweep ordering (a `DELETE` mutation swallows concurrent inserts) | `cinemalit_agent/pipeline.py:_sweep_stale_rows` |
| One `transform()` mutation for whole-project day assignment, not N | `cinemalit_agent/pipeline.py:_assign_shoot_days` |
| ClickHouse Cloud **remote MCP** over Streamable HTTP, `tool_filter`ed to 3 read tools | `cinemalit_agent/mcp_tools.py` |
| Gemini multimodal — image/PDF attachments straight into the director chat | `cinemalit_agent/bridge.py:ask_agent`, `web/server.py:_handle_ai_chat` |
| Google Identity OAuth + JWT | `web/auth.py`, `web/server.py:_handle_google` |
| Cloud Run–ready multi-stage container honouring `$PORT` | `Dockerfile`, `web/server.py:48` |
| CI runs the director workflow against a live ClickHouse service container | `.github/workflows/ci.yml` |

### Design
> *"Does the project deliver a complete, coherent product experience, not just a technical proof of concept?"*

- Nine industry-shaped views (Scene Canvas, Screenplay, Storyboard, Breakdown, Stripboard, Shot List, Budget, Call Sheet, SQL Console) — all live ClickHouse reads, not mocks.
- A designed system, not default components: one accent hue, hierarchy from type and spacing, and the *standard* stripboard colour convention (INT/EXT × DAY/NIGHT) preserved because it carries real meaning to a 1st AD.
- Long-running work is honest: a `jobs`-table progress bus, `partial` status with exact AI-vs-fallback counts, and `is_placeholder` flags so a fallback image is never dressed up as a generated one.
- Full account lifecycle — register, Google sign-in, profile, project delete, account delete.

### Potential Impact
> *"Does the project make a credible, specific case for solving a real problem for a real audience?"*

- Named audience: indie writer-directors, line producers and 1st ADs at the micro-to-low-budget tier (short films, pilots, commercials, indie features).
- Named task: the pre-production breakdown week — a real, unpaid, universally-hated block of clerical work.
- Credible mechanism: the work is *derivable from the script*, and existing tools (Movie Magic, StudioBinder) are data-entry grids that make the human do the derivation.
- Named unlock: storyboards, which micro-budget productions skip entirely because a storyboard artist is unaffordable.

### Quality of Idea
> *"Is this a creative, non-obvious use of Google Cloud and the Partner services?"*

- The non-obvious move: **an OLAP database as an agent's memory.** Persistence, multi-tenancy, auditability and queryability stop being prompt-engineering problems and become schema problems with known answers.
- The consequence: a film tool that ships a **SQL console**. "Every night exterior with a stunt over $2,000" is a query, not a prompt.
- The discipline: the model is used only for genuinely interpretive work. Scene splitting is a regex, character detection is a formatting convention, day-packing is arithmetic — all free, all deterministic, all more reliable than a model call.

---

## 8. Verified facts (use these numbers, they were checked against the code)

| Fact | Value | Source |
| --- | --- | --- |
| Agent tool count | **27** (13 database + 12 crew + 2 pipeline) | `tools.py:21`, `crew_tools.py:283`, `pipeline.py:977` |
| Sub-agents | 2, both zero-tool with a Pydantic `output_schema` | `pipeline.py:155`, `pipeline.py:176` |
| ClickHouse tables | 12 | `scripts/migrate_v2.py` + on-demand `governance_gates`, `agent_audit_log`, `users`, `storyboards` |
| Deployed Gemini model | `gemini-3.1-flash-lite` | `.env`, `deploy.env.yaml` |
| Breakdown concurrency | 6 workers (`PIPELINE_WORKERS`) | `pipeline.py:67` |
| Image concurrency | 2 workers (`PIPELINE_IMAGE_WORKERS`) | `pipeline.py:783` |
| Batch budget | 9,000 chars (`PIPELINE_BATCH_CHARS`), scenes clamped at 6,000 | `pipeline.py:290` |
| ClickHouse region | ClickHouse Cloud, `ap-south-1` (AWS), TLS on 8443 | `deploy.env.yaml` |
| License | MIT | `LICENSE` |

## 9. Known mismatches to fix before the judges read the repo

These are places where the shipped docs disagree with the shipped code. Fix them or they undercut criterion 1.

| # | Mismatch | Fix |
| --- | --- | --- |
| 1 | `README.md` says the agent has **17 tools**; the code has **27** (13 + 12 + 2). | Update the README's "Agent tools" section and the architecture diagram. |
| 2 | `README.md` says storyboard images come from a "Gemini image model"; `pipeline.py` calls **pollinations.ai `flux`** and explains why (Gemini image models need a billing-enabled project). | Update the README to match the code and keep the explanation — the honest version is stronger than the wrong one. |
| 3 | `agent.py`'s docstring says the pipeline sub-agents avoid re-sending "17 tool declarations"; `pipeline.py`'s says "20". Both are stale — it's 27. | One-word fix in both docstrings. |
| 4 | Default model constants disagree: `agent.py` falls back to `gemini-2.0-flash`, `pipeline.py` to `gemini-3.1-flash-lite`. The `.env` sets `gemini-3.1-flash-lite`, so this only bites someone running without a `.env`. | Align both fallbacks to `gemini-3.1-flash-lite`. |
| 5 | `.github/workflows/ci.yml` seeds `scripts/setup_clickhouse_schema.sql`, while the live schema is `scripts/migrate_v2.py`. Both files exist, so CI passes — but they can drift apart silently. | Either point CI at `migrate_v2.py` or note in the SQL file that it mirrors it. |
| 6 | `README.md` quickstart uses `.venv/Scripts/python.exe` (Windows-only) in the main path. | Show the POSIX path first — most judges are on macOS or Linux. |

## 10. Pre-submission checklist

- [ ] Repo public, MIT `LICENSE` present at root
- [ ] No secrets committed — `.env` is gitignored; confirm `git log -p` never contained `GOOGLE_API_KEY` or the ClickHouse password
- [ ] Fix the six mismatches in §9 (at minimum #1 and #2 — a judge who counts tools will find them)
- [ ] Hosted URL deployed and reachable logged-out, with registration working
- [ ] A demo account seeded with one fully-ingested project, so the hosted URL is not an empty state
- [ ] Demo video: public, ≤ 3:00, English or subtitled
- [ ] `SUBMISSION.md` pasted into the Devpost description, LaTeX rendering verified in the preview
- [ ] Partner track set to **ClickHouse**
- [ ] "Built with" tags include `google-adk`, `gemini`, `google-cloud` **and** `clickhouse` — the form is what the track filters on
