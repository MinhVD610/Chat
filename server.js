const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 1. Cấu hình CORS cho Express
app.use(cors());

const server = http.createServer(app);

// 2. Cấu hình Socket.io và cấp phép cho domain InfinityFree của bạn
const io = new Server(server, {
    cors: {
        origin: "*", // Khi deploy thực tế, hãy thay "*" bằng URL web InfinityFree của bạn để bảo mật (VD: "http://moji.infinityfreeapp.com")
        methods: ["GET", "POST"]
    }
});

// 3. Lắng nghe các kết nối
io.on('connection', (socket) => {
    console.log(`[+] Người dùng kết nối: ${socket.id}`);

    // Lắng nghe tin nhắn từ Client (Khách hàng hoặc Admin) gửi lên
    socket.on('client_send_message', (data) => {
        console.log("Server nhận được:", data);

        // Bắn tin nhắn này tới TẤT CẢ mọi người đang online (kể cả người gửi)
        io.emit('server_broadcast_message', data);
    });

    socket.on('disconnect', () => {
        console.log(`[-] Người dùng ngắt kết nối: ${socket.id}`);
    });
});

// 4. Mở cổng chạy server
const PORT = process.env.PORT || 3000; // Render sẽ tự cấp PORT thông qua biến môi trường
server.listen(PORT, () => {
    console.log(`🚀 Chat Server đang chạy tại cổng ${PORT}`);
});