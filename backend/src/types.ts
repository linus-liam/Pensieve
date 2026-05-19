export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
