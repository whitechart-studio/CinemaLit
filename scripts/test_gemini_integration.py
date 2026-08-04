"""
Integration test runner for .env loading & Google AI (Gemini) API integration.
"""

import sys
import os
import shutil

# Ensure cinemalit package is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cinemalit.core.ai import GeminiClient
from cinemalit.core.state import StateManager
from cinemalit.mcp.server import CinemaLitMCPServer
from dotenv import load_dotenv

def test_gemini_env_integration():
    print("🚀 STEP 1: Verify .env loading")
    load_dotenv()
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    print(f"  ✓ Model configured: {model}")
    print(f"  ✓ GOOGLE_API_KEY detected: {'YES' if api_key else 'NO (using heuristic fallback)'}")

    print("🚀 STEP 2: Verify GeminiClient initialization & availability check")
    client = GeminiClient()
    print(f"  ✓ GeminiClient.is_available(): {client.is_available()}")

    print("🚀 STEP 3: Verify MCP studio.ask_gemini tool")
    test_dir = os.path.abspath("test_gemini_workspace")
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir, exist_ok=True)
    
    mgr = StateManager(test_dir)
    mgr.init_project("Gemini Test Project")

    server = CinemaLitMCPServer(test_dir)
    res = server.handle_tool_call("studio.ask_gemini", {"prompt": "What are key director considerations for a short film?"})
    print(f"  ✓ studio.ask_gemini result keys: {list(res.keys())}")

    if client.is_available():
        assert "response" in res
        print("  ✓ Real Gemini API response received!")
    else:
        assert res.get("status") == "UNCONFIGURED"
        print("  ✓ Graceful unconfigured response received when API key is missing.")

    # Cleanup test workspace
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)

    print("\n🎉 GEMINI & .ENV INTEGRATION TESTS COMPLETED SUCCESSFULLY!\n")

if __name__ == "__main__":
    test_gemini_env_integration()
