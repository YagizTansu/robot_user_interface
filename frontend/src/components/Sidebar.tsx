import React from 'react';
import '../styles/Sidebar.css';

interface SidebarProps {
  activeMenuItem: string;
  setActiveMenuItem: (item: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileMenuOpen: boolean;
}

interface MenuItem {
  id: string;
  icon: React.ReactElement;
  label: string;
  active: boolean;
}

const Sidebar = ({ 
  activeMenuItem, 
  setActiveMenuItem, 
  sidebarCollapsed, 
  setSidebarCollapsed, 
  mobileMenuOpen 
}: SidebarProps) => {
  const menuItems: MenuItem[] = [
    { 
      id: 'dashboard', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      ), 
      label: 'Dashboard', 
      active: true 
    },
    { 
      id: 'graph-editor', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      ), 
      label: 'Graph Editor', 
      active: false 
    },
    { 
      id: 'robots', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="10" rx="2"/>
          <circle cx="8" cy="9" r="2"/>
          <path d="m9 16 1-1 1 1"/>
          <path d="m15 16 1-1 1 1"/>
          <path d="M9 7h6"/>
          <path d="M12 16v4"/>
        </svg>
      ), 
      label: 'Robots', 
      active: false 
    },
    { 
      id: 'maps', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/>
          <line x1="8" y1="2" x2="8" y2="18"/>
          <line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
      ), 
      label: 'Maps', 
      active: false 
    },
    { 
      id: 'analytics', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
        </svg>
      ), 
      label: 'Analytics', 
      active: false 
    },
    { 
      id: 'monitoring', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ), 
      label: 'Monitoring', 
      active: false 
    },
    { 
      id: 'settings', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="m12 1 4 6m-4-6-4 6m4-6v6m8 5-6-4m6 4-6 4m6-4h-6m-7 5 6-4m-6 4 6 4m-6-4h6"/>
        </svg>
      ), 
      label: 'Settings', 
      active: false 
    },
    { 
      id: 'alerts', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="m13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ), 
      label: 'Alerts', 
      active: false 
    },
  ];

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <img 
              src="/logo/logo.jpg" 
              alt="ADVOARD Logo" 
              className="logo-image"
            />
          </div>
          {!sidebarCollapsed && <span className="logo-text">ADVOARD</span>}
        </div>
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarCollapsed ? (
              <polyline points="9,18 15,12 9,6"/>
            ) : (
              <polyline points="15,18 9,12 15,6"/>
            )}
          </svg>
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeMenuItem === item.id ? 'active' : ''}`}
            onClick={() => setActiveMenuItem(item.id)}
            title={sidebarCollapsed ? item.label : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div className="user-info">
              <div className="user-name">Miranda</div>
              <div className="user-role">Operator</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;