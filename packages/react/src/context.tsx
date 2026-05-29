import { createContext } from "react";
import type { AuthContextValue } from "./types.js";

export const AuthContext = createContext<AuthContextValue | null>(null);
