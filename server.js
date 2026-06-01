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
// ... (Phần trên giữ nguyên) ...

io.on('connection', (socket) => {
    console.log(`[+] Có người kết nối: ${socket.id}`);

    // 1. Khách hàng tham gia phòng riêng
    socket.on('join_user_room', (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);
    });

    // 2. Admin tham gia phòng tổng của Admin
    socket.on('join_admin_room', () => {
        socket.join('admin_room');
        console.log(`Admin joined admin_room`);
    });

    // 3. Xử lý tin nhắn
    socket.on('client_send_message', (data) => {
        if (data.isAdmin) {
            // Kịch bản A: Admin trả lời Khách
            // Gửi đích danh vào phòng của khách đó
            io.to(data.roomId).emit('server_broadcast_message', data);
            
            // Gửi lại cho các Admin khác cùng thấy (nếu có nhiều Admin đang trực)
            io.to('admin_room').emit('server_broadcast_message', data);
        } else {
            // Kịch bản B: Khách nhắn tin cho Admin
            // Bắn tin nhắn vào phòng Admin
            io.to('admin_room').emit('server_broadcast_message', data);
            
            // Gửi ngược lại phòng của khách để hiển thị trên màn hình của khách
            io.to(data.roomId).emit('server_broadcast_message', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Đã ngắt kết nối: ${socket.id}`);
    });
});

// ... (Phần dưới giữ nguyên) ...

// 4. Mở cổng chạy server
const PORT = process.env.PORT || 3000; // Render sẽ tự cấp PORT thông qua biến môi trường
server.listen(PORT, () => {
    console.log(`🚀 Chat Server đang chạy tại cổng ${PORT}`);
});