const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

//const app = express();
//const server = http.createServer(app);
//const io = socketIo(server);

const app = express();
app.use(cors());
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, 'public')));

// Serve home.html for home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve chat.html for chat page
app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/logo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'logo.png'));
});

app.get('/minilogo.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'minilogo.png'));
});

// Store connected users
const users = {};
let availableSockets = [];
const activeChats = {}; // Store active chats
let chatCount = 0; //Contatore Utenti attivi

// Generate unique chat ID
function generateChatId() {
    return Math.random().toString(36).substr(2, 9);
}

// Get chat ID by user ID
function getChatIdByUserId(userId) {
    for (const chatId in activeChats) {
        if (activeChats[chatId].users.includes(userId)) {
            return chatId;
        }
    }
    return null;
}

// Handle socket connections
io.on('connection', (socket) => {

    // Add socket to availableSockets list
    availableSockets.push(socket);

    // Handle joining chat
    socket.on('join', ({ token }) => {
        const userId = socket.id;
        users[userId] = { token };
        
        // Check if there are available sockets to start chat
        if (availableSockets.length >= 2) {
            // Get two available sockets
            const socket1 = availableSockets.shift();
            const socket2 = availableSockets.shift();

            // Notify the users
            socket1.emit('chatStart', 'Chat started!');
            socket2.emit('chatStart', 'Chat started!');

            // Generate unique chat ID
            const chatId = generateChatId();
            activeChats[chatId] = {
                users: [socket1.id, socket2.id], // Store user IDs in the chat
                connected: true // Initial state: chat connected
            };

            //Chat Count
            const keys=Object.keys(activeChats);
            chatCount=keys.length;
            chatCount=chatCount*2;
            console.log("Chat Count: "+chatCount);
            app.get('/chatcount', (req, res) => {
                res.send({ chatCount: chatCount });
            });

            // Remove sockets from availableSockets list
            const index1 = availableSockets.indexOf(socket1);
            if (index1 !== -1) availableSockets.splice(index1, 1);
            const index2 = availableSockets.indexOf(socket2);
            if (index2 !== -1) availableSockets.splice(index2, 1);
        } else {
            // Notify the user that they need to wait
            socket.emit('waiting', 'Searching for another user...');
        }
    });

    // Handle sending messages
    socket.on('message', (message) => {
        const userId = socket.id;
    
        // Get chat ID of the user
        const chatId = getChatIdByUserId(userId);
    
        // Send the message only to users in the same chat
        if (chatId) {
            activeChats[chatId].users.forEach(user => {
                const sender = user === userId ? 'You' : 'Stranger';
                io.to(user).emit('message', `${sender}: ${message}`);
            });
        }
    });

    // Handle disconnection request from client
    socket.on('disconnectUser', () => {
        const userId = socket.id;
        console.log(`User disconnected`);

        // Get chat ID of the user
        const chatId = getChatIdByUserId(userId);

        if (chatId) {
            // Set connection status of the chat to false
            activeChats[chatId].connected = false;

            // Notify the remaining users in the chat about the disconnection
            const remainingUsers = activeChats[chatId].users.filter(user => user !== userId);
            remainingUsers.forEach(user => {
                io.to(user).emit('LeaveMessage', 'Your chat partner has left the chat');
                io.to(user).emit('message', `*_EXIT_ALL_*`);
                // Perform other necessary actions to handle disconnection in the current chat
            });
            // Confirm disconnection to the disconnected user
        socket.emit('disconnectConfirmed');

            // Remove the chat from the list of active chats if both users have disconnected
             delete activeChats[chatId];   
             const keys=Object.keys(activeChats);
             chatCount=keys.length;
             chatCount=chatCount*2;
             console.log("Chat Count: "+chatCount);
             app.get('/chatcount', (req, res) => {
                 res.send({ chatCount: chatCount });
             });
        }

        // Remove user from users list
        delete users[userId];

        // Remove socket from availableSockets list
        const index = availableSockets.indexOf(socket);
        if (index !== -1) availableSockets.splice(index, 1);
    });

    socket.on('backHomeUser', () => {
        const userId = socket.id;
        console.log(`User disconnected`);
        

        // Remove socket from availableSockets list
        const index = availableSockets.indexOf(socket);
        if (index !== -1) availableSockets.splice(index, 1);

    });

    // Gestisci richiesta per indicare che l'utente non è più in attesa
    socket.on('leaveWaitingList', () => {
        const userId = socket.id;
    const index = availableSockets.findIndex(s => s.id === socket.id);
    if (index !== -1) {
        availableSockets.splice(index, 1);
    }
    delete users[userId];
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
