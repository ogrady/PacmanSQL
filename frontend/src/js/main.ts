declare var require: any;
require("../css/main.css");

import "regenerator-runtime/runtime"; // fix a babel problem with async functions
import game from './game';
import me from "./me";
import events from "events";

import PlayScreen from "./screens/play";

export class Bootstrap {
    private static instance: Bootstrap | undefined = undefined;

    public static getInstance(): Bootstrap {
        if(Bootstrap.instance === undefined) {
            Bootstrap.instance = new Bootstrap();
        }
        return Bootstrap.instance;
    }

    private emitter: events.EventEmitter;
    public up;
    public down;
    public left;
    public right;

    public on(event, callback) {
        this.emitter.on(event, callback);
    }

    private constructor() {
        this.emitter = new events.EventEmitter();

        // Initialize the video.
        if (!me.video.init(game.data.resolution[0], game.data.resolution[1],
            {
                parent : "screen",
                renderer : me.video.AUTO,
                scaleMethod : "fit",
                doubleBuffering : true
           }))
        {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }

        // add "#debug" to the URL to enable the debug Panel
        if (document.location.hash === "#debug") {
            console.log("show debug");
            window.addEventListener("load", () => {
                me.plugin.register.defer(this, me.debug.Panel, "debug", me.input.KEY.V);
            });
        }

        this.updateTouchRects();

        me.audio.init("mp3,ogg,wav");
        me.loader.onload = this.loaded.bind(this);
        me.loader.preload(game.data.resources, this.loaded.bind(this));
        me.state.change(me.state.LOADING);
    }

    public updateTouchRects() {
        const [w,h] = [window.innerWidth/3, window.innerHeight/3];
        this.up = new me.Rect(w,0,w,h);
        this.left = new me.Rect(0,h,w,h);
        this.right = new me.Rect(2*w,h,w,h);
        this.down = new me.Rect(w,2*h,w,h);
    }

    public checkTouch(x,y) {
        if(this.up.containsPoint(x,y)){
            this.emitter.emit("touch-up");
        }
        if(this.down.containsPoint(x,y)){
            this.emitter.emit("touch-down");
        }
        if(this.left.containsPoint(x,y)){
            this.emitter.emit("touch-left");
        }
        if(this.right.containsPoint(x,y)){
            this.emitter.emit("touch-right");
        }
    }

    public async loaded() {
        //me.state.set(me.state.MENU, new TitleScreen());
        me.state.set(me.state.PLAY, new PlayScreen([game.data.resolution[0], game.data.resolution[1]]));
        me.state.change(me.state.PLAY);
    }


    static boot() {
        const bootstrap = Bootstrap.getInstance();

        // Mobile browser hacks
        if (true || me.device.isMobile) {
            console.log("detected mobile device");
            // Prevent the webview from moving on a swipe
            window.document.addEventListener("touchmove", e => {
                e.preventDefault();
                window.scroll(0, 0);
                return false;
            }, false);

            window.document.addEventListener("touchstart", e => {
                const [x,y] = [e.touches[0].clientX, e.touches[0].clientY];
                bootstrap.checkTouch(x,y);
            }, false);

            me.event.subscribe(me.event.WINDOW_ONRESIZE, () => {
                window.scrollTo(0, 1);
                bootstrap.updateTouchRects();
            });
        }

        return bootstrap;
    }
}

window.addEventListener("load", () => Bootstrap.boot());
