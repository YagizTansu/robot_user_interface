# Robot User Interface

A comprehensive full-stack solution designed to monitor and control autonomous ROS2-based robots operating in simulation (Gazebo) or real-world environments. This interface features a real-time responsive dashboard, bidirectional ROS2 communication, and robust mapping utilizing React and Leaflet.

## Project Architecture

The workspace consists of three primary components:
- **Frontend**: A modern React application powered by Vite, providing real-time telemetry updates, maps (using Leaflet), and operator controls over WebSockets (Socket.IO).
- **Backend**: A flexible NestJS server handling WebSocket connections, storing historical data in MongoDB, and processing Change Streams to synchronize robot states across multiple clients.
- **ROS2 Navigation Stack**: Various ROS2 nodes managing mapping, localization (Navigation2/AMCL), laser merging, and Factor Graph Optimization visualization.

## Prerequisites

- Node.js (v18+ recommended)
- MongoDB (installed locally and configured as a Replica Set)
- ROS2 (Humble or Jazzy) and relevant dependencies (`robot_gazebo`, `robot_navigation`, `dual_laser_merger`)

## Setup Instructions

### 1. MongoDB Replica Set Configuration
The NestJS backend utilizes MongoDB Change Streams for real-time data replication, which requires MongoDB to run as a Replica Set.

1. Ensure MongoDB is stopped:
   ```bash
   sudo systemctl stop mongod
   ```
2. Edit your MongoDB configuration file (`/etc/mongod.conf`) and append the replication settings:
   ```yaml
   replication:
     replSetName: "rs0"
   ```
3. Start the MongoDB service:
   ```bash
   sudo systemctl start mongod
   ```
4. Initiate the replica set using the MongoDB shell:
   ```bash
   mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
   ```
   *You can verify the status by running `rs.status()` inside `mongosh`.*

### 2. Backend (NestJS)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the backend development server:
   ```bash
   npm run start:dev
   ```
   *Note: Ensure you see the "MongoDB Change Streams initialized" log message without any errors.*

### 3. Frontend (React with Vite)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Development & Maintenance

- **Adding Components**: To generate new modular NestJS resources, use the Nest CLI (e.g., `npx nest g resource <name>`).
- **Formatting**: Both subprojects are pre-configured with ESLint and Prettier. To auto-format backend code, run `npm run format`.
- **Environment Context**: Verify connection URLs (like WebSocket addresses) inside `frontend/src` configurations corresponding to your NestJS server ports.
