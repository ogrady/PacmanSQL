"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../css/main.css");
require("regenerator-runtime/runtime"); // fix a babel problem with async functions
//const initSqlJs = require("sql.js");
const sql_js_1 = __importDefault(require("sql.js"));
const game_1 = __importDefault(require("./game"));
const me_1 = __importDefault(require("./me"));
const pg_1 = require("pg");
const database_1 = require("./db/database");
const play_1 = __importDefault(require("./screens/play"));
class Bootstrap {
    constructor() {
        // pools will use environment variables
        // for connection information
        const pool = new pg_1.Pool();
        pool.query('SELECT NOW()', (err, res) => {
            console.log(err, res);
            pool.end();
        });
        // Initialize the video.
        if (!me_1.default.video.init(game_1.default.data.resolution[0], game_1.default.data.resolution[1], { wrapper: "screen", scale: "flex-width", renderer: me_1.default.video.CANVAS })) {
            alert("Your browser does not support HTML5 canvas.");
            return;
        }
        // add "#debug" to the URL to enable the debug Panel
        if (document.location.hash === "#debug") {
            console.log("show debug");
            window.addEventListener("load", () => {
                me_1.default.plugin.register.defer(this, me_1.default.debug.Panel, "debug", me_1.default.input.KEY.V);
            });
        }
        // Initialize the audio.
        me_1.default.audio.init("mp3,ogg,wav");
        // Set a callback to run when loading is complete.
        me_1.default.loader.onload = this.loaded.bind(this);
        // Load the resources.
        me_1.default.loader.preload(game_1.default.data.resources, this.loaded.bind(this));
        //me.loader.preload({});
        // Initialize melonJS and display a loading screen.
        me_1.default.state.change(me_1.default.state.LOADING);
    }
    async loaded() {
        //me.state.set(me.state.MENU, new TitleScreen());
        const SQL = await sql_js_1.default({
        // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
        // You can omit locateFile completely when running in node
        //locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });
        this.db = await new database_1.DBFactory().createSqliteDB();
        me_1.default.state.set(me_1.default.state.PLAY, new play_1.default(this.db));
        // add our player entity in the entity pool
        //me.pool.register("mainPlayer", PlayerEntity);
        // Start the game.
        me_1.default.state.change(me_1.default.state.PLAY);
    }
    static boot() {
        const bootstrap = new Bootstrap();
        // Mobile browser hacks
        if (me_1.default.device.isMobile) {
            // Prevent the webview from moving on a swipe
            window.document.addEventListener("touchmove", function (e) {
                e.preventDefault();
                window.scroll(0, 0);
                return false;
            }, false);
            me_1.default.event.subscribe(me_1.default.event.WINDOW_ONRESIZE, () => {
                window.scrollTo(0, 1);
            });
        }
        return bootstrap;
    }
}
window.addEventListener("load", () => {
    Bootstrap.boot();
});
