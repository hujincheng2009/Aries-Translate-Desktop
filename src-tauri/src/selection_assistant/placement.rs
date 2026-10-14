// Where the floating icon / toolbar goes. All values are physical pixels. Pure logic.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl Rect {
    pub fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.left && x < self.right && y >= self.top && y < self.bottom
    }
}

fn clamp_start(start: i32, size: i32, min: i32, max: i32) -> i32 {
    if size >= max - min {
        min
    } else {
        start.clamp(min, max - size)
    }
}

// Countdown before the popup hides itself when the mouse is not on it; 0 seconds means never.
pub fn auto_hide_after(seconds: u64) -> Option<std::time::Duration> {
    (seconds > 0).then(|| std::time::Duration::from_secs(seconds))
}

// Top-left of the popup content when it first appears: the release point moved by the offset (X -10 = 10 px to
// the left of the mouse). When that leaves the work area it is mirrored to the other side of the mouse, then
// clamped inside the work area.
pub fn initial_position(
    anchor: (i32, i32),
    offset: (i32, i32),
    size: (i32, i32),
    work: Rect,
) -> (i32, i32) {
    let place = |anchor: i32, offset: i32, size: i32, min: i32, max: i32| {
        let mut start = anchor + offset;
        if start + size > max || start < min {
            start = anchor - offset - size;
        }
        clamp_start(start, size, min, max)
    };
    (
        place(anchor.0, offset.0, size.0, work.left, work.right),
        place(anchor.1, offset.1, size.1, work.top, work.bottom),
    )
}

// Top-left of the content after it changes size (icon expanding into the toolbar, a tooltip appearing):
// keep the left edge where the icon was; if it no longer fits, keep the right edge instead. Same for top/bottom.
pub fn resized_position(previous: Rect, size: (i32, i32), work: Rect) -> (i32, i32) {
    let along = |start: i32, end: i32, size: i32, min: i32, max: i32| {
        let candidate = if start + size <= max {
            start
        } else {
            end - size
        };
        clamp_start(candidate, size, min, max)
    };
    (
        along(previous.left, previous.right, size.0, work.left, work.right),
        along(previous.top, previous.bottom, size.1, work.top, work.bottom),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: Rect = Rect {
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1040,
    };

    #[test]
    fn default_offset_puts_the_icon_below_right() {
        assert_eq!(
            initial_position((500, 400), (15, 20), (40, 40), WORK),
            (515, 420)
        );
    }

    #[test]
    fn near_the_right_edge_it_flips_left() {
        assert_eq!(
            initial_position((1900, 400), (15, 20), (40, 40), WORK),
            (1845, 420)
        );
    }

    #[test]
    fn near_the_bottom_it_flips_up() {
        assert_eq!(
            initial_position((500, 1030), (15, 20), (40, 40), WORK),
            (515, 970)
        );
    }

    #[test]
    fn bottom_right_corner_flips_both_ways() {
        assert_eq!(
            initial_position((1910, 1035), (15, 20), (40, 40), WORK),
            (1855, 975)
        );
    }

    #[test]
    fn negative_offset_moves_the_top_left_corner_left_and_up_from_the_mouse() {
        assert_eq!(
            initial_position((500, 400), (-10, -10), (40, 40), WORK),
            (490, 390)
        );
        assert_eq!(
            initial_position((500, 400), (-10, 16), (40, 40), WORK),
            (490, 416)
        );
    }

    #[test]
    fn negative_offset_at_the_left_edge_is_mirrored() {
        assert_eq!(
            initial_position((5, 400), (-10, 16), (40, 40), WORK),
            (0, 416)
        );
        assert_eq!(
            initial_position((30, 400), (-40, 16), (40, 40), WORK),
            (30, 416)
        );
    }

    #[test]
    fn zero_seconds_never_hides() {
        assert_eq!(auto_hide_after(0), None);
        assert_eq!(auto_hide_after(5), Some(std::time::Duration::from_secs(5)));
    }

    #[test]
    fn secondary_monitor_with_negative_coordinates() {
        let left_monitor = Rect {
            left: -1440,
            top: 0,
            right: 0,
            bottom: 860,
        };
        assert_eq!(
            initial_position((-20, 300), (18, 24), (50, 50), left_monitor),
            (-88, 324)
        );
    }

    #[test]
    fn expanding_keeps_the_left_edge_when_it_fits() {
        let icon = Rect {
            left: 500,
            top: 400,
            right: 540,
            bottom: 440,
        };
        assert_eq!(resized_position(icon, (300, 44), WORK), (500, 400));
    }

    #[test]
    fn expanding_near_the_right_edge_grows_to_the_left() {
        let icon = Rect {
            left: 1800,
            top: 400,
            right: 1840,
            bottom: 440,
        };
        assert_eq!(resized_position(icon, (300, 44), WORK), (1540, 400));
    }

    #[test]
    fn taller_content_near_the_bottom_grows_upward() {
        let icon = Rect {
            left: 500,
            top: 1000,
            right: 540,
            bottom: 1040,
        };
        assert_eq!(resized_position(icon, (300, 80), WORK), (500, 960));
    }

    #[test]
    fn content_larger_than_the_work_area_starts_at_its_edge() {
        let icon = Rect {
            left: 10,
            top: 10,
            right: 50,
            bottom: 50,
        };
        assert_eq!(resized_position(icon, (4000, 44), WORK), (0, 10));
    }

    #[test]
    fn rect_contains_is_half_open() {
        let r = Rect {
            left: 0,
            top: 0,
            right: 10,
            bottom: 10,
        };
        assert!(r.contains(0, 9));
        assert!(!r.contains(10, 5));
    }
}
