# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a single-page web application for managing point-based speed skating races ("Gara a Punti"). It tracks athlete scores during checkpoints, handles race state, and provides a real-time leaderboard. The UI is in Italian.

## Development

This is a vanilla JavaScript project with no build system or dependencies. To run:

1. Open `index.html` directly in a browser, or
2. Use any local HTTP server (e.g., `python3 -m http.server 8000`)

## Architecture

**State Management** (`app.js:1-29`): Single `state` object holds all application state including configuration, race progress, athletes (stored in a `Map`), checkpoint tracking, and action history. State is persisted to localStorage for recovery.

**Athlete Model** (`app.js:32-39`): `Athlete` class with number, points, status (`normal`/`lapped`/`disqualified`), and savedPoints for recovery.

**Key Flows**:
- Configuration screen sets total laps and checkpoint frequency (every lap or every 2 laps)
- Race screen shows controls and live leaderboard
- Points assignment via on-screen keyboard or by clicking athlete rows
- Checkpoint completion triggers lap countdown and state save
- Undo system reverts entire checkpoints via history stack

**UI Components**:
- Config screen: Race setup form
- Race screen: Header badges, control buttons, leaderboard table
- Athlete menu: Context menu for status changes (lap/disqualify/reinstate) and manual point adjustments
- Keyboard overlay: Numpad for entering athlete numbers and assigning checkpoint points
- Dialog system: Confirmation modals for destructive actions

**CSS** (`styles.css`): Uses CSS custom properties for theming. High-contrast color scheme. Mobile-responsive with breakpoints at 768px and 480px.
