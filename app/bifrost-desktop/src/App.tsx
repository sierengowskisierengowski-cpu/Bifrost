import { useCallback, useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { guardian, useSettings } from "@/lib/api";
import { isSetupComplete } from "@/lib/app-state";
import { startGuardian, stopGuardian } from "@/lib/tauri";

import { Splash } from "@/components/Splash";
import { Login } from "@/components/Login";
import { SetupWizard } from "@/components/SetupWizard";
import { Screensaver } from "@/components/Screensaver";
import { OpsCenter } from "@/components/OpsCenter";
import { Terminal } from "@/components/Terminal";
import { AppShell } from "@/components/AppShell";

import Overview from "@/pages/Overview";
import Incidents from "@/pages/Incidents";
import Attackers from "@/pages/Attackers";
import Live from "@/pages/Live";
import Timeline from "@/pages/Timeline";
import Mitre from "@/pages/Mitre";
import Heimdall from "@/pages/Heimdall";
import Gjallarhorn from "@/pages/Gjallarhorn";
import Mjolnir from "@/pages/Mjolnir";
import AnalystMatrix from "@/pages/AnalystMatrix";
import Settings from "@/pages/Settings";
import Legal from "@/pages/Legal";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

type Phase = "splash" | "wizard" | "login" | "app";

function Routes() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/overview" component={Overview} />
        <Route path="/incidents" component={Incidents} />
        <Route path="/attackers" component={Attackers} />
        <Route path="/live" component={Live} />
        <Route path="/timeline" component={Timeline} />
        <Route path="/mitre" component={Mitre} />
        <Route path="/heimdall" component={Heimdall} />
        <Route path="/gjallarhorn" component={Gjallarhorn} />
        <Route path="/mjolnir" component={Mjolnir} />
        <Route path="/analyst" component={AnalystMatrix} />
        <Route path="/settings" component={Settings} />
        <Route path="/legal" component={Legal} />
        <Route path="/not-found" component={NotFound} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    </AppShell>
  );
}

function App() {
  const [phase, setPhase] = useState<Phase>("splash");
  const [idle, setIdle] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const settings = useSettings();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // start the guardian client (and, in desktop, the python guardian process)
  useEffect(() => {
    guardian.start();
    startGuardian();
    return () => {
      stopGuardian();
    };
  }, []);

  const onSplashDone = useCallback(() => {
    setPhase(isSetupComplete() ? "login" : "wizard");
  }, []);

  // inactivity -> screensaver, only while in the app
  const resetIdle = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (phase === "app") {
      idleTimer.current = setTimeout(() => setIdle(true), settings.screensaverMs);
    }
  }, [phase, settings.screensaverMs]);

  useEffect(() => {
    // While idle (screensaver active) or terminal open, detach activity
    // listeners so the screensaver fully owns wake behaviour (e.g. Ops Center
    // peeks on mouse move instead of dismissing).
    if (phase !== "app" || idle || terminalOpen) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdle));
    resetIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [phase, idle, terminalOpen, resetIdle]);

  // Hidden console: typing the literal uppercase sequence "BIFROST" anywhere in
  // the app (while not focused in a field) opens the ASCII terminal easter egg.
  useEffect(() => {
    if (phase !== "app") return;
    const TARGET = "BIFROST";
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (e.key.length !== 1) return;
      // Require ALL CAPS: only accept exact uppercase letters.
      if (e.key >= "A" && e.key <= "Z") {
        buf = (buf + e.key).slice(-TARGET.length);
        if (buf === TARGET) {
          buf = "";
          setTerminalOpen(true);
        }
      } else {
        buf = "";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const wake = useCallback(() => {
    setIdle(false);
    setPhase("login"); // re-authenticate after screensaver
  }, []);

  // Router base: on Replit this is the artifact path (e.g. "/bifrost/"); in the
  // standalone Tauri desktop build, vite's base is "./" which yields "." — treat
  // that (and "") as the app root so navigation works in both environments.
  const rawBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const routerBase = rawBase === "" || rawBase === "." || rawBase === ".." ? "" : rawBase;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={routerBase}>
          {phase === "splash" && <Splash onDone={onSplashDone} />}
          {phase === "wizard" && <SetupWizard onComplete={() => setPhase("login")} />}
          {phase === "login" && <Login onSuccess={() => setPhase("app")} />}
          {phase === "app" && <Routes />}
          <AnimatePresence>
            {idle && phase === "app" && !terminalOpen &&
              (settings.screensaverStyle === "ops" ? (
                <OpsCenter onWake={wake} />
              ) : (
                <Screensaver onWake={wake} />
              ))}
          </AnimatePresence>
          <AnimatePresence>
            {terminalOpen && <Terminal onClose={() => setTerminalOpen(false)} />}
          </AnimatePresence>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
