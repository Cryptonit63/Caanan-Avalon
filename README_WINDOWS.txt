Avalon VlMiner | Portable Windows (read-only prerelease)
Author: vlasss666 / Cryptonit (c) 2026.

1. Unzip the entire folder anywhere on a Windows 10/11 PC.
2. Install Python 3.10+ if it is not already installed (python.org).
3. Open settings.ini and change [miner] ip to your AvalonMiner IP.
4. PC must be on a network that can reach TCP port 4028 of the ASIC.
5. Double-click START_WINDOWS.bat.
6. The local UI opens automatically at http://127.0.0.1:8765/
7. Stop with Ctrl+C in the terminal.

No administrator privileges or pip packages required. This is a portable Python
application, NOT a standalone .exe; Python is a prerequisite.
The application requests only CGMiner version, summary, stats and notify.
It does NOT change mining settings, reboot or shutdown the miner.

Data provenance:
The UI contains a bundled historical sample for initial layout rendering.
Only LIVE updates timestamped by the backend should be interpreted as current.
The default historical sample is from development and is NOT a reading of
another miner. If backend is not available, UI must indicate OFFLINE / SAMPLE.
PS[4] is an unverified-for-model estimate of PSU output to hashboards, not wall power.
Per-chip hardware error counters are not available: N/A is expected.
All diagnostic logs remain locally in the temp/ folder.
Do not open the dashboard port to the internet; it binds to 127.0.0.1.

Troubleshooting:
  - UI stuck: open http://127.0.0.1:8765/api/health and /api/state.
  - online false: check ASIC IP, port 4028 and firewall.
  - address in use: close older launcher instance or change dashboard port.
  - check terminal errors and temp/live_*.jsonl logs.
