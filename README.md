# PacmanSQL
This is an ongoing effort to implement Pacman in SQL.

## Setup

### Installation
Installation of dependencies for frontend and backend:

```
cd frontend; npm install; cd ../backend; npm install
```

### Frontend Bundling

Install `webpack` globally and bundle the frontend:

```
npm i webpack webpack-cli -g; cd frontend; webpack
```

### Running
 Then start the game using

```
cd backend; npm run dev
```


### Developing
Run both frontend and backend continously from two terminals:

```
cd frontend; npm run pack
```
and

```
cd backend; npm run dev
```


## FAQ
**Q:** Why?

**A:** Showing that using SQL as part of the game logic is viable is the topic of my PhD thesis and it therefore serves me as a proof of concept.

---

**Q:** GitHub says this repository is mainly Typescript and Javascript, how is this an SQL implementation?

**A:** A lot of the SQL is hidden inside Typescript-strings, which is not picked up by GitHub. But the core functionality is placed in the `src/db/sql` directory in the backend.

---

**Q:** I still see a lot of Typescript?

**A:** That is just the interfacing towards the player. The game itself could entirely be run within the database and controlled by submitting SQL statements to move the player around and display intermediate states. But that is just not fun! The game is implemented in SQL and driven and rendered using Typescript.

---

**Q:** Okay, but I *still* see some Typescript?

**A:** Alright, it is true that some functionality is still done in the frontend (for example at the time of writing: spawning actors at random locations). This is subject to change and will be moved to the database once I have finished the more pressing issues.

## Notes to Self
To start developing, do the following:

1) Make sure Postgres is running: `cd backend && docker-compose up`
2) Put backend into watch mode: `cd backend && npm run watch-ts`
3) If working on the frontend, put it into watch mode as well to trigger re-bundling: `cd frontend && npm run start:dev`
4) http://127.0.0.1:3000