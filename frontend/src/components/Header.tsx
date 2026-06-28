import { useLocation } from 'react-router-dom';
import '../styles/Header.css';

interface HeaderProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Live map and robot control' },
  '/graph-editor': { title: 'Graph Editor', subtitle: 'Navigation graphs and docking areas' },
  '/robots': { title: 'Robots', subtitle: 'Fleet status and configuration' },
  '/maps': { title: 'Maps', subtitle: 'Floor maps, robots, and graphs' },
};

function Header({ mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? { title: 'Robot Dashboard' };
  const isDashboard = pathname === '/dashboard';

  return (
    <header className={`header${isDashboard ? ' header--dashboard' : ''}`}>
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {isDashboard ? (
          <h1 className="page-title page-title--mobile-only">{meta.title}</h1>
        ) : (
          <div className="page-info">
            <h1 className="page-title">{meta.title}</h1>
            {meta.subtitle && <p className="page-subtitle">{meta.subtitle}</p>}
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
