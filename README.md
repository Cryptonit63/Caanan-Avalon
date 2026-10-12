# Avalon VlMiner

**Open-source monitoring, diagnostics, and experimental power-management software for Canaan AvalonMiner ASICs.**

**Автор / Author:** **vlasss666 / Cryptonit**  
**Status:** Active development · prerelease · experimental  
**Primary development target:** AvalonMiner **1326-106** (`MM4v1_X3`, `MM317`)  
**Platform:** Windows 10/11, Python 3.10+, modern web browser  
**License:** [MIT](LICENSE)

> **Русский:** Avalon VlMiner — открытый проект мониторинга, анализа и исследования энергопотребления ASIC-майнеров Canaan AvalonMiner. Его можно изучать, копировать, изменять и распространять на условиях лицензии MIT. Основной исследуемый аппарат — AvalonMiner 1326-106. Управление питанием и частотами экспериментально и не должно считаться проверенным для других моделей.

## Why this project exists

Avalon VlMiner aims to make AvalonMiner hardware observable and understandable: per-chip thermal maps, live telemetry, power-supply diagnostics, long-running measurements, and reproducible experiments. Its long-term objective is **Minimum Stable Power**: find the lowest *verified* operating power at which all hashboards continue mining reliably, rather than targeting an arbitrary wattage or maximizing hashrate at any cost.

It is **not** an official Canaan product, an approved firmware replacement, or a guarantee of safe undervolting.

## Features and current maturity

| Area | Description | Status |
| --- | --- | --- |
| Live monitoring | Read-only CGMiner API polling, hashrate, counters, fans, temperatures | Implemented in development builds; validate on your unit |
| Chip map | 3 hashboards × 114 chips: `PVT_T`, `PVT_V`, `MW` | Implemented for tested A1326 telemetry |
| Matrix Dark interface | Black UI, neon-green accents, interactive blue→green→red maps | Prerelease |
| Power diagnostics | Decode `PS`, expose PSU output estimate and compute J/TH | Experimental mapping; **not wall power** |
| Historical analysis | JSONL collection, trends, hot-chip detection, profile comparisons | Prerelease |
| Controller notifications | CGMiner `NOTIFY`, hardware error deltas, stale-data indicators | Prerelease |
| Factory profile browser | View Normal, High Performance and Power Mode settings | Read/compare only where verified |
| Adaptive Eco | Seek minimum stable power via measured profile comparisons | Analysis/design; autonomous tuning **not validated** |
| Experimental tuning | Frequency, voltage levels, domains and per-chip research | **Not established as supported hardware controls** |
| Power scheduler | Scheduled hashboard power operations and cooldown tracking | Experimental; compatibility and real actuation on A1326 **not verified** |
| Cooldown / restart | Controlled cooling, shutdown and reboot workflow | Design/research; verify hardware behavior first |

**Important:** Some previous prerelease interfaces displayed offline snapshots or had scheduling in simulation/blocked mode. A visible button or successful timer trigger **does not prove** a command was sent to or executed by the miner. Always check command response and subsequent hardware telemetry.

## Device and data model

Development has focused on one AvalonMiner 1326-106 running CGMiner 4.11.1 / API 3.7 on a FreeRTOS controller. The observed controller identifies three hashboards with 114 ASICs each (342 total). Other firmwares and AvalonMiner models may return different fields and require separate adapters.

Typical read-only API requests include `version`, `summary`, `stats`, `devs`, `config`, `estats`, `notify`, and `asccount` (support depends on firmware). Fields observed during development include:

- **Performance:** average and rolling hashrate, per-board `MGHS`, accepted/rejected/stale shares and hardware errors.
- **Cooling:** `Fan1`, `Fan2`, `TAvg`, `TMax`, and `PVT_T0..2`.
- **Chip diagnostics:** `PVT_V0..2` and `MW0..2` — currently treated as **raw/uncalibrated**, not millivolts or individual power regulators.
- **Power:** `PS[...]` — a documentation-based interpretation of `PS[4]` as PSU output to hashboards is under study. It is **not an independently verified AC wall-power reading**.
- **Profiles:** `WORKMODE`, `ATAOPTS`, frequency and voltage-level configuration where reported by the device.
- **Health:** CGMiner `NOTIFY`, error counters, communication status, and timestamp/age of the latest sample.

There is currently **no confirmed per-chip hardware-error counter**, **no validated physical chip-coordinate map**, and **no evidence that every chip has independently controllable voltage**. The UI must show **N/A** rather than inventing these measurements.

## Installation (Windows)

### Requirements

- Windows 10 or 11 and **Python 3.10+** available via `py -3`.
- Network connectivity to your **own or authorized** AvalonMiner.
- Miner CGMiner TCP API accessible (commonly port `4028`); local firewall and API access settings may vary.
- A current project checkout or verified prerelease package that includes `launcher.py`, `settings.ini`, frontend and backend files.

```powershell
cd C:\path\to\Avalon_VlMiner
py -3 --version
py -3 .\launcher.py
```

Open **http://127.0.0.1:8765/** in the same PC's browser. If using a development checkout without the portable launcher, launch the backend directly if that file is present:

```powershell
py -3 .\src\backend\avalon_server.py --host 192.168.3.41 --port 8765 --interval 30
```

Edit `settings.ini` **if included in your distribution**. Example:

