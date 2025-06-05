# Work Hours Progress Bar

A browser extension that displays a clean, minimalist progress bar at the bottom of any webpage to help you visualize and track your work day progress.

## Features

- **Visual Progress Tracker**: Displays a live progress bar showing how much of your defined work day has elapsed
- **Countdown Timer**: Add a second progress bar for custom countdown durations to track focused work sessions
- **Customizable Work Hours**: Set your own start and end times for your work day
- **Time Information**: Shows total work hours and remaining time
- **Percentage Display**: Clearly indicates the exact percentage of your work day that has passed
- **Minimalist Design**: Clean, unobtrusive interface that works on any website
- **Persistent Settings**: Your work hour preferences are saved across browser sessions

## How It Works

The extension adds a subtle progress bar to the bottom of every webpage you visit. The bar fills up as your work day progresses from your set start time to end time. The default work hours are set from 8:00 AM to 9:00 PM, but you can easily customize this to match your own schedule.

### Countdown Timer

The countdown timer allows you to set a specific duration (5, 10, 15, 25, 30, 45 minutes or custom) for focused work or breaks. When active, a second progress bar appears, showing the countdown progress. When the timer ends, you'll receive a notification.

## Settings

Click on the clock icon at the bottom-left corner of any webpage to access the settings panel:

1. **Start Time**: Set when your work day begins
2. **End Time**: Set when your work day ends
3. **Save**: Click to save your settings

For the countdown timer, click the timer icon next to the clock:

1. **Quick Duration Buttons**: Choose a preset duration
2. **Custom Duration**: Enter a specific time in minutes
3. **Start**: Begin the countdown
4. **Stop/Reset**: Control active countdowns

Your settings are automatically synced across all your browser instances where the extension is installed.

## Technical Details

The extension is built using:
- Manifest V3 Chrome Extension API
- Vanilla JavaScript
- CSS for styling
- Chrome Storage API for saving user preferences

## Privacy

This extension:
- Does not collect any user data
- Does not communicate with external servers
- Only requires the "storage" and "notifications" permissions to save preferences and show countdown alerts

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now be installed and active

## License

This project is available as open source under the terms of the MIT License.

## 规则
Chrome扩展的Manifest V3不允许在CSP中使用'unsafe-inline'
clerk不能redirect 到chrome-extension里面