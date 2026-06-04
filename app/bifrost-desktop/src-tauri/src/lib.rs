mod banner;

use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use sha2::{Digest, Sha256};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, State, WindowEvent,
};

/// Port the Python guardian listens on. The frontend polls
/// http://127.0.0.1:8766 and this value is handed back via `get_guardian_port`.
const GUARDIAN_PORT: u16 = 8766;
const EXPECTED_SECURITY_HASH: &str =
    "300df99fbcfcb65870aa5dd19630d3fb78d1bca56683abd527f8f16711288364";
const EXPECTED_REASONER_HASH: &str =
    "4e12f51188425c211974c835caf7387ced155f629801c95ef8fef75b3764c703";

/// Holds the spawned guardian process so it can be supervised and killed.
pub struct GuardianState {
    child: Mutex<Option<Child>>,
    session_only: Mutex<bool>,
}

impl Default for GuardianState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            session_only: Mutex::new(false),
        }
    }
}

/// Resolve the python interpreter. Override with the BIFROST_PYTHON env var.
fn python_bin() -> String {
    std::env::var("BIFROST_PYTHON").unwrap_or_else(|_| {
        if cfg!(windows) {
            "python".into()
        } else {
            "python3".into()
        }
    })
}

struct GuardianEntry {
    path: PathBuf,
    use_python: bool,
}

fn guardian_entry_from_path(path: PathBuf) -> Option<GuardianEntry> {
    if !path.exists() {
        return None;
    }
    let use_python = path.extension().and_then(|ext| ext.to_str()) == Some("py");
    Some(GuardianEntry { path, use_python })
}

/// Locate the guardian entry. Resolution order:
/// 1. BIFROST_GUARDIAN env var (absolute path to a script/binary)
/// 2. bundled resource:  <resources>/guardian/guardian (preferred) or guardian.py
/// 3. sibling of the executable:  <exe dir>/guardian/guardian (preferred) or guardian.py
fn guardian_entry(app: &tauri::AppHandle) -> Option<GuardianEntry> {
    if let Ok(p) = std::env::var("BIFROST_GUARDIAN") {
        let pb = PathBuf::from(p);
        if let Some(entry) = guardian_entry_from_path(pb) {
            return Some(entry);
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        let binary = res.join("guardian").join("guardian");
        if let Some(entry) = guardian_entry_from_path(binary) {
            return Some(entry);
        }
        let script = res.join("guardian").join("guardian.py");
        if let Some(entry) = guardian_entry_from_path(script) {
            return Some(entry);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let binary = dir.join("guardian").join("guardian");
            if let Some(entry) = guardian_entry_from_path(binary) {
                return Some(entry);
            }
            let script = dir.join("guardian").join("guardian.py");
            if let Some(entry) = guardian_entry_from_path(script) {
                return Some(entry);
            }
        }
    }
    None
}

fn resolve_core_paths(script: &Path) -> Option<(PathBuf, PathBuf)> {
    let base = script.parent()?;
    let security = base.join("security.py");
    let reasoner = base.join("reasoner.py");
    if security.exists() && reasoner.exists() {
        return Some((security, reasoner));
    }
    let security = base.join("bifrost").join("security.py");
    let reasoner = base.join("bifrost").join("reasoner.py");
    if security.exists() && reasoner.exists() {
        return Some((security, reasoner));
    }
    None
}

fn verify_core_integrity(path: &Path, expected: &str) -> bool {
    match fs::read(path) {
        Ok(bytes) => {
            let hash = format!("{:x}", Sha256::digest(&bytes));
            hash == expected
        }
        Err(_) => false,
    }
}

fn guardian_is_reachable() -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], GUARDIAN_PORT));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(250)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(250)));
    if stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut buf = [0_u8; 128];
    match stream.read(&mut buf) {
        Ok(read) if read > 0 => String::from_utf8_lossy(&buf[..read]).contains("200"),
        Ok(_) => false,
        Err(_) => false,
    }
}

