"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Globe,
  HeartHandshake,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { SpinningGlobe } from "@/components/landing/spinning-globe";
import { useAuth } from "@/lib/auth";

const HEADLINE_CYCLE = [
  { text: "Don't Let a Language Barrier Stop Your Dreams.", label: "English" },
  { text: "No Dejes Que el Idioma Detenga Tus Sueños.", label: "Español" },
  { text: "言葉の壁に夢を止めさせるな。", label: "日本語" },
  { text: "भाषा की बाधा आपके सपनों को न रोके।", label: "हिन्दी" },
];

const AGENTS = [
  {
    id: "dante",
    name: "Dante",
    subtitle: "The Architect of Action",
    description:
      "Struggling with a government form or confusing portal? Dante walks you through every field, every click in plain language.",
    icon: FileText,
    textColor: "text-nexus-dante",
    bgColor: "bg-nexus-dante/10",
    borderClass: "agent-card-dante",
    tag: "Forms & Portals",
    examples: ["USCIS work permit (I-765)", "SNAP food benefits", "State ID / driver's license"],
  },
  {
    id: "mismo",
    name: "Mismo",
    subtitle: "The Adaptive Mirror",
    description:
      "Practice real conversations before they happen. Mismo speaks at your level and coaches you through job interviews, phone calls, and daily life.",
    icon: MessageCircle,
    textColor: "text-nexus-mismo",
    bgColor: "bg-nexus-mismo/10",
    borderClass: "agent-card-mismo",
    tag: "Language Practice",
    examples: ["Job interview in English", "Calling your landlord", "Doctor's appointment prep"],
  },
  {
    id: "simpli",
    name: "Simpli",
    subtitle: "The Context Decoder",
    description:
      "Got a letter you don't fully understand? Simpli turns dense legal, medical, or bureaucratic language into a clear cheat sheet.",
    icon: BookOpen,
    textColor: "text-nexus-simpli",
    bgColor: "bg-nexus-simpli/10",
    borderClass: "agent-card-simpli",
    tag: "Plain Language",
    examples: ["What your lease really says", "IRS or tax notice explained", "Insurance EOB decoded"],
  },
];

const LANGUAGES = [
  "Arabic",
  "Bengali",
  "Chinese (Cantonese)",
  "Chinese (Mandarin)",
  "English",
  "Filipino / Tagalog",
  "French",
  "German",
  "Gujarati",
  "Haitian Creole",
  "Hindi",
  "Indonesian",
  "Italian",
  "Japanese",
  "Korean",
  "Malay",
  "Nepali",
  "Persian / Farsi",
  "Polish",
  "Portuguese",
  "Punjabi",
  "Romanian",
  "Russian",
  "Somali",
  "Spanish",
  "Swahili",
  "Tamil",
  "Telugu",
  "Thai",
  "Turkish",
  "Ukrainian",
  "Urdu",
  "Vietnamese",
  "Yoruba",
  "Other",
];

type AuthMode = "login" | "signup";

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);
}

export function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useScrollReveal();

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-nexus-bg text-nexus-text">
      <LandingNav openAuth={openAuth} />
      <HeroSection openAuth={openAuth} />
      <AgentsSection />
      <HowItWorksSection />
      <TrustSection />
      <CtaSection openAuth={openAuth} />
      {authOpen ? <AuthModal initialMode={authMode} onClose={() => setAuthOpen(false)} /> : null}
    </div>
  );
}

function LandingNav({ openAuth }: { openAuth: (mode: AuthMode) => void }) {
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-nexus-border bg-white/90 px-5 py-4 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nexus-accent shadow-[0_0_18px_rgba(21,128,61,0.5)]">
          <Globe className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-nexus-text">Unidad</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => openAuth("login")}
          className="rounded-lg px-4 py-2 text-sm text-nexus-muted transition-colors hover:text-nexus-text"
        >
          Sign In
        </button>
        <button type="button" onClick={() => openAuth("signup")} className="btn-primary px-5 py-2 text-sm">
          Get Started
        </button>
      </div>
    </nav>
  );
}

