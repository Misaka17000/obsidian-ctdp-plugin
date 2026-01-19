# Obsidian Chain Time Delay Protocol (CTDP) Plugin

A strict, disciplined focus timer plugin for Obsidian, inspired by the "Chain Time Delay Protocol" concept. It enforces productivity through a "sacred seat" mechanic: if you break the chain, you lose everything.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-%3E%3D0.15.0-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Strict Chain Mechanic
- **Main Chain:** Counts your successful focus sessions. Resets to 0 immediately upon failure.
- **Auxiliary Chain:** Tracks your "Bookings" (intention setting before focus).

### "Sacred Seat" Workflow
1. **Book:** Set an intention to focus. A countdown timer starts.
2. **Skip/Start:** Start the session manually, or wait for the booking timer to expire and auto-start.
3. **Focus:** Deep work session with a countdown timer.
4. **Complete:** Session ends automatically when time is up, +1 to your Main Chain.

### Exception Rules ("Must Be a Precedent")
- Strict pausing mechanism. You cannot just pause; you must select a pre-defined "Exception Rule" (e.g., "Bathroom", "Drink Water").
- Each rule has a strict time limit. Exceeding it breaks the chain.
- Tracks usage statistics for each exception.
- **Note:** When the chain resets, all exception rules are cleared.

### Daily Note Logging
- Automatically logs completed sessions to your Daily Note.
- Log format: `- [x] 14:30 - 15:30 🎯 **Task Name** (⏰ Booked: 14:15, ⏸️ Exceptions: Bathroom, Drink)`
- Supports custom date formats and Daily Note folder paths.
- Auto-detects settings from Obsidian's built-in Daily Notes plugin.

### Multi-Task Management
- Create separate chains for different types of work (e.g., "Coding", "Writing", "Reading").
- Switch between tasks easily from the dashboard dropdown.

### Status Bar Timer
- Shows countdown timer in Obsidian's status bar.
- Different icons for different states:
  - 🎯 Active (focusing)
  - 🗓️ Booked (waiting)
  - ⏸️ Paused (on break)

### User Interface
- Beautiful circular progress timer.
- Clean, minimalist design.
- Responsive controls that change based on current state.
- Statistics display: Main Chain count, Booking count, Exception usage count.

### Internationalization
- **English**
- **简体中文 (Simplified Chinese)**
- Automatically detects your Obsidian language setting, or manually override in settings.

### System Notifications
- Desktop notifications for session start, completion, and chain breaks.
- Can be enabled/disabled in settings.

## Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings -> Community Plugins.
2. Disable Safe Mode if prompted.
3. Click "Browse" and search for "CTDP".
4. Click "Install", then "Enable".

### Manual Installation
1. Go to your Obsidian Vault folder: `.obsidian/plugins/`.
2. Create a new folder named `obsidian-ctdp-plugin`.
3. Download the latest release from GitHub.
4. Place the following files into that folder:
   - `main.js`
   - `styles.css`
   - `manifest.json`
5. Open Obsidian -> Settings -> Community Plugins -> Enable `CTDP Plugin`.

### Development
1. Clone this repository into your vault's `.obsidian/plugins/` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. For development with auto-rebuild:
   ```bash
   npm run dev
   ```

## Usage

### Getting Started
1. **Open the Dashboard:** Click the 🎯 icon in the left ribbon, or use the command palette (`Ctrl/Cmd + P` -> "Open Dashboard").
2. **Create a Task:** Click the gear icon in the dashboard -> "New Task".
   - Set **Session Duration** (focus time in minutes, e.g., 60).
   - Set **Booking Duration** (preparation time in minutes, e.g., 15). Set to 0 to skip booking phase.
3. **Add Exception Rules:** Edit your task and add rules like "Bathroom" (5 min limit), "Drink Water" (2 min limit).

### Workflow
1. Click the ⏰ **Alarm Clock** icon to book a session.
2. During booking countdown:
   - Click ⏭️ **Skip** to start immediately.
   - Or wait for auto-start when booking time expires.
3. During focus session:
   - Click ⏸️ **Pause** to take a break (must select an exception rule).
   - Click ▶️ **Resume** to continue.
   - Session completes automatically when time is up.
4. **Do Not Fail:**
   - If you give up during a session -> **Chain Resets to 0**.
   - If pause time limit exceeded -> **Chain Resets to 0**.
   - If you cancel a booking -> **Chain Resets to 0**.

### Settings
- **Language:** System Default / English / 简体中文
- **System Notifications:** Enable/disable desktop notifications.
- **Status Bar Timer:** Show/hide countdown in status bar.
- **Daily Note Logging:**
  - **Date Format:** e.g., `YYYY-MM-DD` or `YYYY年MM月DD日`
  - **Daily Note Folder:** Path to your daily notes folder.
  - **Auto-detect:** Automatically get settings from Daily Notes plugin.
- **Danger Zone:** Reset all settings and tasks.

## Data Storage

All plugin data is stored in `.obsidian/plugins/obsidian-ctdp-plugin/data.json`, including:
- Task configurations and chain counts.
- Plugin settings.
- Data version for migration support.

## Changelog

### v1.0.0
- Initial release.
- Core features: Chain mechanic, Sacred Seat workflow, Exception rules.
- Daily Note logging with customizable format.
- Multi-language support (English, Chinese).
- Status bar timer display.
- Data migration system for future updates.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

**Misaka17000**

- GitHub: [@Misaka17000](https://github.com/Misaka17000)

## Acknowledgments

- Inspired by the Chain Time Delay Protocol concept for self-control and productivity.
- Built with the [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api).
