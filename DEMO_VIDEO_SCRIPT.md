# 3-minute demo video — shot list, script and timings

**Hard limit: 3:00.** Public on YouTube or Vimeo, English or subtitled.
Record at 1920×1080, browser zoom ~110% so text is legible after compression, dark theme (the app is dark by default).

**Structure:** problem (0:20) → the one magic moment (1:00) → the product (0:45) → the engineering the judges are scoring (0:45) → close (0:10).
Do not open with a logo animation. Open on the problem.

---

## 0:00 – 0:20 · The problem

**Screen:** a real breakdown spreadsheet or a StudioBinder-style empty grid. Then cut to a stack of script pages.

> "Before a single frame of a low-budget film gets shot, someone spends a week building this by hand. Every scene: who's in it, what props, what stunts, what it costs, which day it shoots. Every bit of it is already in the script — and every existing tool just hands you an empty grid and makes you type it in."

**On screen (text overlay):** `Pre-production = 1 week of clerical work. All of it derivable from the script.`

---

## 0:20 – 1:20 · The magic moment (do not rush this)

**Screen:** CinemaLit Studio, logged in, empty project list. Click **New Project**. Drop in the screenplay. Set budget cap and shoot days. Click create.

> "CinemaLit inverts it. I upload the screenplay, set a cap and a target day count — and that's the last thing I type."

**Screen:** the job banner starts moving. Cut to a **second window showing the agent's live tool-call log** (`ADK_AGENT_VERBOSE=true`). This is the single most persuasive shot in the video — the judges want to see an agent actually acting.

> "The app doesn't call an ingest function. It asks the Director Agent, in English, to ingest the project. The agent decides to call `ingest_project_script`, splits the script, and fans every scene out to a schema-constrained Gemini sub-agent for the breakdown."

**Screen:** progress climbing — `18/42 scenes broken down by AI`. Then the canvas populating.

> "Scene by scene: synopsis, INT/EXT, time of day, page count, risk, cast with day rates, every prop, VFX, SFX and stunt with a cost and a vendor, and a shot list with lenses. Straight into ClickHouse."

**On screen:** `upload → populated production database, in minutes`

---

## 1:20 – 2:05 · The product

Move fast — roughly 6–8 seconds per view, no lingering.

| Time | View | Line |
| --- | --- | --- |
| 1:20 | **Scene Canvas** | "Every scene as a node — pages, risk, cast, shoot day." |
| 1:28 | **Breakdown** | "The classic breakdown sheet, colour-coded by the standard stripboard convention." |
| 1:35 | **Budget** | "The topsheet — and these lines are *derived* from the breakdown elements, so they can never drift apart from the sheet they came from." |
| 1:43 | **Stripboard** | "Scenes packed into shoot days, grouped by location and time of day so the unit shoots a location out before moving." |
| 1:50 | **Storyboard** | "And storyboards — which micro-budget productions skip entirely, because a storyboard artist is unaffordable. Gemini plans the frames, timing and camera." |

**1:57 — the chat, and this is the beat that proves it's an agent and not a report generator:**

Type into the director chat:

```
Scene 14 needs a squib hit and a breakaway bottle — budget them realistically.
```

> "It doesn't describe what should happen. It calls the write tool. That's a real edit to the live production database."

Cut to the Breakdown view refreshing with the new elements.

---

## 2:05 – 2:50 · The engineering (the ClickHouse track beat)

**Screen:** the in-app **SQL Console**. Run something a producer would actually ask:

```sql
SELECT s.scene_number, s.location, e.name, e.cost_usd
FROM cinemalit.elements AS e FINAL
JOIN cinemalit.scenes AS s FINAL ON e.scene_id = s.scene_id
WHERE e.project_id = '<project>' AND s.time_of_day = 'NIGHT'
  AND s.int_ext = 'EXT' AND e.cost_usd > 2000
ORDER BY e.cost_usd DESC
```

> "Everything the agent produced is rows in ClickHouse Cloud — not model context, not a JSON blob. So a film tool ships a SQL console. 'Every night exterior with a stunt over two thousand dollars' is a query, not a prompt."

**Screen:** cut to the architecture diagram (grab it from `SUBMISSION.md`).

> "ClickHouse isn't a logging sink here — it's the agent's memory and the only system of record. Twelve tables, all ReplacingMergeTree, read with FINAL. Every id is a deterministic hash of its natural key, so re-ingesting an edited script is an idempotent upsert instead of ninety mutations. The whole schedule lands as one `transform()` mutation, not one per scene."

**And the hard-won one — say it, it lands:**

> "And we learned the expensive way that a ClickHouse DELETE is an async mutation that can swallow rows inserted while it's in flight. Cleaning up before writing lost scenes on two runs in three. Now we always insert first and sweep afterwards — and only for keys we didn't just write."

**Screen:** the `jobs` table row updating live in the console.

> "There's no queue broker and no websocket. Progress *is* a row in the database — so if you close the tab mid-ingest, nothing is lost."

---

## 2:50 – 3:00 · Close

**Screen:** the populated Scene Canvas, pull back.

> "CinemaLit Studio. Google ADK and Gemini for the reasoning, ClickHouse Cloud for the memory. A week of pre-production, in minutes — with the director still in the chair."

**Final card:** project name · hosted URL · GitHub URL · `MIT · Agentic Cinema · ClickHouse Track`

---

## Recording notes

- **Record the agent log window.** Set `ADK_AGENT_VERBOSE=true` and, if you want it clean, `ADK_AGENT_LOG_FILE=cinemalit_agent.log` with `tail -f` in a second terminal. Judges scoring "Technological Implementation" want visible tool calls.
- **Pre-warm the demo.** Have one project fully ingested *before* you record, so the view tour is instant. Only the ingest section shows real waiting — and speed that up 4–8× with a visible "sped up" label rather than cutting it, so the progress bar's honesty still reads.
- **Use a script the judges will recognise a genre in.** `scripts/sample_script.fountain` for a tight run; `scripts/batman.fountain` if you want the feature-length scene count on screen.
- **Do not show a placeholder storyboard frame.** Check `is_placeholder = 0` for the scene you demo:
  ```sql
  SELECT scene_num, frame_num, is_placeholder FROM cinemalit.storyboards FINAL
  WHERE project_id = '<project>' ORDER BY scene_num, frame_num
  ```
- **Blur or crop anything showing your ClickHouse host, API keys, or the `.env` file.** The `deploy.env.yaml` host and the Google client ID are already public; the password and `GOOGLE_API_KEY` are not.
- **Subtitles.** Auto-generate on YouTube, then fix the film jargon — "1st AD", "INT/EXT", "stripboard", "squib" and "ADK" all get mangled.
- **Cut the intro, not the SQL.** If you run over 3:00, drop the view tour to five views before you drop the ClickHouse section — that section is what the track is judged on.
