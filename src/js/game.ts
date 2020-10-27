class Game {
    public data: any;
    constructor() {
        this.data = {
            score : 666,
            resolution: [800,800],
            spawn: [5,6],
            map: `
xxxxxxxxxxx
x    x    x
x xx x xx x
x  x x x  x
xx       xx
xx xx xx xx
x         x
x x xxx x x
x         x
xxxxxxxxxxx
`
        };
    }
}

export default new Game();