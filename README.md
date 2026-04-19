# Pensieve

A structured thinking companion that helps you understand why you think the way you do — through guided dialogue.

## 🧠 What It Does

Pensieve is a chat-based reflection tool where an AI guides you through 5 stages of structured thinking:

| Stage | Purpose |
|-------|---------|
| **Explore** | Brain-dump your raw, unfiltered thoughts |
| **Clarify** | Identify the core issue or contradiction |
| **Dig** | Surface assumptions, blind spots, and avoided truths |
| **Reframe** | See the situation from a radically different angle |
| **Action** | Define one concrete next step within 24 hours |

The goal is **clarity**, not comfort. Pensieve won't coddle you — it'll make you think.

## 🛠 Tech Stack

- **Frontend:** Next.js (React) + Tailwind CSS
- **Backend:** Next.js API Routes
- **AI:** OpenAI API (gpt-4o-mini)
- **Storage:** In-memory (client-side state — no database)

## 📁 Project Structure

```
Pensieve/
├── app/
│   ├── api/chat/route.ts   # AI conversation endpoint
│   ├── globals.css          # Design system & animations
│   ├── layout.tsx           # Root layout with metadata
│   └── page.tsx             # Main chat page
├── components/
│   └── ChatInterface.tsx    # Chat UI component
├── .env.example             # Required environment variables
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env.local

# 3. Add your OpenAI API key to .env.local
# OPENAI_API_KEY=sk-your-key-here

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start reflecting.

## 🎨 Design

- Dark UI with a purple accent palette
- Animated message bubbles with fade-in
- Typing indicator with pulsing dots
- Custom thin scrollbar
- Responsive — works on mobile

## 📝 Notes

- Conversation history is held in React state (refreshing the page resets it)
- The system prompt enforces the 5-stage flow and one-question-at-a-time rule
- Swap `gpt-4o-mini` for `gpt-4o` in `app/api/chat/route.ts` for higher quality responses

## 🚧 Current Stage

MVP — Low-fidelity prototype & user testing
