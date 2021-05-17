class Game {
    public data: any;
    constructor() {
        this.data = {
        	resources: [
			    { name : "pacman", type : "image", src : "data/img/pacman2.png" },
                { name : "ghost_body", type : "image", src : "data/img/ghost_body.png" },
                { name : "ghost_eyes", type : "image", src : "data/img/ghost_eyes.png" },
			    { name : "bgm", type : "audio", src : "data/bgm/" },
                { name : "pellet", type : "audio", src : "data/sfx/" },
			],
            score : 0,
            resolution: [600,540],
        };
    }
}

export default new Game();