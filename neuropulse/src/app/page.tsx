'use client';

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Brain, Activity, Users, TrendingUp, Clock, Target, Stethoscope, UserCheck } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Classification",
    description:
      "Advanced machine learning algorithms analyze EMG signals to detect Parkinson's tremor patterns with clinical-grade accuracy.",
  },
  {
    icon: Activity,
    title: "Real-time Monitoring",
    description:
      "Continuous monitoring of frequency, amplitude, and severity with live updates across all dashboards and devices.",
  },
  {
    icon: Users,
    title: "Multi-User Support",
    description:
      "Patient, caretaker, and doctor dashboards provide personalized insights and collaborative care management.",
  },
];

const workflow = [
  {
    label: "01",
    title: "Connect & Record",
    description:
      "Link ESP32 BioAmp to capture raw EMG data while AI processes signals for frequency-based classification.",
  },
  {
    label: "02",
    title: "Train & Learn",
    description:
      "Record sessions for normal, mild, and severe tremors to train adaptive models that improve over time.",
  },
  {
    label: "03",
    title: "Monitor & Analyze",
    description:
      "Access real-time dashboards with insights, trends, and recommendations for optimal Parkinson's management.",
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 opacity-60" aria-hidden>
        <div className="pointer-events-none absolute -left-52 top-32 h-96 w-96 rounded-full blur-3xl bg-[radial-gradient(circle,_rgba(99,102,241,0.32)_0%,_transparent_65%)]" />
        <div className="pointer-events-none absolute right-[-180px] top-0 h-[480px] w-[480px] rounded-full blur-[140px] bg-[radial-gradient(circle,_rgba(45,212,191,0.26)_0%,_transparent_70%)]" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-24 px-6 pb-32 pt-32">
        <section className="glass gradient-border grid gap-12 overflow-hidden px-10 py-16 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-8">
            <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-primary/70">
              <Activity className="size-4" />
              NeuroPulse
            </span>
            <h1 className="text-balance text-4xl font-semibold leading-tight text-primary sm:text-5xl">
              AI-powered Parkinson's tremor detection fusing biosignals with precision analytics.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Launch a privacy-first assistive platform that learns from every tremor. NeuroPulse blends muscle microvolt
              telemetry with frequency analysis to unlock comprehensive Parkinson's monitoring and insights.
            </p>

            <div className="flex flex-col items-start gap-4">
              <div className="text-sm font-semibold text-primary/80">Get Started:</div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-surface shadow-[0_12px_48px_rgba(99,102,241,0.45)] transition hover:translate-y-0.5 hover:brightness-110"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-primary shadow-[0_12px_48px_rgba(14,165,233,0.45)] transition hover:translate-y-0.5 hover:brightness-110"
                >
                  Register
                </Link>
              </div>
              <div className="text-sm font-semibold text-primary/80">Or Choose Your Dashboard:</div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard/patient"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-surface shadow-[0_12px_48px_rgba(99,102,241,0.45)] transition hover:translate-y-0.5 hover:brightness-110"
                >
                  <Users className="size-4" />
                  Patient Dashboard
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/dashboard/doctor"
                  className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-primary shadow-[0_12px_48px_rgba(14,165,233,0.45)] transition hover:translate-y-0.5 hover:brightness-110"
                >
                  <Stethoscope className="size-4" />
                  Doctor Dashboard
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/dashboard/caretaker"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-primary shadow-[0_12px_48px_rgba(34,197,94,0.45)] transition hover:translate-y-0.5 hover:brightness-110"
                >
                  <UserCheck className="size-4" />
                  Caretaker Dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </div>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-primary transition hover:bg-panel/60"
              >
                Explore Features
              </a>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border/40 bg-panel/60 p-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary/70">Frequency Range</p>
                <p className="text-lg font-semibold text-primary">0-12 Hz analyzed</p>
              </div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary/70">Accuracy</p>
                <p className="text-lg font-semibold text-primary">95%+ classification</p>
              </div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary/70">Latency</p>
                <p className="text-lg font-semibold text-primary">&lt; 100 ms response</p>
              </div>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary/70">Users</p>
                <p className="text-lg font-semibold text-primary">Multi-role dashboards</p>
              </div>
            </div>
          </div>

          <div className="relative flex h-full items-stretch justify-center">
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,_rgba(99,102,241,0.6),_rgba(14,165,233,0.3),_rgba(99,102,241,0.6))] opacity-50 blur-3xl" />
            <div className="glass relative flex h-full min-h-[520px] w-full max-w-md flex-col overflow-hidden">
              <div className="relative h-1/2 w-full">
                <Image src="/images.jpg" alt="EMG monitoring setup" fill className="object-cover" priority />
              </div>
              <div className="flex flex-1 flex-col items-center justify-between gap-6 px-6 pb-6 pt-6">
                <div className="inline-flex items-center gap-3 rounded-full bg-muted/40 px-4 py-2 text-sm font-medium text-primary/90">
                  <Target className="size-4" />
                  Live tremor monitoring
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  Real-time EMG analysis processes frequency bands to classify tremor severity with clinical precision.
                </div>
                <div className="flex w-full justify-between text-left text-xs text-muted-foreground">
                  <span>ESP32 stream</span>
                  <span>AI classification</span>
                  <span>Dashboard sync</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                  <div className="h-full w-3/4 animate-[pulse_1.8s_infinite] rounded-full bg-primary/80" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="grid gap-10 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="glass flex flex-col gap-4 px-6 py-8">
              <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-6" />
              </div>
              <h2 className="text-xl font-semibold text-primary">{title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-8 rounded-3xl border border-border/40 bg-panel/70 p-10">
          <div className="flex flex-col gap-2 text-left">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-primary/70">Workflow</p>
            <h2 className="text-3xl font-semibold text-primary">From signal capture to actionable insights</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              NeuroPulse operates end-to-end. Every EMG sample is processed locally, enabling real-time classification
              while maintaining privacy and providing comprehensive Parkinson's management tools.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {workflow.map((step) => (
              <article key={step.label} className="flex flex-col gap-4 rounded-3xl border border-border/40 bg-surface/60 p-6">
                <span className="text-sm font-semibold text-primary/80">{step.label}</span>
                <h3 className="text-xl font-semibold text-primary">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>

          <div className="glass flex flex-col gap-4 rounded-2xl border border-primary/30 bg-surface/60 p-6 text-sm text-muted-foreground">
            <h3 className="text-lg font-semibold text-primary">Technical & Integration Notes</h3>
            <ul className="grid gap-2 text-left">
              <li className="flex items-start gap-2">
                <span className="mt-1 size-2 rounded-full bg-primary/70" />
                <span>ESP32 / BioAmp front-ends stream differential voltages in the 0-12 Hz band via WebSocket.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-2 rounded-full bg-primary/70" />
                <span>Frequency-based classification uses rule-based thresholds with ML fallback for accuracy.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-2 rounded-full bg-primary/70" />
                <span>Next.js dashboards provide real-time updates, historical trends, and multi-user collaboration.</span>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
