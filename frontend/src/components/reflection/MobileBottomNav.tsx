import { Archive, BookOpen, History, PenLine, Settings } from "lucide-react";
import { localMode } from "../../local";
import type { ElementType } from "react";

type NavPage = "capture" | "memories" | "materials";

interface MobileBottomNavProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  onHistory?: () => void;
  onSettings?: () => void;
}

const navItems: Array<{ icon: ElementType; label: string; value: NavPage }> = [
  { icon: PenLine, label: "Capture", value: "capture" },
  { icon: BookOpen, label: "Memories", value: "memories" },
];

export function MobileBottomNav({ activePage, onNavigate, onHistory, onSettings }: MobileBottomNavProps) {
  if (localMode) return <nav aria-label="Primary navigation" className="mobile-bottom-nav mobile-bottom-nav--local">
    {[
      { label: "聊天", icon: PenLine, active: activePage === "capture", action: () => onNavigate("capture") },
      { label: "历史", icon: History, action: onHistory },
      { label: "记忆", icon: BookOpen, active: activePage === "memories", action: () => onNavigate("memories") },
      { label: "原材料", icon: Archive, active: activePage === "materials", action: () => onNavigate("materials") },
      { label: "设置", icon: Settings, action: onSettings },
    ].map(({ label, icon: Icon, active, action }) => <button key={label} type="button" aria-current={active ? "page" : undefined} className={`mobile-bottom-nav__item ${active ? "mobile-bottom-nav__item--active" : ""}`} onClick={action}><Icon aria-hidden="true" size={18} strokeWidth={1.9} /><span>{label}</span></button>)}
  </nav>;
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
