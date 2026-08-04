"""
Greenlight Package Exporter for CinemaLit Studio.
Generates an executive-ready Studio Greenlight Binder HTML file.
"""

import os
import json
import time
from cinemalit.core.models import ProjectState

class GreenlightExporter:
    @staticmethod
    def export_html(state: ProjectState, output_path: str = "greenlight_package.html") -> str:
        """
        Exports complete project state into a stand-alone, styled Greenlight Binder HTML document.
        """
        scenes_rows = ""
        for s in state.scenes:
            scenes_rows += f"""
            <tr>
              <td><strong>{s.id}</strong></td>
              <td>{s.header}</td>
              <td><span class="badge">{s.setting}</span> <span class="badge">{s.time_of_day}</span></td>
              <td>{s.page_count}</td>
              <td>{', '.join(s.characters)}</td>
            </tr>
            """

        risks_rows = ""
        for r in state.risks:
            risks_rows += f"""
            <tr>
              <td><span class="badge risk-{r.severity.lower()}">{r.severity}</span></td>
              <td><strong>{r.title}</strong></td>
              <td>{r.description}</td>
              <td><em>{r.mitigation}</em></td>
            </tr>
            """

        b = state.budget
        savings_rows = ""
        for p in b.savings_proposals:
            savings_rows += f"<li>[{p['department']}] {p['action']} — <strong>Save ${p['estimated_savings']:.2f}</strong></li>"

        schedule_rows = ""
        for day in state.schedule.days:
            schedule_rows += f"""
            <div class="day-card">
              <h4>{day.title} ({day.total_pages} Pages)</h4>
              <p><strong>Scenes:</strong> {', '.join(day.scene_ids)} | <strong>Cast:</strong> {', '.join(day.cast_required)}</p>
            </div>
            """

        approvals_rows = ""
        for g in state.approvals:
            approvals_rows += f"""
            <div class="gate-card gate-{g.status.lower()}">
              <strong>[{g.status}] {g.gate_name}</strong> (ID: {g.id})<br>
              <small>{g.rationale} — Signed: {g.timestamp or 'Pending'}</small>
            </div>
            """

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Studio Greenlight Package: {state.name}</title>
  <style>
    body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background: #090c15; color: #f0f4f8; padding: 2rem; max-width: 1000px; margin: 0 auto; line-height: 1.5; }}
    h1, h2, h3 {{ color: #00f2fe; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }}
    .badge {{ padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; background: rgba(255,255,255,0.1); }}
    .risk-high, .risk-critical {{ background: rgba(255,71,87,0.2); color: #ff4757; border: 1px solid #ff4757; }}
    table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
    th, td {{ padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left; }}
    th {{ background: rgba(255,255,255,0.05); color: #00f2fe; }}
    .day-card, .gate-card {{ background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 10px; }}
    .gate-approved {{ border-left: 4px solid #2ed573; }}
    .gate-pending {{ border-left: 4px solid #ffa502; }}
    .footer {{ margin-top: 3rem; text-align: center; color: #8c9ba5; font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; }}
  </style>
</head>
<body>
  <h1>🎬 STUDIO GREENLIGHT BINDER: {state.name}</h1>
  <p><strong>Project ID:</strong> {state.project_id} | <strong>Director Intent:</strong> "{state.director_intent}"</p>
  <p><strong>Generated At:</strong> {time.strftime("%Y-%m-%d %H:%M:%S")}</p>

  <h2>💰 Executive Budget Top Sheet</h2>
  <p>Estimated Cost: <strong>${b.total_estimated:.2f}</strong> | Target Cap: <strong>${b.max_target:.2f}</strong> | Status: <span class="badge">{b.status}</span></p>
  <h3>Savings Proposals</h3>
  <ul>{savings_rows or '<li>No savings proposals needed.</li>'}</ul>

  <h2>⚠️ Production Risk Radar</h2>
  <table>
    <thead>
      <tr><th>Severity</th><th>Risk Title</th><th>Description</th><th>Mitigation</th></tr>
    </thead>
    <tbody>{risks_rows}</tbody>
  </table>

  <h2>📖 Script Scene Breakdown</h2>
  <table>
    <thead>
      <tr><th>Scene ID</th><th>Header</th><th>Setting / Time</th><th>Pages</th><th>Cast Required</th></tr>
    </thead>
    <tbody>{scenes_rows}</tbody>
  </table>

  <h2>📅 Schedule Stripboard (2-Day Plan)</h2>
  {schedule_rows}

  <h2>🛡️ Governance Approval Gates</h2>
  {approvals_rows}

  <div class="footer">
    Verified by CinemaLit Studio & ClickHouse Studio Memory | Signed for Production
  </div>
</body>
</html>"""

        abs_out = os.path.abspath(output_path)
        with open(abs_out, "w", encoding="utf-8") as f:
            f.write(html_content)
        return abs_out
