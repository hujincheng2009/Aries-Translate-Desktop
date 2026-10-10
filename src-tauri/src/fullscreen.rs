fn rectangles_match(window: (i32, i32, i32, i32), monitor: (i32, i32, i32, i32)) -> bool {
    window == monitor && monitor.2 > monitor.0 && monitor.3 > monitor.1
}

fn excluded_window_class(class: &str) -> bool {
    matches!(
        class,
        "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
    )
}

#[cfg(target_os = "windows")]
pub fn foreground_is_fullscreen() -> bool {
    use windows::Win32::{
        Foundation::RECT,
        Graphics::Gdi::{
            GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
        },
        UI::{
            Shell::{
                SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE,
                QUNS_RUNNING_D3D_FULL_SCREEN,
            },
            WindowsAndMessaging::{
                GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId,
            },
        },
    };
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return false;
        }
        let mut process_id = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));
        let mut class = [0u16; 256];
        let length = GetClassNameW(hwnd, &mut class).max(0) as usize;
        if process_id == std::process::id()
            || excluded_window_class(&String::from_utf16_lossy(&class[..length]))
        {
            return false;
        }
        if let Ok(state) = SHQueryUserNotificationState() {
            if matches!(
                state,
                QUNS_BUSY | QUNS_RUNNING_D3D_FULL_SCREEN | QUNS_PRESENTATION_MODE
            ) {
                return true;
            }
        }
        let mut window = RECT::default();
        let mut monitor = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if GetWindowRect(hwnd, &mut window).is_err()
            || !GetMonitorInfoW(
                MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST),
                &mut monitor,
            )
            .as_bool()
        {
            return false;
        }
        let screen = monitor.rcMonitor;
        rectangles_match(
            (window.left, window.top, window.right, window.bottom),
            (screen.left, screen.top, screen.right, screen.bottom),
        )
    }
}

#[cfg(not(target_os = "windows"))]
pub fn foreground_is_fullscreen() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn full_screen_uses_monitor_not_work_area() {
        assert!(rectangles_match((0, 0, 1920, 1080), (0, 0, 1920, 1080)));
        assert!(!rectangles_match((0, 0, 1920, 1040), (0, 0, 1920, 1080)));
        assert!(rectangles_match(
            (-1920, -200, 0, 880),
            (-1920, -200, 0, 880)
        ));
        assert!(!rectangles_match((0, 0, 0, 0), (0, 0, 0, 0)));
    }
    #[test]
    fn desktop_and_taskbars_are_excluded() {
        for class in [
            "Progman",
            "WorkerW",
            "Shell_TrayWnd",
            "Shell_SecondaryTrayWnd",
        ] {
            assert!(excluded_window_class(class));
        }
        assert!(!excluded_window_class("Chrome_WidgetWin_1"));
    }
}
