"""
State Manager for CinemaLit Studio.
Handles workspace initialization (.cinemalit directory), persistence, audit logs, and approval actions.
"""

import os
import json
import time
import uuid
from pathlib import Path
from typing import Optional, Dict, Any
from cinemalit.core.models import ProjectState, AuditLogEntry, ApprovalGate

STATE_DIR_NAME = ".cinemalit"
STATE_FILE_NAME = "state.json"
AUDIT_LOG_FILE = "audit.log"

class StateManager:
    def __init__(self, root_dir: Optional[str] = None):
        self.root_dir = Path(root_dir or os.getcwd()).resolve()
        self.state_dir = self.root_dir / STATE_DIR_NAME
        self.state_file = self.state_dir / STATE_FILE_NAME
        self.audit_file = self.state_dir / AUDIT_LOG_FILE

    def is_initialized(self) -> bool:
        return self.state_file.exists()

    def init_project(self, name: str, project_id: Optional[str] = None) -> ProjectState:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        p_id = project_id or f"proj-{uuid.uuid4().hex[:8]}"
        state = ProjectState(
            project_id=p_id,
            name=name,
            created_at=time.strftime("%Y-%m-%d %H:%M:%S")
        )
        self.save_state(state)
        self.log_audit("DIRECTOR", "INIT_PROJECT", {"project_name": name, "project_id": p_id})
        return state

    def load_state(self) -> ProjectState:
        if not self.is_initialized():
            raise FileNotFoundError(
                f"No CinemaLit project found in {self.root_dir}. Run 'cinemalit init <name>' first."
            )
        with open(self.state_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectState.from_dict(data)

    def save_state(self, state: ProjectState) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(state.to_dict(), f, indent=2)

    def log_audit(self, actor: str, action: str, details: Dict[str, Any]) -> AuditLogEntry:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        entry_id = f"audit-{uuid.uuid4().hex[:6]}"
        entry = AuditLogEntry(
            id=entry_id,
            timestamp=timestamp,
            actor=actor,
            action=action,
            details=details
        )
        
        # Append to state if loaded
        if self.is_initialized():
            try:
                state = self.load_state()
                state.audit_logs.append(entry)
                self.save_state(state)
            except Exception:
                pass

        # Write to log text file
        self.state_dir.mkdir(parents=True, exist_ok=True)
        with open(self.audit_file, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] [{actor}] [{action}] {json.dumps(details)}\n")

        return entry

    def approve_action(self, action_id: str, rationale: str = "Approved by Director") -> Optional[ApprovalGate]:
        state = self.load_state()
        target_gate = None
        for gate in state.approvals:
            if gate.id.lower() == action_id.lower() or gate.gate_name.lower() == action_id.lower():
                gate.status = "APPROVED"
                gate.rationale = rationale
                gate.timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                target_gate = gate
                break
        
        if target_gate:
            self.save_state(state)
            self.log_audit("DIRECTOR", "APPROVE_ACTION", {"action_id": action_id, "rationale": rationale})
        return target_gate
