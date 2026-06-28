import { useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import DashboardContent from './components/DashboardContent'
import GraphEditor from './components/GraphEditor'
import RobotsContent from './components/RobotsContent'
import MapsContent from './components/MapsContent'

const MAP_STORAGE_KEY = 'dashboard_selected_map';
const ROBOT_STORAGE_KEY = 'dashboard_selected_robot';

function App() {
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen] = useState(false)

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <Sidebar
        activeMenuItem={activeMenuItem}
        setActiveMenuItem={setActiveMenuItem}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
      />

      {/* Main Content */}
      <div className={`main-wrapper ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        {/* <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        /> */}

        {/* Dashboard Content */}
        {activeMenuItem === 'dashboard' && <DashboardContent />}
        
        {/* Placeholder for other pages */}
        {activeMenuItem === 'robots' && (
          <RobotsContent
            onOpenDashboard={(mapName, robotName) => {
              localStorage.setItem(MAP_STORAGE_KEY, mapName);
              localStorage.setItem(ROBOT_STORAGE_KEY, robotName);
              setActiveMenuItem('dashboard');
            }}
          />
        )}
        
        {activeMenuItem === 'maps' && (
          <MapsContent
            onOpenDashboard={(mapName) => {
              localStorage.setItem(MAP_STORAGE_KEY, mapName);
              localStorage.removeItem(ROBOT_STORAGE_KEY);
              setActiveMenuItem('dashboard');
            }}
            onOpenGraphEditor={(mapName) => {
              localStorage.setItem('graph_editor_selected_map', mapName);
              setActiveMenuItem('graph-editor');
            }}
          />
        )}
        
        {activeMenuItem === 'graph-editor' && <GraphEditor />}
      </div>
    </div>
  )
}

export default App