import type { Severity } from "./types";

export interface MitreInfo {
  description: string;
  plain: string;
  severity: Severity;
}

/* Static reference for the techniques surfaced in the simulated home.
   Keyed by ATT&CK technique ID. `plain` is the plain-English translation
   shown alongside the formal description. */
export const MITRE_INFO: Record<string, MitreInfo> = {
  T1595: {
    description:
      "Adversaries probe the target's exposed services and ports before an attack, mapping what is reachable and which versions are running.",
    plain: "Someone is rattling all your doors and windows to see which ones are open before trying to break in.",
    severity: "LOW",
  },
  T1592: {
    description:
      "Collection of details about the victim host — OS, hardware, installed software — to tailor follow-on attacks.",
    plain: "They're taking notes on exactly what kind of computer you have so they can pick the right tool to attack it.",
    severity: "LOW",
  },
  T1190: {
    description:
      "Exploiting a weakness in an internet-facing application to gain an initial foothold on the system.",
    plain: "They found a bug in a program you expose to the internet and used it to sneak inside.",
    severity: "HIGH",
  },
  T1133: {
    description:
      "Abusing legitimate remote-access services (VPN, SSH, RDP) to enter the environment from outside.",
    plain: "They logged in through a normal remote-access door — like SSH — instead of forcing one open.",
    severity: "HIGH",
  },
  T1059: {
    description:
      "Running attacker-supplied commands or scripts through a shell or interpreter (bash, sh, python) to execute actions.",
    plain: "Once inside, they typed commands into the machine to make it do what they want.",
    severity: "HIGH",
  },
  T1203: {
    description:
      "Exploiting a vulnerability in client software to run code when the victim opens a file or visits a resource.",
    plain: "They booby-trapped a file so that opening it quietly runs their code.",
    severity: "HIGH",
  },
  T1098: {
    description:
      "Modifying accounts — adding keys, changing passwords, altering permissions — to keep access over time.",
    plain: "They tampered with a user account so they can keep getting back in later.",
    severity: "MEDIUM",
  },
  T1543: {
    description:
      "Creating or modifying system-level services or daemons so malicious code restarts automatically and survives reboots.",
    plain: "They installed themselves as a background service so they come back every time the machine restarts.",
    severity: "HIGH",
  },
  T1053: {
    description:
      "Abusing task schedulers (cron, systemd timers, at) to run code at set times or on startup for persistence.",
    plain: "They set a timer/alarm on your system so their code runs again and again on a schedule.",
    severity: "MEDIUM",
  },
  T1068: {
    description:
      "Exploiting a flaw to gain higher privileges than the account they currently control, often reaching root.",
    plain: "They used a bug to upgrade themselves from a normal user to full administrator.",
    severity: "CRITICAL",
  },
  T1548: {
    description:
      "Bypassing or abusing privilege-control mechanisms (sudo, setuid) to execute commands with elevated rights.",
    plain: "They tricked the system's permission gate to run commands as the boss account.",
    severity: "HIGH",
  },
  T1070: {
    description:
      "Deleting or altering logs and artifacts to hide activity and frustrate investigation.",
    plain: "They wiped the security-camera footage so nobody can see what they did.",
    severity: "MEDIUM",
  },
  T1027: {
    description:
      "Encrypting, encoding, or packing files and commands to evade detection and analysis.",
    plain: "They scrambled their tools so antivirus and analysts can't easily read what they are.",
    severity: "MEDIUM",
  },
  T1110: {
    description:
      "Systematically guessing credentials — password spraying, dictionary, and brute-force attempts against logins.",
    plain: "They tried thousands of username and password guesses until one worked.",
    severity: "HIGH",
  },
  T1003: {
    description:
      "Stealing stored credentials from memory or files (e.g. /etc/shadow, process memory) to reuse elsewhere.",
    plain: "They grabbed the saved passwords off the machine to break into other things.",
    severity: "CRITICAL",
  },
  T1082: {
    description:
      "Querying the system for configuration, OS version, and hardware details to plan next steps.",
    plain: "They looked around the machine to learn how it's set up before doing more.",
    severity: "LOW",
  },
  T1018: {
    description:
      "Discovering other hosts on the network to identify additional targets for lateral movement.",
    plain: "They scanned your network to find the other computers they could jump to next.",
    severity: "LOW",
  },
  T1021: {
    description:
      "Using remote services (SSH, RDP, SMB) to move from one compromised host to another inside the network.",
    plain: "They used your internal connections to hop from this machine onto another one.",
    severity: "HIGH",
  },
  T1005: {
    description:
      "Collecting files and data stored on the local system that are of interest to the adversary.",
    plain: "They gathered up files saved on this computer that they want to take.",
    severity: "MEDIUM",
  },
  T1071: {
    description:
      "Communicating with attacker infrastructure over common protocols (HTTP/S, DNS) to blend with normal traffic.",
    plain: "They phoned home using ordinary web traffic so the chatter looks normal.",
    severity: "MEDIUM",
  },
  T1105: {
    description:
      "Downloading additional tools, payloads, or malware onto the compromised host from outside.",
    plain: "They pulled in more hacking tools from the internet onto your machine.",
    severity: "HIGH",
  },
  T1041: {
    description:
      "Stealing data out of the environment over the same channel used for command-and-control.",
    plain: "They smuggled your data out using the same hidden line they use to control the machine.",
    severity: "CRITICAL",
  },
  T1486: {
    description:
      "Encrypting data on the system to disrupt availability and demand ransom — classic ransomware behavior.",
    plain: "They locked up your files and would demand money to give them back (ransomware).",
    severity: "CRITICAL",
  },
  T1496: {
    description:
      "Hijacking system resources (CPU/GPU) for the adversary's benefit, typically cryptocurrency mining.",
    plain: "They secretly used your computer's power to mine cryptocurrency for themselves.",
    severity: "MEDIUM",
  },
};

export function mitreInfo(id: string): MitreInfo {
  return (
    MITRE_INFO[id] ?? {
      description: "No reference detail is available for this technique in the local catalog.",
      plain: "We don't have a plain-English note for this one yet.",
      severity: "INFO",
    }
  );
}
