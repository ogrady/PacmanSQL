import me from '../me';
import game from "../game";
import HUD from "../entities/HUD";

import { DB } from "../database";
import * as env from "../environment";
import * as fe from "../frontend";
import * as be from "../backend";

enum Direction {
  Up,
  Down,
  Left,
  Right
}

class PlayScreen extends me.Stage {
    private HUD: HUD | undefined;
    private environment: env.Environment | undefined;
    private playerId: number = 0;
    private pacman: fe.Pacman | undefined;
    //private pathfinding: pf.Pathfinding | undefined;

    async onResetEvent() {
        const map: string = `
███ ███ ███
█        █
████████████`;
        const db = await DB.getInstance();
        this.environment = new env.Environment(db);
        //this.pathfinding = new pf.Pathfinding(db);       
        this.environment?.setMap(map);

        this.playerId = this.environment?.createEntity(3, 3);

        

        console.log("Show play screen");
        me.game.world.addChild(new me.ColorLayer("background", "#00121c"));

        const dim: be.Dimensions = this.environment.getDimensions();
        const w: number = 50;
        const h: number = 50;
        for(const [x,y] of this.environment?.getBlockedAreas()) {
            const [ax, ay] = [x * w + 1, y * h + 1];
            me.game.world.addChild(new fe.Wall([
                [ax, ay],         // top left 
                [ax + w, ay],     // top right
                [ax + w, ay + h], // bottom right
                [ax, ay + h]      // bottom left
            ]));    
        }

        me.input.bindKey(me.input.KEY.W, Direction.Up);
        me.input.bindKey(me.input.KEY.S, Direction.Down);
        me.input.bindKey(me.input.KEY.A, Direction.Left);
        me.input.bindKey(me.input.KEY.D, Direction.Right);

        // reset the score
        game.data.score = 0;

        // Add our HUD to the game world, add it last so that this is on top of the rest.
        // Can also be forced by specifying a "Infinity" z value to the addChild function.
        this.HUD = new HUD();
        this.pacman = new fe.Pacman([20, 20])

        me.game.world.addChild(this.HUD);
        me.game.world.addChild(new fe.Pellet([50, 50]));
        me.game.world.addChild(new fe.Wall([[1,1], [100,1], [100,100], [51,100], [51,51], [1, 51]]));
        me.game.world.addChild(this.pacman);
    }

    public update() {
        super.update();
        if(this.environment === undefined) return; // early bail if async DB init has not finished yet

        let x: number = 0;
        let y: number = 0;
        if (me.input.isKeyPressed(Direction.Left))  {
            x = -1;
        } else if (me.input.isKeyPressed(Direction.Right))  {
            x = 1
        } else if (me.input.isKeyPressed(Direction.Up))  {
            y = -1;
        } else if (me.input.isKeyPressed(Direction.Down))  {
            y = 1;
        } 

        if(x != 0 || y != 0) {
            this.environment?.setPlayerMovement(this.playerId, x, y)
        }

        this.environment?.updatePositions();
        for(const [eid, x, y, dx, dy] of this.environment?.getStates()) {
            if(eid == this.playerId) {
                this.pacman?.setPosition(x, y);
            }
            
        }
        
    }

    onDestroyEvent() {
        // remove the HUD from the game world
        me.game.world.removeChild(this.HUD);
    }
}

export default PlayScreen;