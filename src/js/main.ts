declare var require: any;
require('../css/main.css');

import 'regenerator-runtime/runtime'; // fix a babel problem with async functions
//const initSqlJs = require('sql.js');
import initSqlJs, * as sqljs from "sql.js";
import { DB } from "./database";
import * as pf from "./pathfinding";
import * as env from "./environment";
import * as dfa from "./dfa";
import * as fe from "./frontend";
import * as be from "./backend";
import me from './me';

import PlayScreen from './screens/play';

async function test(db: any, environment: env.Environment, pathfinding: pf.Pathfinding) {
    me.game.world.addChild(
        new fe.Wall([[1,1], [100,1], [100,100], [51,100], [51,51], [1, 51]])
    );

    me.game.world.addChild(
        new fe.Pellet([50, 50])
    );
}

 
async function main() {
    const db = await DB.getInstance();
    const environment: env.Environment = new env.Environment(db);
    const pathfinding: pf.Pathfinding = new pf.Pathfinding(db);
 
    const map = `
███ ███ ███
█        █
████████████`
    environment.setMap(map);
    test(db, environment, pathfinding);
}


class Bootstrap {

    constructor() {
        // Initialize the video.
        if (!me.video.init(640, 480, { wrapper : "screen", scale : "flex-width", renderer: me.video.CANVAS })) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // add "#debug" to the URL to enable the debug Panel
        if (document.location.hash === "#debug") {
            console.log("show debug");
            window.addEventListener('load', () => {
                me.plugin.register.defer(this, me.debug.Panel, "debug", me.input.KEY.V);
            });
        }

        // Initialize the audio.
        me.audio.init("mp3,ogg");

        // Set a callback to run when loading is complete.
        me.loader.onload = this.loaded.bind(this);

        // Load the resources.
        me.loader.preload({});

        // Initialize melonJS and display a loading screen.
        me.state.change(me.state.LOADING);
    }

    loaded() {
        //me.state.set(me.state.MENU, new TitleScreen());
        me.state.set(me.state.PLAY, new PlayScreen());

        // add our player entity in the entity pool
        //me.pool.register("mainPlayer", PlayerEntity);

        // Start the game.
        me.state.change(me.state.PLAY);
    }

    static boot() {
        const bootstrap = new Bootstrap();

        // Mobile browser hacks
        if (me.device.isMobile) {
            // Prevent the webview from moving on a swipe
            window.document.addEventListener("touchmove", function (e) {
                e.preventDefault();
                window.scroll(0, 0);
                return false;
            }, false);

            me.event.subscribe(me.event.WINDOW_ONRESIZE, () => {
                window.scrollTo(0, 1);
            });
        }

        return bootstrap;
    }
}

window.addEventListener('load', () => {
    Bootstrap.boot();
});
