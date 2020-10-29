# PacmanSQL
This is an ongoing effort to implement Pacman in SQL.

## Setup
To set the game up run 

```
npm install
```

to install all dependencies. Then start the game using

```
npm run dev
```

which should start the game within your browser.

## FAQ
**Q:** Why?

**A:** Showing that using SQL as part of the game logic is viable is the topic of my PhD thesis and it therefore serves me as a proof of concept.

---

**Q:** GitHub says this repository is mainly Typescript and Javascript, how is this an SQL implementation?

**A:** All the SQL is hidden inside Typescript-strings, which is not picked up by GitHub.

---

**Q:** I still see a lot of Typescript?

**A:** That is just the interfacing towards the player. The game itself could entirely be run within the database and controlled by submitting SQL statements to move the player around and display intermediate states. But that is just not fun! The game is implemented in SQL and driven and rendered using Typescript.

**Q:** Okay, but I *still* see some Typescript?

**A:** Alright, it is true that some functionality is still done in the frontend (for example at the time of writing: spawning actors at random locations). This is subject to change and will be moved to the database once I have finished the more pressing issues.
---