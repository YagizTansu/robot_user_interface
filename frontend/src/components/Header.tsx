import '../styles/Header.css';

interface HeaderProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const Header = ({ 
  mobileMenuOpen, 
  setMobileMenuOpen
}: HeaderProps) => {
  return (
    <header className="header">
      <div className="header-left">
        <button 
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
      
      <div className="header-right">
        <div className="header-actions">
          <button className="action-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
          
          <button className="action-btn notifications-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="m13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="notification-badge">3</span>
          </button>
          
          <button className="action-btn settings-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="m12 1 4 6m-4-6-4 6m4-6v6m8 5-6-4m6 4-6 4m6-4h-6m-7 5 6-4m-6 4 6 4m-6-4h6"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;