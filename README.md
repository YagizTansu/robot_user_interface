# Robot User Interface

A full-stack operator UI for monitoring and controlling autonomous ROS2-based robots. The stack uses a React dashboard, a NestJS API, MongoDB (with Change Streams), and Socket.IO for live robot pose updates.

## Architecture

| Layer | Technology | Role |
|-------|------------|------|
| **Frontend** | React 19 + Vite | Dashboard, Graph Editor, Robots, Maps pages; custom SVG map renderer |
| **Backend** | NestJS 11 | REST API, WebSocket gateway, command queue |
| **Database** | MongoDB 7 (replica set) | Maps, graphs, zones, robot registry, pose history, commands |

Robot pose data is written to MongoDB by external ROS2 nodes. The backend watches `robots_pose` via Change Streams and broadcasts updates to connected browsers.

## Prerequisites

- Node.js 20+
- MongoDB 7 configured as a replica set (required for Change Streams)

See [setup_commands.txt](./setup_commands.txt) for a full Ubuntu install guide.

## Environment variables

**Backend** (`backend/.env` — copy from `backend/.env.example`):

```bash
MONGODB_URI=mongodb://localhost:27017/robot_database
PORT=3000
```

**Frontend** (`frontend/.env` — copy from `frontend/.env.example`):

```bash
# Optional. Defaults to http://<current-hostname>:3000
# VITE_BACKEND_URL=http://192.168.1.10:3000
```

## Quick start

### 1. MongoDB replica set

```bash
sudo systemctl stop mongod
# Add to /etc/mongod.conf:
# replication:
#   replSetName: "rs0"
sudo systemctl start mongod
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
```

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```

Look for **MongoDB Change Streams initialized** in the logs.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173`).

## Main pages

- **Dashboard** — Live map, graph overlay, send robot to node
- **Graph Editor** — Create/edit navigation graphs, docking areas, activate graph on robot
- **Robots** — Fleet status, map/graph assignment, command history
- **Maps** — Browse maps, robots, and graphs

## Development

- NestJS resources: `npx nest g resource <name>` (inside `backend/`)
- Format backend: `npm run format` (inside `backend/`)
- Frontend build: `npm run build` (inside `frontend/`)

## Related systems

ROS2 navigation, Gazebo simulation, and map_server live outside this repository. This project is the operator web interface and API layer only.
