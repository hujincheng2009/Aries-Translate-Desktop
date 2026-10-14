// Windows implementation of the selection assistant:
// - a low-level mouse hook on its own thread (the callback only queues events and returns),
// - a worker thread that owns all state: gesture recognition, probing the selection, placing and hiding the bar,
// - a probe thread that reads the selection through UI Automation with a timeout.
// The floating bar is a normal Tauri window ("selection_bar") that never activates: it has WS_EX_NOACTIVATE,
// is only moved with SWP_NOACTIVATE, and clicks on it are swallowed by the hook and replayed to the page as events,
// so the program the user selected text in keeps focus and its selection.

use super::decide::{decide, filtered_out, is_terminal_class, Context, Decision, Probe};
use super::gesture::{Gesture, GestureRecognizer, Point, Thresholds};
use super::placement::{auto_hide_after, initial_position, resized_position, Rect};
use super::{RunningApp, Settings};
use crate::clipboard::{ClipboardMonitorSuppressWrapper, ClipboardMonitorSuppression};
use crate::clipboard_backup::{backup_clipboard, restore_clipboard_with_retry};
use crate::APP;
use log::{info, warn};
use once_cell::sync::Lazy;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;
use windows::core::{Interface, PWSTR};
use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::{
    AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
    PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomation2, IUIAutomationTextPattern, SetWinEventHook,
    UIA_TextPatternId, UnhookWinEvent, HWINEVENTHOOK,
};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, GetDoubleClickTime, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, CallNextHookEx, DispatchMessageW, EnumWindows, GetAncestor, GetClassNameW,
    GetCursorInfo, GetForegroundWindow, GetMessageW, GetSystemMetrics, GetWindowLongPtrW,
    GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible, LoadCursorW, PeekMessageW,
    PostThreadMessageW, SetForegroundWindow, SetWindowLongPtrW, SetWindowPos, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, WindowFromPoint, CURSORINFO, EVENT_SYSTEM_FOREGROUND,
    GA_ROOT, GWL_EXSTYLE, HHOOK, HWND_TOPMOST, IDC_IBEAM, MSG, MSLLHOOKSTRUCT, PM_NOREMOVE,
    SM_CXDOUBLECLK, SM_CXDRAG, SM_CYDOUBLECLK, SM_CYDRAG, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE,
    SWP_NOSIZE, SWP_NOZORDER, WH_MOUSE_LL, WINEVENT_OUTOFCONTEXT, WM_LBUTTONDOWN, WM_LBUTTONUP,
    WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MOUSEHWHEEL, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_QUIT,
    WM_RBUTTONDOWN, WM_RBUTTONUP, WM_XBUTTONDOWN, WM_XBUTTONUP, WS_EX_APPWINDOW, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
};

const BAR_LABEL: &str = "selection_bar";
// Where the bar waits while hidden. It stays "visible" for the WebView, which keeps rendering ready.
const OFFSCREEN: i32 = -32000;
const PROBE_DELAY: Duration = Duration::from_millis(40);
// Browsers and Electron apps update the accessible selection a little after the mouse is released.
const PROBE_RETRY_DELAY: Duration = Duration::from_millis(60);
const PROBE_RETRIES: usize = 2;
const PROBE_TIMEOUT: Duration = Duration::from_millis(350);
// The page fades the popup out during this time before the window leaves the screen.
const FADE_OUT: Duration = Duration::from_millis(140);
const COPIED_DELAY: Duration = Duration::from_millis(600);
const ERROR_DELAY: Duration = Duration::from_millis(2000);
const POINTER_INTERVAL: Duration = Duration::from_millis(16);
const MAX_SELECTION_CHARS: i32 = 20000;

pub enum Event {
    LeftDown {
        point: Point,
        time: u32,
    },
    LeftUp {
        point: Point,
        time: u32,
        shift: bool,
    },
    // Another button pressed or the wheel turned while the bar is visible but outside it.
    Dismiss,
    Move {
        point: Point,
    },
    BarClick {
        point: Point,
    },
    Foreground {
        hwnd: isize,
    },
    SetSize {
        seq: u64,
        size: (f64, f64),
        hit: (f64, f64, f64, f64),
        expanded: bool,
    },
    Action {
        seq: u64,
        action: String,
    },
    ActionDone {
        seq: u64,
        action: String,
        outcome: Result<Outcome, String>,
    },
    HideRequest {
        seq: u64,
    },
    Settings(Settings),
    Stop,
}

