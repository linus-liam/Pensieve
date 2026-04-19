import ChatInterface from "@/components/ChatInterface";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl h-[90vh] flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="relative px-6 py-5 border-b border-[var(--color-border-subtle)] text-center overflow-hidden">
          {/* Glow effect */}
          <div className="glow-bg absolute inset-0 bg-gradient-to-b from-[var(--color-accent-glow)] to-transparent pointer-events-none" />
          <h1 className="relative text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
            Pensieve
          </h1>
          <p className="relative mt-1 text-xs font-medium tracking-widest uppercase text-[var(--color-text-muted)]">
            Explore &rarr; Clarify &rarr; Dig &rarr; Reframe &rarr; Action
          </p>
        </header>

        {/* Chat area */}
        <ChatInterface />
      </div>
    </main>
  );
}
