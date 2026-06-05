import { createPersistentStore } from "./persistent-store";

export interface Trap {
  id: string;
  name: string;
  description: string;
  deployed: boolean;
  deployedAt: string | null;
}

export interface TrapLogEntry {
  id: string;
  timestamp: string;
  message: string;
}

export interface CountermeasuresState {
  traps: Trap[];
  log: TrapLogEntry[];
}

const DEFAULT_TRAPS: Trap[] = [
  {
    id: "aws",
    name: "Fake AWS Credentials",
    description: "Decoy IAM keys planted in ~/.aws/credentials. Any use trips a high-severity alert.",
    deployed: false,
    deployedAt: null,
  },
  {
    id: "db",
    name: "Fake DB Config",
    description: "Honeytoken database.yml with a bait DSN. Connection attempts are flagged instantly.",
    deployed: false,
    deployedAt: null,
  },
  {
    id: "ssh",
    name: "Decoy SSH Key",
    description: "Planted id_rsa honeykey. Usage signals lateral-movement attempts.",
    deployed: false,
    deployedAt: null,
  },
  {
    id: "canary",
    name: "Canary Documents",
    description: "Tracked bait files that beacon home the moment they're opened or exfiltrated.",
    deployed: false,
    deployedAt: null,
  },
];

const DEFAULTS: CountermeasuresState = { traps: DEFAULT_TRAPS, log: [] };

const store = createPersistentStore<CountermeasuresState>("bifrost.countermeasures", DEFAULTS);

export const useCountermeasures = store.use;

function pushLog(message: string, base: TrapLogEntry[]): TrapLogEntry[] {
  const entry: TrapLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    message,
  };
  return [entry, ...base].slice(0, 60);
}

export function setTrapDeployed(id: string, deployed: boolean) {
  const cur = store.get();
  const traps = cur.traps.map((t) =>
    t.id === id ? { ...t, deployed, deployedAt: deployed ? new Date().toISOString() : null } : t,
  );
  const t = cur.traps.find((x) => x.id === id);
  const log = t ? pushLog(`${deployed ? "Deployed" : "Recalled"} trap — ${t.name}`, cur.log) : cur.log;
  store.set({ traps, log });
}

export function deployAllTraps() {
  const cur = store.get();
  const now = new Date().toISOString();
  const traps = cur.traps.map((t) => (t.deployed ? t : { ...t, deployed: true, deployedAt: now }));
  const count = cur.traps.filter((t) => !t.deployed).length;
  const log = count > 0 ? pushLog(`Deployed ${count} deception trap${count === 1 ? "" : "s"}`, cur.log) : cur.log;
  store.set({ traps, log });
}

export function recallAllTraps() {
  const cur = store.get();
  const count = cur.traps.filter((t) => t.deployed).length;
  const traps = cur.traps.map((t) => ({ ...t, deployed: false, deployedAt: null }));
  const log = count > 0 ? pushLog(`Recalled ${count} trap${count === 1 ? "" : "s"}`, cur.log) : cur.log;
  store.set({ traps, log });
}