```ini
[miner]
ip = 192.168.3.41
api_port = 4028

[dashboard]
port = 8765
bind = 127.0.0.1
interval_seconds = 30
```

**Use your own device IP.** `192.168.3.41` is a development example, not an address suitable for every installation. Keep the dashboard bound to loopback unless you deliberately secure access; do not expose the CGMiner API or management interface to the public internet.

### Verify actual live data

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/health
Invoke-RestMethod http://127.0.0.1:8765/api/state
```

Check `status.online`, `status.age_seconds`, and `snapshot.timestamp`. A status such as `LIVE` is meaningful only if timestamps advance and the data is from the miner, not a bundled demo snapshot. If the UI stays on **Connecting**, check browser developer console and verify the frontend/backend files belong to the same build.

> API paths and startup options apply to the current development line. Check the actual checkout before relying on them in automation.

## Example development layout

```text
Avalon_VlMiner/
├── launcher.py                 # Portable launcher (if included)
├── settings.ini                # Local runtime configuration (if included)
├── src/
│   ├── backend/
│   │   ├── avalon_server.py     # Local API / live collection
│   │   ├── avalon_monitor.py    # Telemetry logger
│   │   ├── avalon_analyzer.py   # Offline analysis
│   │   └── avalon_probe.py      # Read-only controller discovery
│   └── frontend/
│       ├── index.html
│       ├── styles.css
│       ├── app.js
│       ├── data.js
│       └── logo.jpg
├── temp/                       # Logs, captures, diagnostics; do not commit device secrets
├── prerelease/                 # Experimental builds
└── release/                    # Verified numbered releases only
```

This is the intended layout, not a promise that every branch/package includes every file.

## Safety and power management

**Read-only monitoring is the default recommendation.** Changes to hashboard power, operating mode, clocks, voltages, fans, or reboot state can interrupt mining, cause an unavailable board, or require physical recovery.

- **Never infer successful actuation from a scheduler log alone.** Require a documented control command, a successful controller response, and a distinct change in subsequent live telemetry.
- Canaan documents `hashpower` variants for some Avalon generations; this **does not establish support or identical behavior** on every 1326 firmware. Do not run model-incompatible commands.
- **Powering off hashboards is not the same as disconnecting AC power.** A controller and fans might stay powered, depending on hardware/firmware; verify this on the exact unit.
- A pre-shutdown cooldown workflow requires confirmed ability to stop hashing while keeping effective cooling. If only immediate board-power-off is supported, describe it accurately as **power off → fan cooldown**, not as prior cooldown.
- Any automatic adaptation must include fresh-data checks, full event logs, guardrails, operator confirmation for first activation, and a **tested recovery path**.
- Do not treat a temperature color scale (for example its 90 °C upper bound) as a manufacturer-approved thermal limit.
- Compare efficiency only for the **same power measurement boundary**: `PS` output J/TH and wall-input J/TH are not interchangeable.

**Do not enable unattended real power scheduling until the exact device's off command, fan behavior, and recovery procedure have been verified in a supervised test.**

## Research direction: Adaptive Eco

The research goal is **minimum stable consumption**, not a fixed 1500 W target. Candidate profiles should be evaluated one at a time, with an explicit baseline and matched observation windows. Stability should cover three functioning hashboards, useful hashrate, communication health, temperature trends, PSU state, and rates of new errors. Invalid or unsafe candidates should never be promoted to verified profiles. Separate *analysis/simulation* from actual writes to hardware.

Research questions include supported `Power Level` ordering, safe frequency/voltage ranges, shared voltage-domain topology, power-supply measurement calibration, whether supported firmware commands are hot-applied or reboot-bound, and safe rollback.

## Contributing

**Contributions are welcome:** bug reports, reproducible API captures (sanitized), hardware/firmware compatibility notes, tests, UI improvements, translations, documentation, and independent implementations of well-described protocols.

1. Open an issue describing the hardware model, firmware version, expected behavior, actual behavior, and reproduction steps.
2. Fork the repository and work in a focused branch.
3. Submit a pull request explaining the change, tests run, and whether it can send commands that alter hardware state.
4. Keep the default monitoring path safe; any write-capable feature should be explicitly gated and must never silently act on a device.
5. Respect third-party licenses. Do not submit copied proprietary firmware or code without redistribution rights.

**Security/privacy:** Before publishing logs, remove device serials/DNA, MAC addresses, real IPs, pool credentials, wallet identifiers, and any other sensitive information. Do not commit production `settings.ini`, internal telemetry captures, or test secrets.

## License and authorship

Copyright © 2026 **vlasss666 / Cryptonit**.

This project is distributed under the **MIT License**; see [LICENSE](LICENSE). You may use, copy, modify, merge, publish, distribute, sublicense, and sell copies under its terms, provided the required copyright and permission notice is preserved.

**Open source does not mean absence of copyright.** The author retains copyright while granting the permissions stated in the license. Third-party components remain subject to their own licenses. By contributing code, please ensure you have the right to license it under MIT.

## Disclaimer

This independent community project is not affiliated with or endorsed by Canaan. It is provided **“AS IS”**, without warranty. Cryptocurrency mining and power-electronics modifications carry operational and hardware risks. Users are responsible for their equipment, regulatory compliance, and backups/recovery procedures.
