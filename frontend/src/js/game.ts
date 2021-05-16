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
            resolution: [600,540],
        };
    }
}

export default new Game();