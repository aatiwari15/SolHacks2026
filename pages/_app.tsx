import "@/styles/globals.css";
import type { AppProps } from "next/app";

// Unidad uses a fixed warm-dark theme — no theme switching needed.
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