pub enum Outcome {
    // The work is done somewhere else (a window opened, the replacement started): hide right away.
    Done,
    Copied,
}

// ---- shared with the hook callback (must stay lock-free and cheap) ----

static SENDER: Lazy<Mutex<Option<Sender<Event>>>> = Lazy::new(|| Mutex::new(None));
static BAR_VISIBLE: AtomicBool = AtomicBool::new(false);
static HIT: [AtomicI32; 4] = [
    AtomicI32::new(0),
    AtomicI32::new(0),
    AtomicI32::new(0),
    AtomicI32::new(0),
];
static SWALLOW_LEFT_UP: AtomicBool = AtomicBool::new(false);
static SWALLOW_OTHER_UP: AtomicBool = AtomicBool::new(false);
static LEFT_DOWNS: AtomicU64 = AtomicU64::new(0);
static HOOK_THREAD: AtomicU32 = AtomicU32::new(0);

static SETTINGS: Lazy<Mutex<Settings>> = Lazy::new(|| Mutex::new(Settings::default()));
static RUNNING: AtomicBool = AtomicBool::new(false);

pub fn current_settings() -> Settings {
    SETTINGS.lock().unwrap().clone()
}

pub fn send(event: Event) {
    if let Some(sender) = SENDER.lock().unwrap().as_ref() {
        let _ = sender.send(event);
    }
}

fn hit_rect() -> Rect {
    Rect {
        left: HIT[0].load(Ordering::Relaxed),
        top: HIT[1].load(Ordering::Relaxed),
        right: HIT[2].load(Ordering::Relaxed),
        bottom: HIT[3].load(Ordering::Relaxed),
    }
}

fn set_hit_rect(rect: Rect) {
    HIT[0].store(rect.left, Ordering::Relaxed);
    HIT[1].store(rect.top, Ordering::Relaxed);
    HIT[2].store(rect.right, Ordering::Relaxed);
    HIT[3].store(rect.bottom, Ordering::Relaxed);
}

// Starts, updates or stops the assistant to match `settings`.
pub fn apply(settings: Settings) {
    let enable = settings.enable;
    *SETTINGS.lock().unwrap() = settings.clone();
    if enable && !RUNNING.load(Ordering::SeqCst) {
        start();
    } else if !enable && RUNNING.load(Ordering::SeqCst) {
        stop();
    }
    send(Event::Settings(settings));
}

fn start() {
    if ensure_bar_window().is_none() {
        warn!("Selection assistant: could not create the floating window");
        return;
    }
    RUNNING.store(true, Ordering::SeqCst);
    let (sender, receiver) = channel();
    *SENDER.lock().unwrap() = Some(sender);
    std::thread::Builder::new()
        .name("selection-worker".into())
        .spawn(move || Worker::new(receiver).run())
        .ok();
    std::thread::Builder::new()
        .name("selection-hook".into())
        .spawn(hook_thread)
        .ok();
    info!("Selection assistant started");
}

fn stop() {
    RUNNING.store(false, Ordering::SeqCst);
    let thread = HOOK_THREAD.swap(0, Ordering::SeqCst);
    if thread != 0 {
        unsafe {
            let _ = PostThreadMessageW(thread, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
    send(Event::Stop);
    *SENDER.lock().unwrap() = None;
    info!("Selection assistant stopped");
}

// ---- hook thread ----

unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        let point = Point {
            x: info.pt.x,
            y: info.pt.y,
        };
        let visible = BAR_VISIBLE.load(Ordering::Relaxed);
        let in_bar = visible && hit_rect().contains(point.x, point.y);
        match wparam.0 as u32 {
            WM_LBUTTONDOWN => {
                if in_bar {
                    SWALLOW_LEFT_UP.store(true, Ordering::Relaxed);
                    send(Event::BarClick { point });
                    return LRESULT(1);
                }
                LEFT_DOWNS.fetch_add(1, Ordering::Relaxed);
                send(Event::LeftDown {
                    point,
                    time: info.time,
                });
            }
            WM_LBUTTONUP => {
                if SWALLOW_LEFT_UP.swap(false, Ordering::Relaxed) {
                    return LRESULT(1);
                }
                let shift = GetAsyncKeyState(VK_SHIFT.0 as i32) < 0;
                send(Event::LeftUp {
                    point,
                    time: info.time,
                    shift,
                });
            }
            WM_RBUTTONDOWN | WM_MBUTTONDOWN | WM_XBUTTONDOWN => {
                if in_bar {
                    SWALLOW_OTHER_UP.store(true, Ordering::Relaxed);
                    return LRESULT(1);
                }
                if visible {
                    send(Event::Dismiss);
                }
            }
            WM_RBUTTONUP | WM_MBUTTONUP | WM_XBUTTONUP => {
                if SWALLOW_OTHER_UP.swap(false, Ordering::Relaxed) {
                    return LRESULT(1);
                }
            }
            WM_MOUSEWHEEL | WM_MOUSEHWHEEL => {
                if visible && !in_bar {
                    send(Event::Dismiss);
                }
            }
            WM_MOUSEMOVE => {
                if visible {
                    send(Event::Move { point });
                }
            }
            _ => {}
        }
    }
    CallNextHookEx(HHOOK::default(), code, wparam, lparam)
}

unsafe extern "system" fn foreground_proc(
    _hook: HWINEVENTHOOK,
    _event: u32,
    hwnd: HWND,
    _object: i32,
    _child: i32,
    _thread: u32,
    _time: u32,
) {
    send(Event::Foreground {
        hwnd: hwnd.0 as isize,
    });
}

fn hook_thread() {
    unsafe {
        HOOK_THREAD.store(GetCurrentThreadId(), Ordering::SeqCst);
        let module = GetModuleHandleW(None).unwrap_or_default();
        let hook = match SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), module, 0) {
            Ok(hook) => hook,
            Err(error) => {
                warn!("Selection assistant: mouse hook failed: {}", error);
                return;
            }
        };
        let foreground = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            None,
            Some(foreground_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT,
        );
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        let _ = UnhookWinEvent(foreground);
        let _ = UnhookWindowsHookEx(hook);
    }
}

