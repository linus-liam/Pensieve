import { BookOpen, PenLine } from "lucide-react";
import type { ElementType } from "react";

type NavPage = "capture" | "memories";

interface MobileBottomNavProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const navItems: Array<{ icon: ElementType; label: string; value: NavPage }> = [
  { icon: PenLine, label: "Capture", value: "capture" },
  { icon: BookOpen, label: "Memories", value: "memories" },
];

export function MobileBottomNav({ activePage, onNavigate }: MobileBottomNavProps) {
  return (
    <nav aria-label="Primary navigation" className="mobile-bottom-nav">
      {navItems.map(({ icon: Icon, label, value }) => {
        const active = activePage === value;

        return (
          <button
            aria-current={active ? "page" : undefined}
            className={[
              "mobile-bottom-nav__item",
              active ? "mobile-bottom-nav__item--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={value}
            type="button"
            onClick={() => onNavigate(value)}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
