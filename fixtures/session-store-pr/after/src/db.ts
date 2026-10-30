import postgres from "postgres";
import { SessionStore } from "./sessions/store";

export const sql = postgres(process.env.DATABASE_URL!);
export const sessions = new SessionStore(sql);