// ---- probe thread (UI Automation) ----

struct ProbeClient {
    requests: Sender<u64>,
    results: Receiver<(u64, Probe)>,
}

impl ProbeClient {
    fn new() -> Self {
        let (requests, request_rx) = channel::<u64>();
        let (result_tx, results) = channel();
        std::thread::Builder::new()
            .name("selection-probe".into())
            .spawn(move || probe_thread(request_rx, result_tx))
            .ok();
        Self { requests, results }
    }

    fn probe(&self, id: u64) -> Probe {
        while self.results.try_recv().is_ok() {}
        if self.requests.send(id).is_err() {
            return Probe::Unsupported;
        }
        let deadline = Instant::now() + PROBE_TIMEOUT;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            match self.results.recv_timeout(left) {
                Ok((result_id, probe)) if result_id == id => return probe,
                Ok(_) => continue,
                Err(_) => return Probe::Unsupported,
            }
        }
    }
}

fn probe_thread(requests: Receiver<u64>, results: Sender<(u64, Probe)>) {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    let automation: Option<IUIAutomation> =
        unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok() };
    if let Some(automation) = &automation {
        if let Ok(automation2) = automation.cast::<IUIAutomation2>() {
            unsafe {
                let _ = automation2.SetConnectionTimeout(300);
                let _ = automation2.SetTransactionTimeout(300);
            }
        }
    }
    while let Ok(id) = requests.recv() {
        let probe = match &automation {
            Some(automation) => read_selection(automation),
            None => Probe::Unsupported,
        };
        if results.send((id, probe)).is_err() {
            break;
        }
    }
}

fn read_selection(automation: &IUIAutomation) -> Probe {
    unsafe {
        let Ok(element) = automation.GetFocusedElement() else {
            return Probe::Unsupported;
        };
        if element
            .CurrentIsPassword()
            .map(|b| b.as_bool())
            .unwrap_or(false)
        {
            return Probe::Password;
        }
        let Ok(pattern) =
            element.GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId)
        else {
            return Probe::Unsupported;
        };
        let Ok(ranges) = pattern.GetSelection() else {
            return Probe::Unsupported;
        };
        let length = ranges.Length().unwrap_or(0);
        let mut text = String::new();
        for i in 0..length {
            if let Ok(range) = ranges.GetElement(i) {
                if let Ok(part) = range.GetText(MAX_SELECTION_CHARS) {
                    text.push_str(&part.to_string());
                }
            }
        }
        if text.trim().is_empty() {
            Probe::Empty
        } else {
            Probe::Text(text.trim().to_string())
        }
    }
}

// ---- helpers ----

fn root_window_at(point: Point) -> HWND {
    unsafe {
        let hwnd = WindowFromPoint(POINT {
            x: point.x,
            y: point.y,
        });
        let root = GetAncestor(hwnd, GA_ROOT);
        if root.0.is_null() {
            hwnd
        } else {
            root
        }
    }
}

