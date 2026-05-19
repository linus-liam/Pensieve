import { useEffect, useRef, useState } from "react";
import type { ColorTokens } from "../../types";

interface Props {
  t: ColorTokens;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function AuthForm({ t, onLogin, onRegister }: Props) {
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const submit = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (pending) return;

    const e = email.trim().toLowerCase();
    if (!e) {
      setError("Enter your email.");
      return;
    }
    if (!isEmail(e)) {
      setError("That doesn’t look like an email.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (tab === "signin") {
        await onLogin(e, password);
      } else {
        await onRegister(e, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  };

  const switchTo = (next: "signin" | "register") => {
    if (next === tab) return;
    setTab(next);
    setError(null);
  };

  const inputStyle: React.CSSProperties = {
    all: "unset",
    width: "100%",
    boxSizing: "border-box",
    borderBottom: `1px solid ${t.ink}`,
    padding: "8px 2px",
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontSize: 18,
    color: t.ink,
    lineHeight: 1.4,
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: t.paper,
        backgroundImage: `radial-gradient(${t.paperEdge} 1px, transparent 1px)`,
        backgroundSize: "3px 3px",
        color: t.ink,
        fontFamily: '"Source Sans 3", "Inter", system-ui, sans-serif',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <h1
          style={{
            margin: 0,
            textAlign: "center",
            fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}
        >
          Pensieve
        </h1>

        <div style={{ display: "flex", justifyContent: "center", gap: 28 }}>
          {([
            { id: "signin", label: "Sign in" },
            { id: "register", label: "Create account" },
          ] as const).map((it) => {
            const active = tab === it.id;
            return (
              <button
                key={it.id}
                onClick={() => switchTo(it.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontSize: 15,
                  color: active ? t.ink : t.inkSoft,
                  paddingBottom: 6,
                  borderBottom: `1px solid ${active ? t.accent : "transparent"}`,
                }}
              >
                {it.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontSize: 13,
                color: t.inkSoft,
              }}
            >
              Email
            </span>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              spellCheck={false}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontSize: 13,
                color: t.inkSoft,
              }}
            >
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={tab === "signin" ? "current-password" : "new-password"}
              style={inputStyle}
            />
          </label>

          {error && (
            <div
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontSize: 14,
                color: t.accent,
                paddingLeft: 12,
                borderLeft: `2px solid ${t.accent}`,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              all: "unset",
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.5 : 1,
              textAlign: "center",
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: 16,
              color: t.paper,
              background: t.ink,
              padding: "12px 16px",
              marginTop: 4,
            }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