function HeroSection({ openAuth }: { openAuth: (mode: AuthMode) => void }) {
  const languageIndexRef = useRef(0);
  const [activeHeadline, setActiveHeadline] = useState(HEADLINE_CYCLE[0] ?? { text: "", label: "English" });
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    let updateTimeout = 0;
    let clearGlitchTimeout = 0;

    const interval = window.setInterval(() => {
      setIsGlitching(true);

      updateTimeout = window.setTimeout(() => {
        languageIndexRef.current = (languageIndexRef.current + 1) % HEADLINE_CYCLE.length;
        const entry = HEADLINE_CYCLE[languageIndexRef.current];

        if (!entry) {
          return;
        }

        setActiveHeadline(entry);
      }, 250);

      clearGlitchTimeout = window.setTimeout(() => setIsGlitching(false), 520);
    }, 3200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(updateTimeout);
      window.clearTimeout(clearGlitchTimeout);
    };
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-28 pt-20 text-center">
      <div className="pointer-events-none absolute inset-0">
        <SpinningGlobe />
        <div className="hero-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-nexus-border bg-nexus-card/80 px-4 py-1.5 text-xs text-nexus-muted backdrop-blur-sm transition-all duration-300">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-nexus-simpli" />
          <span>Now speaking:</span>
          <span className="font-semibold text-nexus-simpli">{activeHeadline.label}</span>
        </div>

        <div className="mb-6 flex min-h-[8rem] items-center justify-center sm:min-h-[9rem] lg:min-h-[10rem]">
          <h1
            className={`inline-block max-w-4xl text-4xl leading-[1.08] font-bold tracking-tight text-nexus-text sm:text-5xl lg:text-6xl ${isGlitching ? "glitch-active" : ""}`}
            style={{ textShadow: "0 0 60px rgba(21,128,61,0.2)" }}
          >
            {activeHeadline.text}
          </h1>
        </div>

        <p
          className="mb-10 text-2xl font-bold tracking-tight text-nexus-accent sm:text-3xl"
          style={{ textShadow: "0 0 28px rgba(21,128,61,0.4)" }}
        >
          Use Unidad.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <button type="button" onClick={() => openAuth("signup")} className="btn-primary px-9 py-4 text-base">
            Get Started Free
          </button>
          <button type="button" onClick={() => openAuth("login")} className="btn-ghost px-9 py-4 text-base">
            Sign In
          </button>
        </div>
      </div>

      <a
        href="#agents"
        className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-nexus-muted/50 transition-colors hover:text-nexus-muted"
      >
        <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
        <ArrowDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}

