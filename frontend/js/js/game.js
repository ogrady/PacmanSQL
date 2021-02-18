"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Game {
    constructor() {
        this.data = {
            resources: [
                //{ name : "pacman", type : "image", src : "data/img/pacman.png" }
                { name: "bgm", type: "audio", src: "data/bgm/" },
                { name: "pellet", type: "audio", src: "data/sfx/" },
            ],
            score: 0,
            resolution: [800, 800],
            maps: [
                { pspawn: [5, 6],
                    espawns: [[2, 1]],
                    shape: `
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
                },
                {
                    pspawn: [4, 5],
                    espawns: [],
                    shape: ``
                }
            ]
        };
    }
}
exports.default = new Game();
