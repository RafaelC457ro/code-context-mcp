#ifndef SAMPLE_H
#define SAMPLE_H

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

void print_point(Point p);
int add(int a, int b);
int main(int argc, char *argv[]);

#endif
