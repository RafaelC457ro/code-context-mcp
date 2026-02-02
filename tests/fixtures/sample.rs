use std::collections::HashMap;

mod utils;

struct Point {
    x: f64,
    y: f64,
}

enum Color {
    Red,
    Green,
    Blue,
}

trait Drawable {
    fn draw(&self);
}

impl Drawable for Point {
    fn draw(&self) {
        render();
    }
}

impl Point {
    fn new(x: f64, y: f64) -> Point {
        Point { x, y }
    }

    fn distance(&self, other: &Point) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        compute_sqrt(dx * dx + dy * dy)
    }
}

fn render() {
    println!("rendering");
}

fn compute_sqrt(value: f64) -> f64 {
    value.sqrt()
}
