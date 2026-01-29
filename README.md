# Scan Lab

A minimal web application for capturing and persisting scan events using TypeScript, AlpineJS, Webpack 5, and PouchDB.

## Features

- **Button Events**: Click the "Push Button" to create button_push events
- **Scan Events**: Type text and press Enter to create scan events with the captured data
- **Local Persistence**: All events are stored locally in PouchDB (IndexedDB)
- **Real-time UI**: Events are displayed immediately with UUID, timestamp, and event type

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

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
2. **Scan Events**: Type text into the page and press Enter to create a `scan` event with the captured text

### Event Structure

All events are stored with the following structure:

```typescript
{
  _id: string,        // UUID v4
  eventType: string,  // "button_push" or "scan"
  ts: string,        // ISO 8601 timestamp
  data?: string      // (scan events only) The captured text
}
```

## Technology Stack

- **TypeScript**: Strict mode with ES modules
- **AlpineJS**: Reactive UI framework
- **Webpack 5**: Module bundler with HtmlWebpackPlugin
- **PouchDB**: Client-side database for event persistence
- **CSS Modules**: External stylesheets bundled by webpack

## Project Structure

```
scan-lab/
├── src/
│   ├── index.html          # HTML template
│   ├── main.ts            # Application entry point
│   ├── styles/
│   │   └── main.css       # Application styles
│   └── types/
│       └── alpinejs.d.ts  # TypeScript declarations
├── dist/                  # Build output (generated)
├── package.json
├── tsconfig.json
├── webpack.config.cjs
└── README.md
```

## License

ISC