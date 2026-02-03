# TaskMaster - Distributed Task Scheduler

## Overview

TaskMaster is a web-based UI for a distributed task scheduler backend. The application allows users to schedule tasks, view their status, and monitor the system in real-time. The backend simulates a distributed architecture with a scheduler, coordinator, workers, and PostgreSQL database.

The task lifecycle flows as: User submits task → Scheduler saves to DB → Coordinator polls DB every 10s → Coordinator assigns to Worker (round-robin) → Worker executes (5s simulation) → Worker reports completion → User can query status.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for smooth page transitions and timeline animations
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ES modules
- **API Pattern**: REST endpoints defined in `shared/routes.ts` with Zod schemas for type safety
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Storage**: connect-pg-simple for PostgreSQL-backed sessions

### Data Storage
- **Database**: PostgreSQL (connection via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` defines tables for tasks and workers
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization
- **Client-side Persistence**: localStorage used to persist Task IDs since no global list endpoint exists

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route-level page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and providers
├── server/              # Express backend
│   ├── routes.ts        # API endpoint definitions
│   ├── storage.ts       # Database operations layer
│   └── db.ts            # Database connection
├── shared/              # Shared code between client and server
│   ├── schema.ts        # Drizzle database schema
│   └── routes.ts        # API contracts with Zod schemas
└── migrations/          # Database migration files
```

### Key Design Decisions
1. **Shared Types**: API contracts defined once in `shared/routes.ts` and used by both frontend and backend, ensuring type safety across the stack
2. **Component Library**: shadcn/ui provides accessible, customizable components with consistent theming
3. **Dark Mode**: Theme toggle with localStorage persistence and system preference detection
4. **Worker Simulation**: Backend initializes 3 workers on startup and simulates task execution with round-robin assignment

## External Dependencies

### Database
- **PostgreSQL**: Primary data store accessed via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database operations with `drizzle-orm` and `drizzle-zod` for schema validation

### UI Components
- **Radix UI**: Headless component primitives for accessibility (dialog, popover, select, tabs, etc.)
- **shadcn/ui**: Pre-styled component library built on Radix UI
- **Lucide React**: Icon library

### API & Data Fetching
- **TanStack React Query**: Server state management with caching and refetching
- **Zod**: Runtime type validation for API requests and responses

### Development Tools
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the entire codebase