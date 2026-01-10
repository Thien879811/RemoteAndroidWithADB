# Android Remote Management System

A sleek, web-based dashboard to manage and control multiple Android devices using ADB and scrcpy.

## Features
- 📱 **Device Discovery**: Automatically lists all USB and Wireless connected devices.
- 📺 **scrcpy Integration**: Launch remote screen control with one click.
- 🕹️ **Quick Controls**: Send Home, Back, and Power button events remotely.
- 🎨 **Modern UI**: Premium Glassmorphism design with dark mode.

## Prerequisites
- **ADB**: Must be installed and available in PATH.
- **scrcpy**: Must be installed and available in PATH.
- **Node.js**: Required to run the bridge server.

## Installation & Running

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Start the server**:
   ```bash
   node index.js
   ```

3. **Open the dashboard**:
   Go to `http://localhost:3001` in your browser.

## Project Structure
- `server/`: Node.js Express server using `adbkit`.
- `client/`: Vanilla JS and CSS frontend.