function AgentsSection() {
  return (
    <section id="agents" className="mx-auto max-w-6xl px-6 py-24">
      <div className="reveal mb-14 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-nexus-simpli">
          Tu equipo · Your team
        </p>
        <h2 className="mb-4 text-4xl font-bold text-nexus-text">Three specialists. One mission.</h2>
        <p className="mx-auto max-w-xl text-lg text-nexus-muted">
          Each one built for a different obstacle immigrants and language learners face every day.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {AGENTS.map((agent, index) => (
          <div key={agent.id} className={`reveal reveal-delay-${index + 1}`}>
            <AgentPreviewCard agent={agent} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentPreviewCard({ agent }: { agent: (typeof AGENTS)[number] }) {
  const Icon = agent.icon;

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border bg-nexus-card p-6 transition-all duration-300 ${agent.borderClass}`}
    >
      <div className="mb-5 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${agent.bgColor}`}>
          <Icon className={`h-6 w-6 ${agent.textColor}`} />
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${agent.bgColor} ${agent.textColor}`}>
          {agent.tag}
        </span>
      </div>
      <h3 className={`mb-1 text-xl font-bold ${agent.textColor}`}>{agent.name}</h3>
      <p className="mb-4 text-xs text-nexus-muted">{agent.subtitle}</p>
      <p className="flex-1 text-sm leading-relaxed text-nexus-muted">{agent.description}</p>
      <div className="mt-5 space-y-1.5">
        {agent.examples.map((example) => (
          <div key={example} className="flex items-center gap-2 text-xs text-nexus-muted/70">
            <div className={`h-1 w-1 rounded-full bg-current ${agent.textColor}`} />
            {example}
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaSection({ openAuth }: { openAuth: (mode: AuthMode) => void }) {
  return (
    <section className="px-6 py-32">
      <div className="reveal mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-nexus-accent/30 bg-nexus-accent/15 shadow-[0_0_36px_rgba(21,128,61,0.3)]">
          <Zap className="h-7 w-7 text-nexus-accent" />
        </div>
        <h2 className="mb-5 text-4xl leading-tight font-bold text-nexus-text sm:text-5xl">
          Your new life.
          <br />
          <span className="text-nexus-accent">Your language. Your pace.</span>
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-lg text-nexus-muted">
          No more staring at confusing letters. No more stumbling through interviews. Unidad is free and it&apos;s
          here for you.
        </p>
        <button type="button" onClick={() => openAuth("signup")} className="btn-primary px-10 py-4 text-base">
          Start for Free
          <ArrowRight className="ml-2 inline h-4 w-4" />
        </button>
        <p className="mt-8 text-xs text-nexus-muted/30">© 2026 Unidad · SolHacks</p>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      icon: <FileText className="h-5 w-5 text-nexus-dante" />,
      title: "Bring the confusing thing",
      description: "Paste a form, upload a letter, or start practicing for a conversation you need to have soon.",
    },
    {
      icon: <Sparkles className="h-5 w-5 text-nexus-mismo" />,
      title: "Get help in plain language",
      description: "Unidad translates, explains, and guides you one step at a time so you can move forward with confidence.",
    },
    {
      icon: <CheckCircle2 className="h-5 w-5 text-nexus-simpli" />,
      title: "Take the next step",
      description: "Walk away with a filled form, a practice conversation, or a clear summary of what the document actually means.",
    },
  ];

  return (
    <section className="bg-[linear-gradient(to_bottom,rgba(248,251,249,0),rgba(232,244,234,0.8))] px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="reveal mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-nexus-accent">How It Works</p>
          <h2 className="mb-4 text-4xl font-bold text-nexus-text">Support that meets you where you are.</h2>
          <p className="mx-auto max-w-2xl text-lg text-nexus-muted">
            Built for moments that feel high-stakes, confusing, or urgent. No jargon. No guessing. Just practical help.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`reveal reveal-delay-${Math.min(index + 1, 3)} rounded-3xl border border-nexus-border bg-white/80 p-7 shadow-[0_24px_70px_rgba(21,128,61,0.06)] backdrop-blur-sm`}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-nexus-card">
                {step.icon}
              </div>
              <p className="mb-2 text-lg font-bold text-nexus-text">{step.title}</p>
              <p className="text-sm leading-relaxed text-nexus-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const values = [
    {
      icon: <HeartHandshake className="h-5 w-5 text-nexus-accent" />,
      title: "Made for real-life pressure",
      description: "Interviews, forms, notices, appointments, school, housing, benefits. The moments where language barriers cost time and opportunity.",
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-nexus-mismo" />,
      title: "Clear and respectful",
      description: "The interface stays calm, readable, and supportive so users are guided instead of overwhelmed.",
    },
    {
      icon: <MessageCircle className="h-5 w-5 text-nexus-simpli" />,
      title: "Built for multilingual confidence",
      description: "Whether someone is learning English or navigating multiple languages daily, Unidad helps them act with more certainty.",
    },
  ];

  return (
    <section className="px-6 py-24">
      <div className="reveal mx-auto grid max-w-6xl gap-8 rounded-[2rem] border border-nexus-border bg-white p-8 shadow-[0_24px_80px_rgba(14,34,18,0.06)] lg:grid-cols-[1.1fr_1.4fr] lg:p-10">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-nexus-simpli">Why Unidad</p>
          <h2 className="mb-4 text-4xl font-bold leading-tight text-nexus-text">
            More than translation.
            <br />
            It&apos;s guided action.
          </h2>
          <p className="max-w-md text-base leading-relaxed text-nexus-muted">
            People do not just need words translated. They need next steps, context, reassurance, and a tool that helps them do something with the information.
          </p>
        </div>

        <div className="grid gap-4">
          {values.map((value) => (
            <div key={value.title} className="rounded-2xl border border-nexus-border bg-nexus-card/70 p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_8px_24px_rgba(21,128,61,0.08)]">
                {value.icon}
              </div>
              <p className="mb-1 text-base font-semibold text-nexus-text">{value.title}</p>
              <p className="text-sm leading-relaxed text-nexus-muted">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AuthModal({ initialMode, onClose }: { initialMode: AuthMode; onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, signup } = useAuth();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
        onClose();
        void router.push("/app");
      } else {
        const result = await signup({ name, email, password, preferredLanguage });

        if (result.emailConfirmationRequired) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("login");
          setPassword("");
          return;
        }

        onClose();
        void router.push("/app");
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setMode((currentMode) => (currentMode === "login" ? "signup" : "login"));
    setError("");
    setNotice("");
    setName("");
    setEmail("");
    setPassword("");
    setPreferredLanguage("");
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="modal-content relative mx-4 max-h-[90vh] w-full max-w-xl space-y-6 overflow-y-auto rounded-2xl border border-nexus-border bg-nexus-surface p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nexus-accent shadow-[0_0_16px_rgba(21,128,61,0.35)]">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-nexus-text">Unidad</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-nexus-muted transition-colors hover:bg-nexus-card hover:text-nexus-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-nexus-text">
            {mode === "login" ? "Welcome back" : "Join Unidad"}
          </h2>
          <p className="mt-1 text-sm text-nexus-muted">
            {mode === "login"
              ? "Sign in to continue to your dashboard."
              : "Create an account. It's free, and we're here to help."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" ? (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-nexus-muted">Your Name</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Ana, Wei, Priya, or yours…"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-nexus-muted">Preferred language</label>
                <select
                  value={preferredLanguage}
                  onChange={(event) => setPreferredLanguage(event.target.value)}
                  className="input-field min-w-0 text-sm"
                >
                  <option value="">Select preferred language…</option>
                  {LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className="space-y-1">
            <label className="text-sm font-medium text-nexus-muted">Email</label>
            <input
              className="input-field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-nexus-muted">Password</label>
            <div className="relative">
              <input
                className="input-field pr-12"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="absolute top-1/2 right-4 -translate-y-1/2 text-nexus-muted transition-colors hover:text-nexus-text"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="animate-fade-in flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="animate-fade-in rounded-xl border border-nexus-accent/20 bg-nexus-accent/8 px-4 py-3 text-sm text-nexus-accent">
              {notice}
            </div>
          ) : null}

          {mode === "login" ? (
            <div className="text-right">
              <button type="button" className="text-sm text-nexus-simpli transition-colors hover:text-nexus-text">
                Forgot password?
              </button>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex h-12 w-full items-center justify-center gap-2 px-6 text-sm sm:text-base"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "login" ? "Signing in…" : "Creating account…"}
              </>
            ) : mode === "login" ? (
              "Sign In"
            ) : (
              "Create Free Account"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-nexus-muted">
          {mode === "login" ? "New to Unidad?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="font-medium text-nexus-accent transition-colors hover:text-nexus-text"
          >
            {mode === "login" ? "Create a free account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
