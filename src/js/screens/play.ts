import me from '../me';
import game from "../game";
import HUD from "../entities/HUD";

import { DB } from "../db/database";
import * as env from "../environment";
import * as fe from "../frontend";

enum Direction {
  None, // me.input.bindKey doesn't seem to like to be bound to the first enum value (= 0?), so here is a noop.
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
    private entities: {[key: number]: any};
    private pellets: {[key: string]: any};
    //private pathfinding: pf.Pathfinding | undefined;

    public constructor() {
        super();
        this.entities = {};
        this.pellets = {};
    }

    private hashCoordinate(x: number, y: number): string {
        return `${x}|${y}`; // hurrr
    }

    public async onResetEvent() {
        console.log("Show play screen");

        const db = await DB.getInstance();
        this.environment = new env.Environment(db);

        const e: env.Environment = this.environment;

        const [spawnX, spawnY] = game.data.spawn;
       
        e.setMap(game.data.map);       

        me.input.bindKey(me.input.KEY.W, Direction.Up);
        me.input.bindKey(me.input.KEY.S, Direction.Down);
        me.input.bindKey(me.input.KEY.A, Direction.Left);
        me.input.bindKey(me.input.KEY.D, Direction.Right);
        
        me.game.world.addChild(new me.ColorLayer("background", "#00121c"));
        
        const [resWidth, resHeigth] = game.data.resolution;
        const [gridWidth, gridHeight] = e.getDimensions();
        const w: number = resWidth / (gridWidth + 1);
        const h: number = resHeigth / (gridHeight + 1);
        game.data.blockSize = [w,h];
        for(const [x,y] of e.getBlockedAreas()) {
            const [ax, ay] = [x * 0.5 * w + 0.25 * w, y * 0.5 * h + 0.25 * h];
            me.game.world.addChild(new fe.Wall([
                [ax, ay],         // top left 
                [ax + w, ay],     // top right
                [ax + w, ay + h], // bottom right
                [ax, ay + h]      // bottom left
            ]));    
        }

        const playerId: number = e.createPlayer(spawnX, spawnY);       
        this.pacman = new fe.Pacman(
            playerId,
            [spawnX * w + 0.5 * w,
             spawnY * h + 0.5 * h], w);

        this.entities[playerId] = this.pacman;

        for(const [x,y] of e.getWalkableAreas()) {
            const pellet = new fe.Pellet([x * w + 0.5 * w, y * h + 0.5 * h]);
            this.pellets[this.hashCoordinate(x,y)] = pellet;
            me.game.world.addChild(pellet);
        }
        
        me.game.world.addChild(this.pacman);
    }

    public update() {
        const res = super.update();
        
        if(this.environment === undefined) return res; // early bail if async DB init has not finished yet

        let x: number = 0;
        let y: number = 0;
        if (me.input.isKeyPressed(Direction.Left))  {
            x = -1;
        } else if (me.input.isKeyPressed(Direction.Right))  {
            x = 1;
        } else if (me.input.isKeyPressed(Direction.Up)) {
            y = -1;
        } else if (me.input.isKeyPressed(Direction.Down))  {
            y = 1;
        } 

        if(x != 0 || y != 0) {
            this.environment?.setPlayerMovement(this.pacman?.dbId as number, x, y)
        }

        const clearedCells: [number, number, number][] = this.environment?.updatePositions();
        const [blockWidth, blockHeight] = game.data.blockSize;
        for(const [eid, x, y, dx, dy] of this.environment?.getStates()) {
            const entity = this.entities[eid];
            if(entity !== undefined) {
                this.pacman?.setPosition(
                    x * blockWidth + 1 * blockWidth, 
                    y * blockHeight + 1 * blockHeight
                );
            }
        }
        for(const [cid, x, y] of clearedCells) {
            me.game.world.removeChild(this.pellets[this.hashCoordinate(x, y)]);
        }

        return res;
    }

    onDestroyEvent() {
        // remove the HUD from the game world
        me.game.world.removeChild(this.HUD);
    }
}

export default PlayScreen;