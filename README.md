# Scan Lab

A minimal web application for capturing and persisting scan events using TypeScript, AlpineJS, Webpack 5, and PouchDB.

## Features

- **Button Events**: Click the "Push Button" to create button_push events
- **Scan Events**: Type text and press Enter to create scan events with the captured data
- **Local Persistence**: All events are stored locally in PouchDB (IndexedDB)
- **Real-time UI**: Events are displayed immediately with UUID, timestamp

## Getting Started

### Option 1: GitHub Codespaces (Recommended)

The easiest way to get started is using GitHub Codespaces:

1. Click the "Code" button on the GitHub repository
2. Select "Open with Codespaces" 
3. Click "New codespace"

The development environment will automatically set up with Node.js 20 and install all dependencies. Once ready, run:

```bash
npm run dev
```

The webpack dev server will start on port 8080, and GitHub Codespaces will automatically forward the port and provide you with a link to view the application in your browser.

### Option 2: Local Development

#### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

#### Installation

1. Clone the repository:
```bash
git clone https://github.com/mattfors/scan-lab.git
cd scan-lab
```

2. Install dependencies:
```bash
npm install
```

### Running the Application

#### Development Mode

Start the development server with hot module replacement:

```bash
npm run dev
```

This will:
- Start webpack-dev-server on http://localhost:8080
- Automatically open the application in your browser
- Watch for file changes and reload automatically

#### Production Build

Build the application for production:

```bash
npm run build
```

The optimized files will be output to the `dist/` directory.

## Usage

### Creating Events

1. **Button Events**: Click the "Push Button" to create a `button_push` event
2. **Scan Events**: Type text into the page and press Enter to create
