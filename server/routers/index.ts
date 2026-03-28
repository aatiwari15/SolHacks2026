import { router } from "../trpc";

// Import and add sub-routers here as you build features.
// Example:
// import { messagesRouter } from "./messages";

export const appRouter = router({
  // messages: messagesRouter,
});

export type AppRouter = typeof appRouter;
