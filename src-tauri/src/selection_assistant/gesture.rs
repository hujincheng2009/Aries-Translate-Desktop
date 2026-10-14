// Turns raw left-button presses into "the user probably selected text" gestures.
// Pure logic: thresholds come from the system settings and are passed in, so it can be unit tested.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Gesture {
    Drag,
    DoubleClick,
    TripleClick,
    ShiftClick,
}

#[derive(Clone, Copy, Debug)]
pub struct Thresholds {
    // Movement (physical pixels) beyond which a press counts as a drag (SM_CXDRAG / SM_CYDRAG).
    pub drag_x: i32,
    pub drag_y: i32,
    // Maximum time and distance between clicks of a double click (GetDoubleClickTime, SM_CXDOUBLECLK).
    pub double_click_ms: u32,
    pub double_click_x: i32,
    pub double_click_y: i32,
}

#[derive(Default)]
pub struct GestureRecognizer {
    down: Option<(Point, u32)>,
    last_click: Option<(Point, u32)>,
    click_count: u32,
}

impl GestureRecognizer {
    pub fn on_left_down(&mut self, point: Point, time: u32) {
        self.down = Some((point, time));
    }

    // Returns the gesture finished by this release, if any. `time` is the system tick count in milliseconds.
    pub fn on_left_up(
        &mut self,
        point: Point,
        time: u32,
        shift: bool,
        thresholds: &Thresholds,
    ) -> Option<Gesture> {
        let (down_point, _) = self.down.take()?;
        let dx = (point.x - down_point.x).abs();
        let dy = (point.y - down_point.y).abs();
        if dx > thresholds.drag_x || dy > thresholds.drag_y {
            self.last_click = None;
            self.click_count = 0;
            return Some(Gesture::Drag);
        }

        let continues_series = self.last_click.is_some_and(|(last_point, last_time)| {
            time.wrapping_sub(last_time) <= thresholds.double_click_ms
                && (point.x - last_point.x).abs() <= thresholds.double_click_x / 2
                && (point.y - last_point.y).abs() <= thresholds.double_click_y / 2
        });
        self.click_count = if continues_series {
            self.click_count + 1
        } else {
            1
        };
        self.last_click = Some((point, time));

        match self.click_count {
            1 if shift => Some(Gesture::ShiftClick),
            1 => None,
            2 => Some(Gesture::DoubleClick),
            _ => Some(Gesture::TripleClick),
        }
    }

    // A press somewhere the assistant ignores (for example on its own toolbar) breaks a click series.
    pub fn reset(&mut self) {
        self.down = None;
        self.last_click = None;
        self.click_count = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const T: Thresholds = Thresholds {
        drag_x: 4,
        drag_y: 4,
        double_click_ms: 500,
        double_click_x: 4,
        double_click_y: 4,
    };

    fn p(x: i32, y: i32) -> Point {
        Point { x, y }
    }

    fn click(r: &mut GestureRecognizer, x: i32, y: i32, time: u32, shift: bool) -> Option<Gesture> {
        r.on_left_down(p(x, y), time);
        r.on_left_up(p(x, y), time + 60, shift, &T)
    }

    #[test]
    fn small_movement_is_a_plain_click_not_a_drag() {
        let mut r = GestureRecognizer::default();
        r.on_left_down(p(100, 100), 0);
        assert_eq!(r.on_left_up(p(103, 102), 80, false, &T), None);
    }

    #[test]
    fn movement_beyond_the_threshold_is_a_drag() {
        let mut r = GestureRecognizer::default();
        r.on_left_down(p(100, 100), 0);
        assert_eq!(
            r.on_left_up(p(160, 101), 300, false, &T),
            Some(Gesture::Drag)
        );
        r.on_left_down(p(100, 100), 1000);
        assert_eq!(
            r.on_left_up(p(100, 105), 1100, false, &T),
            Some(Gesture::Drag)
        );
    }

    #[test]
    fn two_quick_clicks_are_a_double_click() {
        let mut r = GestureRecognizer::default();
        assert_eq!(click(&mut r, 50, 50, 0, false), None);
        assert_eq!(
            click(&mut r, 51, 50, 200, false),
            Some(Gesture::DoubleClick)
        );
    }

    #[test]
    fn slow_or_distant_second_click_starts_a_new_series() {
        let mut r = GestureRecognizer::default();
        click(&mut r, 50, 50, 0, false);
        assert_eq!(click(&mut r, 50, 50, 700, false), None);
        assert_eq!(click(&mut r, 80, 50, 800, false), None);
    }

    #[test]
    fn third_quick_click_is_a_triple_click() {
        let mut r = GestureRecognizer::default();
        click(&mut r, 50, 50, 0, false);
        click(&mut r, 50, 50, 200, false);
        assert_eq!(
            click(&mut r, 50, 50, 400, false),
            Some(Gesture::TripleClick)
        );
    }

    #[test]
    fn shift_click_extends_a_selection() {
        let mut r = GestureRecognizer::default();
        assert_eq!(click(&mut r, 50, 50, 0, true), Some(Gesture::ShiftClick));
    }

    #[test]
    fn release_without_press_is_ignored() {
        let mut r = GestureRecognizer::default();
        assert_eq!(r.on_left_up(p(1, 1), 10, false, &T), None);
    }

    #[test]
    fn tick_count_wraparound_still_detects_double_click() {
        let mut r = GestureRecognizer::default();
        click(&mut r, 50, 50, u32::MAX - 100, false);
        assert_eq!(click(&mut r, 50, 50, 50, false), Some(Gesture::DoubleClick));
    }

    #[test]
    fn reset_breaks_a_click_series() {
        let mut r = GestureRecognizer::default();
        click(&mut r, 50, 50, 0, false);
        r.reset();
        assert_eq!(click(&mut r, 50, 50, 200, false), None);
    }
}