fn window_pid(hwnd: HWND) -> u32 {
    let mut pid = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
    }
    pid
}

fn window_class(hwnd: HWND) -> String {
    let mut buffer = [0u16; 256];
    let length = unsafe { GetClassNameW(hwnd, &mut buffer) }.max(0) as usize;
    String::from_utf16_lossy(&buffer[..length])
}

fn process_exe(pid: u32) -> String {
    unsafe {
        let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return String::new();
        };
        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut size,
        )
        .is_ok();
        let _ = CloseHandle(handle);
        if !ok {
            return String::new();
        }
        let path = String::from_utf16_lossy(&buffer[..size as usize]);
        path.rsplit(['\\', '/']).next().unwrap_or("").to_string()
    }
}

fn cursor_is_ibeam() -> bool {
    unsafe {
        let mut info = CURSORINFO {
            cbSize: std::mem::size_of::<CURSORINFO>() as u32,
            ..Default::default()
        };
        if GetCursorInfo(&mut info).is_err() {
            return false;
        }
        match LoadCursorW(None, IDC_IBEAM) {
            Ok(ibeam) => info.hCursor == ibeam,
            Err(_) => false,
        }
    }
}

// Work area and scale factor of the monitor that contains `point`.
fn monitor_at(point: Point) -> (Rect, f64) {
    unsafe {
        let monitor = MonitorFromPoint(
            POINT {
                x: point.x,
                y: point.y,
            },
            MONITOR_DEFAULTTONEAREST,
        );
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let _ = GetMonitorInfoW(monitor, &mut info);
        let work: RECT = info.rcWork;
        let (mut dpi_x, mut dpi_y) = (96u32, 96u32);
        let _ = GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y);
        (
            Rect {
                left: work.left,
                top: work.top,
                right: work.right,
                bottom: work.bottom,
            },
            dpi_x.max(96) as f64 / 96.0,
        )
    }
}

fn thresholds() -> Thresholds {
    unsafe {
        Thresholds {
            drag_x: GetSystemMetrics(SM_CXDRAG).max(2),
            drag_y: GetSystemMetrics(SM_CYDRAG).max(2),
            double_click_ms: GetDoubleClickTime(),
            double_click_x: GetSystemMetrics(SM_CXDOUBLECLK).max(4),
            double_click_y: GetSystemMetrics(SM_CYDOUBLECLK).max(4),
        }
    }
}

fn bar_window() -> Option<tauri::Window> {
    APP.get()?.get_window(BAR_LABEL)
}

fn bar_hwnd() -> Option<HWND> {
    let window = bar_window()?;
    let hwnd = window.hwnd().ok()?;
    Some(HWND(hwnd.0 as *mut core::ffi::c_void))
}

fn ensure_bar_window() -> Option<tauri::Window> {
    if let Some(window) = bar_window() {
        return Some(window);
    }
    let app = APP.get()?;
    let window =
        tauri::WindowBuilder::new(app, BAR_LABEL, tauri::WindowUrl::App("index.html".into()))
            .title("Aries")
            .additional_browser_args("--disable-web-security")
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .focused(false)
            .visible(true)
            .position(OFFSCREEN as f64, OFFSCREEN as f64)
            .inner_size(480.0, 160.0)
            .build()
            .map_err(|error| warn!("Selection assistant: {}", error))
            .ok()?;
    if let Ok(hwnd) = window.hwnd() {
        let hwnd = HWND(hwnd.0 as *mut core::ffi::c_void);
        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let style = (style
                | (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0 | WS_EX_TOPMOST.0) as isize)
                & !(WS_EX_APPWINDOW.0 as isize);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
        }
    }
    Some(window)
}

fn emit<S: Serialize + Clone>(event: &str, payload: S) {
    if let Some(window) = bar_window() {
        let _ = window.emit(event, payload);
    }
}

