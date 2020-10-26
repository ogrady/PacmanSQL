import me from '../me';
import game from "../game";
import HUD from "../entities/HUD";

import { DB } from "../database";
import * as env from "../environment";
import * as fe from "../frontend";

class PlayScreen extends me.Stage {
    private HUD: HUD | undefined;
    private environment: env.Environment | undefined;
    //private pathfinding: pf.Pathfinding | undefined;

    async onResetEvent() {
        const map: string = `
███ ███ ███
█        █
████████████`;
        const db = await DB.getInstance();
        //this.environment = new env.Environment(db);
        //this.pathfinding = new pf.Pathfinding(db);       
        this.environment?.setMap(map);

        const x = this.environment?.getBlockedAreas();
        console.log(x);

        // reset the score
        game.data.score = 0;

        console.log("Show play screen");
        me.game.world.addChild(new me.ColorLayer("background", "#00121c"));
        // Add our HUD to the game world, add it last so that this is on top of the rest.
        // Can also be forced by specifying a "Infinity" z value to the addChild function.
        this.HUD = new HUD();
        me.game.world.addChild(this.HUD);
        me.game.world.addChild(new fe.Pellet([50, 50]));
        me.game.world.addChild(new fe.Wall([[1,1], [100,1], [100,100], [51,100], [51,51], [1, 51]]));
    }

    onDestroyEvent() {
        // remove the HUD from the game world
        me.game.world.removeChild(this.HUD);
    }
}

export default PlayScreen;