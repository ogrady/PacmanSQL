# PacmanSQL
This is an ongoing effort to implement Pacman in SQL.

## FAQ
**Q:** Why?
**A:** Showing that using SQL as part of the game logic is viable is the topic of my PhD thesis and it therefore serves me as a proof of concept.

**Q:** GitHub says this repository is mainly Typescript and Javascript, how is this an SQL implementation?
**A:** All the SQL is hidden inside Typescript-strings, which is not picked up by GitHub.

**Q:** I still see a lot of Typescript?
**A:** That is just the interfacing towards the player. The game itself could entirely be run within the database and controlled by submitting SQL statements to move the player around and display intermediate states. But that is just not fun! The game is implemented in SQL and driven and rendered using Typescript.