// Lets a window of ours take the foreground although the user's click went to the (swallowed) toolbar.
fn bring_to_front(label: &str) {
    let Some(app) = APP.get() else { return };
    for _ in 0..40 {
        if let Some(window) = app.get_window(label) {
            if window.is_visible().unwrap_or(false) {
                if let Ok(hwnd) = window.hwnd() {
                    let hwnd = HWND(hwnd.0 as *mut core::ffi::c_void);
                    unsafe {
                        let foreground = GetForegroundWindow();
                        if foreground == hwnd {
                            return;
                        }
                        // AttachThreadInput needs this thread to have a message queue.
                        let mut msg = MSG::default();
                        let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
                        let foreground_thread = GetWindowThreadProcessId(foreground, None);
                        let current = GetCurrentThreadId();
                        let attached = foreground_thread != 0
                            && foreground_thread != current
                            && AttachThreadInput(current, foreground_thread, true).as_bool();
                        let _ = BringWindowToTop(hwnd);
                        let _ = SetForegroundWindow(hwnd);
                        if attached {
                            let _ = AttachThreadInput(current, foreground_thread, false);
                        }
                        if GetForegroundWindow() != hwnd {
                            // Last resort: Windows lets a process take the foreground while Alt is held.
                            use enigo::{
                                Direction::Press, Direction::Release, Enigo, Key, Keyboard,
                            };
                            if let Ok(mut enigo) = Enigo::new(&enigo::Settings::default()) {
                                let _ = enigo.key(Key::Alt, Press);
                                let _ = SetForegroundWindow(hwnd);
                                let _ = enigo.key(Key::Alt, Release);
                            }
                        }
                    }
                }
                return;
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn modifiers_down() -> bool {
    unsafe {
        [VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN]
            .iter()
            .any(|key| GetAsyncKeyState(key.0 as i32) < 0)
    }
}

fn send_copy_shortcut() -> Result<(), String> {
    use enigo::{
        Direction::{Click, Press, Release},
        Enigo, Key, Keyboard, Settings,
    };
    let deadline = Instant::now() + Duration::from_millis(300);
    while modifiers_down() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(15));
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Press).map_err(|e| e.to_string())?;
    let result = enigo.key(Key::C, Click).map_err(|e| e.to_string());
    let release = enigo.key(Key::Control, Release).map_err(|e| e.to_string());
    result?;
    release
}

fn wait_for_clipboard_change(before: u32) -> bool {
    let deadline = Instant::now() + Duration::from_millis(400);
    while Instant::now() < deadline {
        if unsafe { GetClipboardSequenceNumber() } != before {
            // Give the source program a moment to finish writing all formats.
            std::thread::sleep(Duration::from_millis(20));
            return true;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    false
}

// Reads the selection of the foreground program by simulating Ctrl+C, then puts the user's clipboard back.
fn copy_selection_via_clipboard() -> Result<String, String> {
    let app = APP.get().ok_or("app not ready")?;
    let suppress_state = app.state::<ClipboardMonitorSuppressWrapper>();
    let _suppression = ClipboardMonitorSuppression::new(&suppress_state);
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let backup = backup_clipboard(&mut clipboard);
    let before = unsafe { GetClipboardSequenceNumber() };
    send_copy_shortcut()?;
    if !wait_for_clipboard_change(before) {
        return Err("no_text".into());
    }
    let text = clipboard.get_text().unwrap_or_default();
    if let Err(error) = restore_clipboard_with_retry(&mut clipboard, &backup) {
        warn!(
            "Selection assistant: could not restore the clipboard: {}",
            error
        );
    }
    let text = text.trim().to_string();
    if text.is_empty() {
        Err("no_text".into())
    } else {
        Ok(text)
    }
}

// Runs one toolbar action on its own thread and reports back to the worker.
fn run_action(seq: u64, action: String, text: Option<String>, foreground: isize) {
    std::thread::spawn(move || {
        let outcome = (|| -> Result<Outcome, String> {
            let still_there = unsafe { GetForegroundWindow().0 as isize } == foreground;
            if action == "copy" {
                return match text {
                    Some(text) => {
                        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
                        clipboard.set_text(text).map_err(|e| e.to_string())?;
                        Ok(Outcome::Copied)
                    }
                    None if still_there => {
                        let before = unsafe { GetClipboardSequenceNumber() };
                        send_copy_shortcut()?;
                        if wait_for_clipboard_change(before) {
                            Ok(Outcome::Copied)
                        } else {
                            Err("no_text".into())
                        }
                    }
                    None => Err("window_changed".into()),
                };
            }
            let text = match text {
                Some(text) => text,
                None if still_there => copy_selection_via_clipboard()?,
                None => return Err("window_changed".into()),
            };
            match action.as_str() {
                "translate" => {
                    crate::window::text_translate(text);
                    bring_to_front("translate");
                }
                "replace_translate" => {
                    if !still_there {
                        return Err("window_changed".into());
                    }
                    crate::replace_translation::request_replace_translation_with_text(text);
                }
                "read_aloud" => {
                    crate::read_aloud::request_read_aloud_with_text(text);
                    bring_to_front("read_aloud");
                }
                _ => return Err("unknown_action".into()),
            }
            Ok(Outcome::Done)
        })();
        send(Event::ActionDone {
            seq,
            action,
            outcome,
        });
    });
}

pub fn running_apps() -> Vec<RunningApp> {
    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let apps = &mut *(lparam.0 as *mut Vec<(u32, String)>);
        if !IsWindowVisible(hwnd).as_bool() {
            return true.into();
        }
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        if style & WS_EX_TOOLWINDOW.0 as isize != 0 {
            return true.into();
        }
        let mut buffer = [0u16; 256];
        let length = GetWindowTextW(hwnd, &mut buffer).max(0) as usize;
        if length == 0 {
            return true.into();
        }
        apps.push((
            window_pid(hwnd),
            String::from_utf16_lossy(&buffer[..length]),
        ));
        true.into()
    }
    let mut windows: Vec<(u32, String)> = vec![];
    unsafe {
        let _ = EnumWindows(Some(collect), LPARAM(&mut windows as *mut _ as isize));
    }
    let own = std::process::id();
    let mut result: Vec<RunningApp> = vec![];
    for (pid, title) in windows {
        if pid == own {
            continue;
        }
        let exe = process_exe(pid);
        if exe.is_empty()
            || exe.eq_ignore_ascii_case("explorer.exe")
            || result.iter().any(|app| app.exe.eq_ignore_ascii_case(&exe))
        {
            continue;
        }
        result.push(RunningApp { exe, title });
    }
    result.sort_by(|a, b| a.exe.to_lowercase().cmp(&b.exe.to_lowercase()));
    result
}

// ---- worker ----

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShowPayload {
    seq: u64,
    text_known: bool,
    settings: Settings,
}

#[derive(Clone, Serialize)]
struct PointerPayload {
    seq: u64,
    x: f64,
    y: f64,
    inside: bool,
}

#[derive(Clone, Serialize)]
struct StatePayload {
    seq: u64,
    action: String,
    status: &'static str,
    message: String,
}

struct Session {
    seq: u64,
    text: Option<String>,
    foreground: isize,
    anchor: Point,
    work: Rect,
    scale: f64,
    // Content (hit) rectangle and window position once placed.
    content: Option<Rect>,
    window_origin: (i32, i32),
    expanded: bool,
    inside: bool,
    busy: bool,
    deadline: Option<Instant>,
    last_pointer: Instant,
}

struct Worker {
    receiver: Receiver<Event>,
    settings: Settings,
    recognizer: GestureRecognizer,
    thresholds: Thresholds,
    down_ibeam: bool,
    probe: ProbeClient,
    seq: u64,
    session: Option<Session>,
    // When the faded-out popup is moved off screen.
    park_at: Option<Instant>,
}

impl Worker {
    fn new(receiver: Receiver<Event>) -> Self {
        Self {
            receiver,
            settings: current_settings(),
            recognizer: GestureRecognizer::default(),
            thresholds: thresholds(),
            down_ibeam: false,
            probe: ProbeClient::new(),
            seq: 0,
            session: None,
            park_at: None,
        }
    }

    fn run(mut self) {
        loop {
            let next = [self.session.as_ref().and_then(|s| s.deadline), self.park_at]
                .into_iter()
                .flatten()
                .min();
            let timeout = next
                .map(|d| d.saturating_duration_since(Instant::now()))
                .unwrap_or(Duration::from_secs(3600));
            match self.receiver.recv_timeout(timeout) {
                Ok(Event::Stop) => break,
                Ok(event) => self.handle(event),
                Err(RecvTimeoutError::Timeout) => {
                    if self.park_at.is_some_and(|d| d <= Instant::now()) {
                        self.park();
                    }
                    if self
                        .session
                        .as_ref()
                        .and_then(|s| s.deadline)
                        .is_some_and(|d| d <= Instant::now())
                    {
                        self.hide();
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
        self.hide();
        self.park();
    }

    fn handle(&mut self, event: Event) {
        match event {
            Event::Settings(settings) => {
                self.settings = settings;
                self.thresholds = thresholds();
            }
            Event::LeftDown { point, time } => {
                self.down_ibeam = cursor_is_ibeam();
                // Any press outside the toolbar (presses on it never get here) ends the current popup.
                self.hide();
                self.recognizer.on_left_down(point, time);
            }
            Event::LeftUp { point, time, shift } => {
                if let Some(gesture) =
                    self.recognizer
                        .on_left_up(point, time, shift, &self.thresholds)
                {
                    let up_ibeam = cursor_is_ibeam();
                    self.on_gesture(gesture, point, up_ibeam);
                }
            }
            Event::Dismiss => self.hide(),
            Event::Foreground { hwnd } => {
                let leave = self
                    .session
                    .as_ref()
                    .is_some_and(|s| s.content.is_some() && s.foreground != hwnd && !s.busy);
                if leave {
                    self.hide();
                }
            }
            Event::Move { point } => self.on_move(point),
            Event::BarClick { point } => {
                self.recognizer.reset();
                if let Some(session) = self.session.as_mut() {
                    session.inside = true;
                    session.deadline = None;
                    let (x, y) = to_client(session, point);
                    emit(
                        "selection_bar_click",
                        PointerPayload {
                            seq: session.seq,
                            x,
                            y,
                            inside: true,
                        },
                    );
                }
            }
            Event::SetSize {
                seq,
                size,
                hit,
                expanded,
            } => self.on_set_size(seq, size, hit, expanded),
            Event::Action { seq, action } => {
                let Some(session) = self.session.as_mut().filter(|s| s.seq == seq) else {
                    return;
                };
                if session.busy || !self.settings.actions.contains(&action) {
                    return;
                }
                session.busy = true;
                session.deadline = None;
                emit(
                    "selection_bar_state",
                    StatePayload {
                        seq,
                        action: action.clone(),
                        status: "busy",
                        message: String::new(),
                    },
                );
                run_action(seq, action, session.text.clone(), session.foreground);
            }
            Event::ActionDone {
                seq,
                action,
                outcome,
            } => {
                let Some(session) = self.session.as_mut().filter(|s| s.seq == seq) else {
                    return;
                };
                session.busy = false;
                match outcome {
                    Ok(Outcome::Done) => self.hide(),
                    Ok(Outcome::Copied) => {
                        session.deadline = Some(Instant::now() + COPIED_DELAY);
                        emit(
                            "selection_bar_state",
                            StatePayload {
                                seq,
                                action,
                                status: "copied",
                                message: String::new(),
                            },
                        );
                    }
                    Err(message) => {
                        warn!("Selection assistant action {} failed: {}", action, message);
                        session.deadline = Some(Instant::now() + ERROR_DELAY);
                        emit(
                            "selection_bar_state",
                            StatePayload {
                                seq,
                                action,
                                status: "error",
                                message,
                            },
                        );
                    }
                }
            }
            Event::HideRequest { seq } => {
                if self.session.as_ref().is_some_and(|s| s.seq == seq) {
                    self.hide();
                }
            }
            Event::Stop => {}
        }
    }

    fn on_gesture(&mut self, gesture: Gesture, point: Point, up_ibeam: bool) {
        let downs = LEFT_DOWNS.load(Ordering::Relaxed);
        let root = root_window_at(point);
        let pid = window_pid(root);
        let mut context = Context {
            fullscreen: false,
            disable_in_fullscreen: self.settings.disable_in_fullscreen,
            exe: process_exe(pid),
            blacklist: self.settings.blacklist.clone(),
            own_window: pid == std::process::id(),
            terminal: is_terminal_class(&window_class(root)),
            compat_mode: self.settings.compat_mode,
            // A backward drag usually starts in the blank space after a line (arrow cursor) and ends over text.
            ibeam: self.down_ibeam || up_ibeam,
        };
        if context.disable_in_fullscreen {
            context.fullscreen = crate::fullscreen::foreground_is_fullscreen();
        }
        if filtered_out(&context) {
            return;
        }
        std::thread::sleep(PROBE_DELAY);
        let mut probe = self.probe.probe(downs);
        for _ in 0..PROBE_RETRIES {
            if probe != Probe::Empty || LEFT_DOWNS.load(Ordering::Relaxed) != downs {
                break;
            }
            std::thread::sleep(PROBE_RETRY_DELAY);
            probe = self.probe.probe(downs);
        }
        let probe_kind = match &probe {
            Probe::Text(_) => "text",
            Probe::Empty => "empty",
            Probe::Unsupported => "unreadable",
            Probe::Password => "password",
        };
        // A new press while we were probing starts a new gesture; this one is stale.
        if LEFT_DOWNS.load(Ordering::Relaxed) != downs {
            return;
        }
        let decision = decide(probe, &context);
        info!(
            "Selection assistant: {:?} in {} (selection {}, text cursor {}/{}) -> {}",
            gesture,
            context.exe,
            probe_kind,
            self.down_ibeam,
            up_ibeam,
            match &decision {
                Decision::Ignore => "ignore".to_string(),
                Decision::Show(Some(text)) => format!("show ({} chars)", text.chars().count()),
                Decision::Show(None) => "show (text unknown)".to_string(),
            }
        );
        let Decision::Show(text) = decision else {
            return;
        };
        self.hide();
        self.seq += 1;
        let (work, scale) = monitor_at(point);
        self.session = Some(Session {
            seq: self.seq,
            text: text.clone(),
            foreground: unsafe { GetForegroundWindow().0 as isize },
            anchor: point,
            work,
            scale,
            content: None,
            window_origin: (OFFSCREEN, OFFSCREEN),
            expanded: self.settings.display_mode == "toolbar",
            inside: false,
            busy: false,
            deadline: None,
            last_pointer: Instant::now(),
        });
        emit(
            "selection_bar_show",
            ShowPayload {
                seq: self.seq,
                text_known: text.is_some(),
                settings: self.settings.clone(),
            },
        );
    }

    fn on_set_size(
        &mut self,
        seq: u64,
        size: (f64, f64),
        hit: (f64, f64, f64, f64),
        expanded: bool,
    ) {
        let hide_after = auto_hide_after(self.settings.hide_delay_secs);
        let offset = (self.settings.offset_x, self.settings.offset_y);
        let Some(session) = self.session.as_mut().filter(|s| s.seq == seq) else {
            return;
        };
        let Some(hwnd) = bar_hwnd() else { return };
        let s = session.scale;
        let px = |v: f64| (v * s).round() as i32;
        let content_size = (px(hit.2).max(1), px(hit.3).max(1));
        let (cx, cy) = match session.content {
            None => initial_position(
                (session.anchor.x, session.anchor.y),
                (px(offset.0 as f64), px(offset.1 as f64)),
                content_size,
                session.work,
            ),
            Some(previous) => resized_position(previous, content_size, session.work),
        };
        let first_show = session.content.is_none();
        let content = Rect {
            left: cx,
            top: cy,
            right: cx + content_size.0,
            bottom: cy + content_size.1,
        };
        let origin = (cx - px(hit.0), cy - px(hit.1));
        session.content = Some(content);
        session.window_origin = origin;
        session.expanded = expanded;
        if first_show {
            session.deadline = hide_after.map(|d| Instant::now() + d);
        }
        self.park_at = None;
        set_hit_rect(content);
        unsafe {
            let _ = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                origin.0,
                origin.1,
                px(size.0).max(1),
                px(size.1).max(1),
                SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS,
            );
        }
        BAR_VISIBLE.store(true, Ordering::Relaxed);
    }

    fn on_move(&mut self, point: Point) {
        let hide_after = auto_hide_after(self.settings.hide_delay_secs);
        let Some(session) = self.session.as_mut() else {
            return;
        };
        let Some(content) = session.content else {
            return;
        };
        let inside = content.contains(point.x, point.y);
        let changed = inside != session.inside;
        session.inside = inside;
        if changed && !session.busy {
            // Leaving the icon or toolbar restarts the same countdown as when it first appeared.
            session.deadline = if inside {
                None
            } else {
                hide_after.map(|d| Instant::now() + d)
            };
        }
        if changed || (inside && session.last_pointer.elapsed() >= POINTER_INTERVAL) {
            session.last_pointer = Instant::now();
            let (x, y) = to_client(session, point);
            emit(
                "selection_bar_pointer",
                PointerPayload {
                    seq: session.seq,
                    x,
                    y,
                    inside,
                },
            );
        }
    }

    fn hide(&mut self) {
        BAR_VISIBLE.store(false, Ordering::Relaxed);
        SWALLOW_OTHER_UP.store(false, Ordering::Relaxed);
        let Some(session) = self.session.take() else {
            return;
        };
        if session.content.is_some() {
            self.park_at = Some(Instant::now() + FADE_OUT);
        }
        emit("selection_bar_hidden", session.seq);
    }

    fn park(&mut self) {
        self.park_at = None;
        if let Some(hwnd) = bar_hwnd() {
            unsafe {
                let _ = SetWindowPos(
                    hwnd,
                    HWND::default(),
                    OFFSCREEN,
                    OFFSCREEN,
                    0,
                    0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS,
                );
            }
        }
    }
}

fn to_client(session: &Session, point: Point) -> (f64, f64) {
    (
        (point.x - session.window_origin.0) as f64 / session.scale,
        (point.y - session.window_origin.1) as f64 / session.scale,
    )
}