fn should_stop_on_exit(state: &GuardianState) -> bool {
    *state.session_only.lock().unwrap()
}

/// Start the guardian if it is not already running. Returns true when a live
/// process exists after the call.
fn do_start(app: &tauri::AppHandle, state: &GuardianState) -> bool {
    let mut guard = state.child.lock().unwrap();

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => return true, // already running
            _ => *guard = None,      // exited / errored — clear and respawn
        }
    }

    if guardian_is_reachable() {
        return true;
    }

    let entry = match guardian_entry(app) {
        Some(entry) => entry,
        None => {
            eprintln!("[bifrost] guardian entry not found (set BIFROST_GUARDIAN)");
            return false;
        }
    };

    let mut command = if entry.use_python {
        let mut cmd = Command::new(python_bin());
        cmd.arg(&entry.path);
        cmd
    } else {
        Command::new(&entry.path)
    };
    match command
        .arg("--port")
        .arg(GUARDIAN_PORT.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(child) => {
            *guard = Some(child);
            true
        }
        Err(e) => {
            eprintln!("[bifrost] failed to start guardian: {e}");
            false
        }
    }
}

/// Kill the guardian if running. Returns true if a process was terminated.
fn do_stop(state: &GuardianState) -> bool {
    let mut guard = state.child.lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        true
    } else {
        false
    }
}

#[tauri::command]
fn start_guardian(app: tauri::AppHandle, state: State<GuardianState>) -> bool {
    do_start(&app, &state)
}

#[tauri::command]
fn stop_guardian(state: State<GuardianState>) -> bool {
    do_stop(&state)
}

#[tauri::command]
fn guardian_status(state: State<GuardianState>) -> bool {
    let mut guard = state.child.lock().unwrap();
    match guard.as_mut() {
        Some(child) => matches!(child.try_wait(), Ok(None)),
        None => false,
    }
}

#[tauri::command]
fn get_guardian_port() -> u16 {
    GUARDIAN_PORT
}

#[tauri::command]
fn set_guardian_session_only(session_only: bool, state: State<GuardianState>) -> bool {
    *state.session_only.lock().unwrap() = session_only;
    true
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    banner::print_startup_banner();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .manage(GuardianState::default())
        .invoke_handler(tauri::generate_handler![
            start_guardian,
            stop_guardian,
            guardian_status,
            get_guardian_port,
            set_guardian_session_only
        ])
        .setup(|app| {
            let entry = match guardian_entry(app.handle()) {
                Some(entry) => entry,
                None => {
                    eprintln!("[bifrost] guardian entry not found (set BIFROST_GUARDIAN)");
                    std::process::exit(1);
                }
            };
            let (security_path, reasoner_path) = match resolve_core_paths(&entry.path) {
                Some(paths) => paths,
                None => {
                    eprintln!("Fatal: Core initialization error (0x99)");
                    std::process::exit(1);
                }
            };
            if !verify_core_integrity(&security_path, EXPECTED_SECURITY_HASH)
                || !verify_core_integrity(&reasoner_path, EXPECTED_REASONER_HASH)
            {
                eprintln!("Fatal: Core initialization error (0x99)");
                std::process::exit(1);
            }
            // Launch the guardian as soon as the app boots.
            let handle = app.handle().clone();
            let state = app.state::<GuardianState>();
            do_start(&handle, &state);

            // System tray with show / quit.
            let show = MenuItem::with_id(app, "show", "Open Bifrost", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Bifrost", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Bifrost — Heimdall Never Sleeps.")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        let state = app.state::<GuardianState>();
                        if should_stop_on_exit(&state) {
                            do_stop(&state);
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<GuardianState>();
                if should_stop_on_exit(&state) {
                    do_stop(&state);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running the Bifrost application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                let state = app.state::<GuardianState>();
                if should_stop_on_exit(&state) {
                    do_stop(&state);
                }
            }
        });
}
