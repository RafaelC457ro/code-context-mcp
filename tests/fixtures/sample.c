#include <stdio.h>
#include <stdlib.h>

typedef unsigned long size_t_alias;

typedef struct {
    int x;
    int y;
} Point;

struct Color {
    int r;
    int g;
    int b;
};

enum Direction {
    NORTH,
    SOUTH,
    EAST,
    WEST
};

void print_point(Point p) {
    printf("(%d, %d)\n", p.x, p.y);
}

int add(int a, int b) {
    return a + b;
}

int main(int argc, char *argv[]) {
    Point p = {10, 20};
    print_point(p);
    int result = add(p.x, p.y);
    printf("Sum: %d\n", result);
    return 0;
}
