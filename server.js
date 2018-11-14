// server.js
// where your node app starts

// init project
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const uuidv4 = require('uuid/v4');

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

let users = [];

function sendToUser(target, msg) {
  const userList = users.filter(user => user.name === target);
  
  if (userList) {
    // if there are multiple users with the same username
    // we grab the first instance
    const userID = userList[0].id;
    io.to(userID).emit('message', msg);
  }
}

function addNewUser(user, userID) {
  const newUser = {
    name: user.name,
    id: userID,
    date: user.date,
  };

  users = users.concat(newUser);
  io.emit('users', JSON.stringify({ users }));
}

function removeUser(userID) {
  users = users.filter(user => user.id !== userID);
  io.emit('users', JSON.stringify({ users }));
}

io.on('connection', function(socket) {
  console.info('socket connected');
  
  let userID = socket.id;
      
  socket.on('disconnect', () => {
    removeUser(userID);
  });
  
  socket.on('message', (msg) => {
    const msgJSON = JSON.parse(msg);
    
    if (msgJSON.target) {
      console.log('sending message to: ', msgJSON.target);
      sendToUser(msgJSON.target, msgJSON);
    } else {
      io.emit('message', msgJSON);
    }
    
    switch(msgJSON.type) {
      case 'username':
      addNewUser(msgJSON, userID);
    }
  });
});

// listen for requests :)
const listener = server.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
