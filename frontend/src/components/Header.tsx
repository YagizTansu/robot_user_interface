import '../styles/Header.css';

interface HeaderProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

/** Mobile-only hamburger; page titles live in the sidebar. */
function Header({ mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
  return (
    <header className="header header--minimal">
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
    </header>
  );
}

export default Header;
