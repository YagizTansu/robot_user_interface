import { useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import DashboardContent from './components/DashboardContent'
import GraphEditor from './components/GraphEditor'

function App() {
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
          <main className="main-content">
            <div className="grid-container">
              <h2>Robots Page - Coming Soon</h2>
            </div>
          </main>
        )}
        
        {activeMenuItem === 'maps' && (
          <main className="main-content">
            <div className="grid-container">
              <h2>Maps Page - Coming Soon</h2>
            </div>
          </main>
        )}
        
        {activeMenuItem === 'graph-editor' && <GraphEditor />}
        
        {activeMenuItem === 'analytics' && (
          <main className="main-content">
            <div className="grid-container">
              <h2>Analytics Page - Coming Soon</h2>
            </div>
          </main>
        )}
        
        {activeMenuItem === 'monitoring' && (
          <main className="main-content">
            <div className="grid-container">
              <h2>Monitoring Page - Coming Soon</h2>
            </div>
          </main>
        )}
        
        {activeMenuItem === 'settings' && (
          <main className="main-content">
            <div className="grid-container">
              <h2>Settings Page - Coming Soon</h2>
            </div>
          </main>
        )}
        
        {activeMenuItem === 'alerts' && (
          <main className="main-content">
            <div className="grid-container">
              <h2>Alerts Page - Coming Soon</h2>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}

export default App