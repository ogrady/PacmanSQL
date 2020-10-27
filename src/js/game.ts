class Game {
    public data: any;
    constructor() {
        this.data = {
            score : 666,
            resolution: [800,800],
            map: `
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
x             xxx             x
x             xxx             x
x             xxx             x
x             xxx             x
x             xxx             x
x             xxx             x
x                             x
x         xxxxxxxxxxx         x
x             xxx             x
x                             x
x                             x
xxx  xx xxx    x   xxx  xx  xxx
x       x      x     x        x
x       x      x     x        x
x       x      x     x        x
x       x      x     x        x
x              x              x
x              x              x
x              x              x
x                             x
x       xxxxxxxxxxxxxx        x
x                             x
x                             x
x                             x
x                             x
x                             x
x                             x
x                             x
x                             x
x                             x
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
`
        };
    }
}

export default new Game();