declare var require: any;
require("../css/main.css");

import "regenerator-runtime/runtime"; // fix a babel problem with async functions
import game from './game';
import me from "./me";

import PlayScreen from "./screens/play";

class Bootstrap {
    constructor() {
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

        me.audio.init("mp3,ogg,wav");
        me.loader.onload = this.loaded.bind(this);
        me.loader.preload(game.data.resources, this.loaded.bind(this));
        me.state.change(me.state.LOADING);
    }

    async loaded() {
        //me.state.set(me.state.MENU, new TitleScreen());
        me.state.set(me.state.PLAY, new PlayScreen([game.data.resolution[0], game.data.resolution[1]]));
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

window.addEventListener("load", () => {
    Bootstrap.boot();
});
