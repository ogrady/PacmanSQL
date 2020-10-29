class Game {
    public data: any;
    constructor() {
        this.data = {
        	resources: [
			    //{ name : "pacman", type : "image", src : "data/img/pacman.png" }
			    { name : "bgm", type : "audio", src : "data/bgm/" },
                { name : "pellet", type : "audio", src : "data/sfx/" },
			],
            score : 0,
            resolution: [800,800],
            
            maps: [
            	{ spawn: [5,6],
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
	spawn: [4,5],
	shape: ``
}
]
        };
    }
}

export default new Game();