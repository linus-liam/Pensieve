type Page = "capture" | "memories";

interface SideNavProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

export function SideNav({ page, onNavigate }: SideNavProps) {
  return (
    <nav className="side-nav" aria-label="Main navigation">
      <div className="side-nav__brand">
        <h1 className="side-nav__title">Pensieve</h1>
        <p className="side-nav__subtitle">Digital Sanctuary</p>
      </div>

      <div className="side-nav__links">
        <button
          type="button"
          className={`side-nav__link ${page === "capture" ? "side-nav__link--active" : ""}`}
          onClick={() => onNavigate("capture")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            edit_note
          </span>
          Capture
        </button>
        <button
          type="button"
          className={`side-nav__link ${page === "memories" ? "side-nav__link--active" : ""}`}
          onClick={() => onNavigate("memories")}
        >
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={page === "memories" ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            auto_stories
          </span>
          Memories
        </button>
      </div>
    </nav>
  );
}
