import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardContent from './components/DashboardContent';
import GraphEditor from './components/GraphEditor';
import RobotsContent from './components/RobotsContent';
import MapsContent from './components/MapsContent';
import { RobotWebSocketProvider } from './contexts/RobotWebSocketContext';

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="dashboard">
      {mobileMenuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={closeMobileMenu}
        />
      )}

      <Sidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        onNavigate={closeMobileMenu}
      />

      <div className={`main-wrapper ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardContent />} />
          <Route path="/graph-editor" element={<GraphEditor />} />
          <Route path="/robots" element={<RobotsContent />} />
          <Route path="/maps" element={<MapsContent />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RobotWebSocketProvider>
        <AppLayout />
      </RobotWebSocketProvider>
    </BrowserRouter>
  );
}

export default App;
