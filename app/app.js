/**
 * Module dependencies.
 */

var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , sio = require('../node_modules/socket.io');

/**
 * App.
 */

var app = express.createServer();

/**
 * App configuration.
 */

app.configure(function () {
  app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }));
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');

  function compile (str, path) {
    return stylus(str)
      .set('filename', path)
      .use(nib());
  };
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
  res.render('index', { layout: false });
});

/**
 * App listen.
 */

app.listen(process.env.PORT, function () {
  var addr = app.address();
  console.log('   app listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app)
  , nicknames = {}
  , avatars = {}
  , players = {};

io.sockets.on('connection', function (socket) {
  
  socket.on('user message', function (msg) {
    var date = new Date();
    var timestamp = date.getHours()+':'+date.getMinutes()+':'+date.getSeconds();
    socket.broadcast.emit('user message', socket.nickname, msg, timestamp);
  });

  socket.on('private message', function (to, msg) {
    var date = new Date();
    var timestamp = date.getHours()+':'+date.getMinutes()+':'+date.getSeconds();
    for(var i in to){
      socket.broadcast.to('@'+to[i]).emit('private message', socket.nickname, to[i], msg, timestamp);  
    }
    // Admin listen-all
    socket.broadcast.to('admin.private').emit('private message', socket.nickname, to[i], msg, timestamp);  
  });

  socket.on('avatar', function (x, y){
    if(avatars[socket.nickname]){
      avatars[socket.nickname]['x'] = x;
      avatars[socket.nickname]['y'] = y;
    }
    else {
      avatars[socket.nickname] = {};
      avatars[socket.nickname]['nick'] = socket.nickname;
      avatars[socket.nickname]['x'] = Math.floor(Math.random()*201);
      avatars[socket.nickname]['y'] = Math.floor(Math.random()*201);
    }
    //io.sockets.emit('avatars',avatars); // Also to self
    socket.broadcast.emit('avatars',avatars); // Others only
  });

  socket.on('nickname', function (nick, fn) {
    if (nicknames[nick]) {
      fn(true);
    } else {
      fn(false);
      nicknames[nick] = socket.nickname = nick;
      var date = new Date();
      var timestamp = date.getHours()+':'+date.getMinutes()+':'+date.getSeconds();
      socket.broadcast.emit('announcement', nick + ' connected', timestamp);
      io.sockets.emit('nicknames', nicknames);
      //socket.join('justin bieber fans');
      socket.join('@'+socket.nickname);
      players[nick]['x'] = 0;
      players[nick]['y'] = 0;

      socket.broadcast.emit('players',players);
      


    }
  });

  socket.on('move', function (direction){
    if(players[socket.nickname]){
      switch(direction) {
        case "UP":
          players[socket.nickname]['y']--;
          break;
        case "DOWN":
          players[socket.nickname]['y']++;
          break;
        case "LEFT":
          players[socket.nickname]['x']--;
          break;
        case "RIGHT":
          players[socket.nickname]['x']++;
          break;
        }
    } else {
      players[socket.nickname]['x'] = 0;
      players[socket.nickname]['y'] = 0;
    }
    socket.broadcast.emit('players',players);
  });

  socket.on('disconnect', function () {
    if (!socket.nickname) return;

    delete nicknames[socket.nickname];
    
    // Avatars need to be removed first, then deleted from global array
    avatars[socket.nickname]['del'] = true;
    socket.broadcast.emit('avatars', avatars);
    delete avatars[socket.nickname];

    var date = new Date();
    var timestamp = date.getHours()+':'+date.getMinutes()+':'+date.getSeconds();
    socket.broadcast.emit('announcement', socket.nickname + ' disconnected', timestamp);
    socket.broadcast.emit('nicknames', nicknames);
    
  });
});
