const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage
let users = [];
let messages = [];
let rooms = [];

/**
 * User connection and authentication
 */
io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    /**
     * User joins the app
     */
    socket.on('user_join', (userData) => {
        const user = {
            id: socket.id,
            username: userData.username,
            avatar: userData.avatar || '',
            status: 'online',
            joinedAt: new Date()
        };
        users.push(user);
        io.emit('user_online', user);
        io.emit('users_list', users);
        console.log('User joined:', userData.username);
    });

    /**
     * Private message
     */
    socket.on('private_message', (data) => {
        const message = {
            id: messages.length + 1,
            from: data.from,
            to: data.to,
            text: data.text,
            timestamp: new Date(),
            read: false
        };
        messages.push(message);
        io.to(data.to).emit('private_message', message);
        console.log('Private message sent');
    });

    /**
     * Group message
     */
    socket.on('group_message', (data) => {
        const message = {
            id: messages.length + 1,
            from: data.from,
            room: data.room,
            text: data.text,
            timestamp: new Date()
        };
        messages.push(message);
        io.to(data.room).emit('group_message', message);
        console.log('Group message sent to room:', data.room);
    });

    /**
     * Create or join room
     */
    socket.on('join_room', (data) => {
        socket.join(data.room);
        const room = {
            id: data.room,
            name: data.name || data.room,
            members: [socket.id],
            createdAt: new Date()
        };
        if (!rooms.find(r => r.id === data.room)) {
            rooms.push(room);
        }
        io.to(data.room).emit('user_joined', {
            room: data.room,
            message: `User ${data.username} joined the room`
        });
    });

    /**
     * Typing indicator
     */
    socket.on('typing', (data) => {
        socket.broadcast.emit('user_typing', {
            username: data.username,
            room: data.room
        });
    });

    /**
     * Stop typing
     */
    socket.on('stop_typing', (data) => {
        socket.broadcast.emit('user_stop_typing', {
            username: data.username,
            room: data.room
        });
    });

    /**
     * User disconnects
     */
    socket.on('disconnect', () => {
        users = users.filter(u => u.id !== socket.id);
        io.emit('user_offline', socket.id);
        io.emit('users_list', users);
        console.log('User disconnected:', socket.id);
    });

    /**
     * Error handling
     */
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

/**
 * REST API endpoints
 */

// Get all users
app.get('/api/users', (req, res) => {
    res.json({
        success: true,
        count: users.length,
        data: users
    });
});

// Get messages
app.get('/api/messages', (req, res) => {
    const { limit = 50 } = req.query;
    res.json({
        success: true,
        count: messages.length,
        data: messages.slice(-limit)
    });
});

// Get rooms
app.get('/api/rooms', (req, res) => {
    res.json({
        success: true,
        count: rooms.length,
        data: rooms
    });
});

// Health check
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        users: users.length,
        messages: messages.length,
        rooms: rooms.length,
        uptime: process.uptime()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Messaging App server running on port ${PORT}`);
});

module.exports = server;
