// Decides whether the selection assistant pops up after a gesture. Pure logic.

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Probe {
    // UI Automation read the selection.
    Text(String),
    // The focused control reports no selection. Electron apps and some browsers report this for a while
    // even when text is selected, so it is treated like `Unsupported`.
    Empty,
    // No text pattern, an error or a timeout: we cannot tell.
    Unsupported,
    // The focused control is a password box.
    Password,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Decision {
    Ignore,
    // Show the assistant; `None` means the text is read from the clipboard when a button is clicked.
    Show(Option<String>),
}

#[derive(Clone, Debug, Default)]
pub struct Context {
    pub fullscreen: bool,
    pub disable_in_fullscreen: bool,
    // File name of the program under the mouse, for example "WINWORD.EXE".
    pub exe: String,
    pub blacklist: Vec<String>,
    pub own_window: bool,
    pub terminal: bool,
    pub compat_mode: bool,
    // The mouse cursor was the text I-beam when the gesture started.
    pub ibeam: bool,
}

pub fn is_blacklisted(exe: &str, blacklist: &[String]) -> bool {
    let exe = exe.trim();
    !exe.is_empty()
        && blacklist
            .iter()
            .any(|item| item.trim().eq_ignore_ascii_case(exe))
}

// Window classes of consoles, where a simulated Ctrl+C would interrupt the running program.
pub fn is_terminal_class(class: &str) -> bool {
    matches!(
        class,
        "ConsoleWindowClass" | "CASCADIA_HOSTING_WINDOW_CLASS" | "PseudoConsoleWindow" | "mintty"
    )
}

// Filters that do not need the selection itself; checked before probing so we skip the UI Automation call.
pub fn filtered_out(context: &Context) -> bool {
    context.own_window
        || (context.disable_in_fullscreen && context.fullscreen)
        || is_blacklisted(&context.exe, &context.blacklist)
}

pub fn decide(probe: Probe, context: &Context) -> Decision {
    if filtered_out(context) {
        return Decision::Ignore;
    }
    match probe {
        Probe::Text(text) if !text.trim().is_empty() => Decision::Show(Some(text)),
        Probe::Text(_) | Probe::Password => Decision::Ignore,
        Probe::Empty | Probe::Unsupported => {
            if context.compat_mode && context.ibeam && !context.terminal {
                Decision::Show(None)
            } else {
                Decision::Ignore
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx() -> Context {
        Context {
            exe: "notepad.exe".into(),
            compat_mode: true,
            disable_in_fullscreen: true,
            ..Default::default()
        }
    }

    #[test]
    fn readable_selection_shows_with_text() {
        assert_eq!(
            decide(Probe::Text("hello".into()), &ctx()),
            Decision::Show(Some("hello".into()))
        );
    }

    #[test]
    fn blank_and_password_selections_are_ignored() {
        assert_eq!(decide(Probe::Text("  \n".into()), &ctx()), Decision::Ignore);
        assert_eq!(decide(Probe::Password, &ctx()), Decision::Ignore);
        let mut c = ctx();
        c.ibeam = true;
        assert_eq!(decide(Probe::Password, &c), Decision::Ignore);
    }

    #[test]
    fn empty_selection_is_treated_like_an_unreadable_one() {
        assert_eq!(decide(Probe::Empty, &ctx()), Decision::Ignore);
        let mut c = ctx();
        c.ibeam = true;
        assert_eq!(decide(Probe::Empty, &c), Decision::Show(None));
        c.compat_mode = false;
        assert_eq!(decide(Probe::Empty, &c), Decision::Ignore);
    }

    #[test]
    fn unreadable_selection_shows_without_text_only_over_text_in_compat_mode() {
        let mut c = ctx();
        c.ibeam = true;
        assert_eq!(decide(Probe::Unsupported, &c), Decision::Show(None));
        c.compat_mode = false;
        assert_eq!(decide(Probe::Unsupported, &c), Decision::Ignore);
        c.compat_mode = true;
        c.ibeam = false;
        assert_eq!(decide(Probe::Unsupported, &c), Decision::Ignore);
    }

    #[test]
    fn terminals_never_fall_back_to_the_clipboard() {
        let mut c = ctx();
        c.ibeam = true;
        c.terminal = true;
        assert_eq!(decide(Probe::Unsupported, &c), Decision::Ignore);
        assert_eq!(
            decide(Probe::Text("ls".into()), &c),
            Decision::Show(Some("ls".into()))
        );
    }

    #[test]
    fn fullscreen_respects_the_setting() {
        let mut c = ctx();
        c.fullscreen = true;
        assert_eq!(decide(Probe::Text("a".into()), &c), Decision::Ignore);
        c.disable_in_fullscreen = false;
        assert_eq!(
            decide(Probe::Text("a".into()), &c),
            Decision::Show(Some("a".into()))
        );
    }

    #[test]
    fn blacklist_matches_exe_names_case_insensitively() {
        let mut c = ctx();
        c.exe = "Photoshop.exe".into();
        c.blacklist = vec![" photoshop.EXE ".into()];
        assert_eq!(decide(Probe::Text("a".into()), &c), Decision::Ignore);
        assert!(!is_blacklisted("", &["".into()]));
    }

    #[test]
    fn own_windows_are_ignored() {
        let mut c = ctx();
        c.own_window = true;
        assert_eq!(decide(Probe::Text("a".into()), &c), Decision::Ignore);
    }

    #[test]
    fn terminal_classes() {
        assert!(is_terminal_class("ConsoleWindowClass"));
        assert!(is_terminal_class("CASCADIA_HOSTING_WINDOW_CLASS"));
        assert!(!is_terminal_class("Notepad"));
    }
}
