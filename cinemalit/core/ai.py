"""
Google AI (Gemini) Client & Reasoning Engine for CinemaLit Studio.
Handles API key resolution, .env configuration, real Gemini API calls,
and seamless heuristic fallback when unconfigured.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List

class GeminiClient:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY", "").strip()
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip()

    def is_available(self) -> bool:
        """Returns True if a valid Google AI API key is configured."""
        return bool(self.api_key and self.api_key != "your_google_ai_api_key_here")

    def generate_text(self, prompt: str, system_instruction: Optional[str] = None) -> Optional[str]:
        """
        Sends a prompt to the Google AI (Gemini) API.
        Uses native HTTP request to guarantee compatibility without requiring external C libraries.
        """
        if not self.is_available():
            return None

        # Build endpoint URL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        contents = []
        if system_instruction:
            contents.append({"role": "user", "parts": [{"text": f"System Context: {system_instruction}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will operate according to these instructions."}]})
        
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2048,
            }
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=15) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                candidates = resp_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
        except Exception as e:
            print(f"[GeminiClient Warning] API call failed ({e}). Falling back to heuristic engine.", flush=True)
            return None
        
        return None

    def analyze_script(self, script_text: str) -> Optional[Dict[str, Any]]:
        """Uses Gemini to perform deep screenplay breakdown and analysis."""
        if not self.is_available():
            return None

        prompt = (
            "Analyze the following film screenplay content. Return a JSON object with: "
            "'scene_count', 'characters' (list of names), 'locations' (list of locations), "
            "'themes' (list of main themes), and 'director_notes' (brief 2-sentence summary of tone and directorial style).\n\n"
            f"SCREENPLAY:\n{script_text[:4000]}"
        )
        response = self.generate_text(prompt, system_instruction="You are an expert Hollywood script supervisor and director's assistant.")
        if response:
            try:
                # Strip markdown code fencing if present
                clean_resp = response.strip()
                if clean_resp.startswith("```json"):
                    clean_resp = clean_resp[7:]
                if clean_resp.startswith("```"):
                    clean_resp = clean_resp[3:]
                if clean_resp.endswith("```"):
                    clean_resp = clean_resp[:-3]
                return json.loads(clean_resp.strip())
            except Exception:
                return {"ai_analysis": response}
        return None

    def find_risks(self, script_summary: str) -> Optional[List[Dict[str, Any]]]:
        """Uses Gemini to identify production risks, stunts, permit requirements, and logistical traps."""
        if not self.is_available():
            return None

        prompt = (
            "Given the following script summary, identify 3-5 critical production risks. "
            "Return a JSON array of objects, each containing: "
            "'category' (e.g. PERMITS, STUNTS, WEATHER, GEAR), 'description', 'severity' (LOW, MEDIUM, HIGH, CRITICAL), and 'mitigation'.\n\n"
            f"SCRIPT SUMMARY:\n{script_summary}"
        )
        response = self.generate_text(prompt, system_instruction="You are a veteran Line Producer and First Assistant Director.")
        if response:
            try:
                clean_resp = response.strip()
                if clean_resp.startswith("```json"):
                    clean_resp = clean_resp[7:]
                if clean_resp.startswith("```"):
                    clean_resp = clean_resp[3:]
                if clean_resp.endswith("```"):
                    clean_resp = clean_resp[:-3]
                parsed = json.loads(clean_resp.strip())
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        return None
