killall -9 node;
xterm -e "cd $PWD/backend && docker-compose up" &  xterm -e "cd $PWD/backend && npm run watch-node" & xterm -e "cd $PWD/frontend && npm run start:dev"