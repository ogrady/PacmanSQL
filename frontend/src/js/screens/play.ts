import me from "../me";
import { PacScreen } from "../screen";
import game from "../game";
import HUD from "../entities/HUD";

import * as fe from "../frontend";
import * as t from "../types";
import * as fp from "../functools";

enum Direction {
  None, // me.input.bindKey doesn"t seem to like to be bound to the first enum value (= 0?), so here is a noop.
  Up,
  Down,
  Left,
  Right
}

/*
  var socket = io();

  var form = document.getElementById("form");
  var input = document.getElementById("input");

  socket.emit("move", {eid: 1, x: 1, y: 0});
*/


class PlayScreen extends PacScreen {
    private HUD: HUD | undefined;
    private playerId: number = 0;
    private pacman: fe.DBRenderable | undefined;
    private entities: {[key: number]: any};
    private pellets: {[key: string]: any};
    private blockSize: t.Dimensions;
    private map: any;

    public constructor() {
        super();
        this.entities = {};
        this.pellets = {};
        this.blockSize = [0,0];
    }

    private hashCoordinate(x: number, y: number): string {
        return `${x}|${y}`; // hurrr
    }

    onload() {
        console.log("loading...")
    }

    private doKeyBinds(): void {
        me.input.bindKey(me.input.KEY.W, Direction.Up);
        me.input.bindKey(me.input.KEY.S, Direction.Down);
        me.input.bindKey(me.input.KEY.A, Direction.Left);
        me.input.bindKey(me.input.KEY.D, Direction.Right);        
    }

    private spawnPellets(w: number, h: number): void {
        /*
        for(const [x,y] of e.getWalkableAreas()) {
            const pellet = new fe.Pellet([x * w + 0.5 * w, y * h + 0.5 * h]);
            this.pellets[this.hashCoordinate(x,y)] = pellet;
            me.game.world.addChild(pellet);
        }
        */
    }

    private prepareMap(map: any): void {
        /*
        e.setMap(map.shape);
        me.game.world.addChild(new me.ColorLayer("background", fe.BACKGROUND_COLOUR));

        const [resWidth, resHeight] = game.data.resolution;
        const [gridWidth, gridHeight] = e.getDimensions();
        const w: number = resWidth / (gridWidth + 1);
        const h: number = resHeight / (gridHeight + 1);
        const [spawnX, spawnY] = map.pspawn;
               
        for(const [x,y] of e.getBlockedAreas()) {
            const [ax, ay] = [x * 0.5 * w + 0.25 * w, y * 0.5 * h + 0.25 * h];
            me.game.world.addChild(new fe.Wall([
                [ax, ay],         // top left 
                [ax + w, ay],     // top right
                [ax + w, ay + h], // bottom right
                [ax, ay + h]      // bottom left
            ]));    
        }
        this.blockSize = [w,h];
        this.map = map;
        */
    }

    private spawnPlayer(): void {
        /*
        const [spawnX, spawnY] = this.map.pspawn;
        const [w, h] = this.blockSize;

        const playerId: number = e.createPlayer(spawnX, spawnY);       
        this.pacman = new fe.Pacman(
            playerId,
            [spawnX * w + 0.5 * w,
             spawnY * h + 0.5 * h], w);

        this.entities[playerId] = this.pacman;
        me.game.world.addChild(this.pacman);
        */
    }

    private spawnGhosts(count: number): void {
        /*
        const [w, h] = this.blockSize;
        for(let i = 0; i < count; i++) {
            const [spawnX, spawnY] = fp.choice(this.map.espawns);

            const ghostId = e.createGhost(spawnX, spawnY);
            console.log(ghostId);
            const ghost = new fe.Ghost(ghostId,
                [spawnX * w + 0.5 * w,
                 spawnY * h + 0.5 * h], w);
            this.entities[ghostId] = ghost;
            me.game.world.addChild(ghost);

            //this.pathfinding?.initSearch(ghostId, [spawnX, spawnY], this.map.pspawn)
            //this.pathfinding?.initGhostToPacmanSearch(ghostId);
            this.ghostDFA?.setupEntity(ghostId, 1);
            for(let i = 0; i < 10; i++) {
                console.log(this.pathfinding?.tickPathsearch());
            }
        }
        */
    }


    public async onResetEvent() {

        //me.audio.play("bgm");
        console.log("Show play screen");

        this.socket.on("map", data => console.log(data));
        await this.socket.emit("map");
        this.doKeyBinds();
    }

    public update() {
        const res = super.update();
        
        if(this.environment === undefined) return res; // early bail if async DB init has not finished yet

        this.pathfinding?.tickPathsearch();
        this.ghostDFA?.tick();
        
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
            this.environment?.setPlayerMovement(this.pacman?.dbId as number, x, y);
        }

        const clearedCells: [number, number, number][] = this.environment?.updatePositions();
        const [blockWidth, blockHeight] = this.blockSize;
        for(const [eid, x, y, dx, dy] of this.environment?.getStates()) {
            const entity = this.entities[eid];
            if(entity !== undefined) {
                entity.setPosition(
                    x * blockWidth + 1 * blockWidth, 
                    y * blockHeight + 1 * blockHeight
                );
            }
        }
        for(const [cid, x, y] of clearedCells) {
            try {
                me.game.world.removeChild(this.pellets[this.hashCoordinate(x, y)]);
                me.audio.play("pellet");
            } catch {
                console.error(`Tried to remove non-existing pellet at (${x}, ${y})`);
            }
        }

        return res;
    }
}

export default PlayScreen;