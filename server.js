const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose'); // Thêm thư viện Mongoose

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://vietstallminh.site.je", "https://vietstallminh.site.je"],
        methods: ["GET", "POST"]
    }
});

// ==========================================
// KẾT NỐI MONGODB VÀ TẠO SCHEMA
// ==========================================
// TODO: Thay chuỗi này bằng URI thật của bạn
const mongoURI = "mongodb+srv://minhnc2k4_db_user:CKal1g9AycPWUJ2J@cluster0.8dp4hpy.mongodb.net/?appName=Cluster0";


mongoose.connect(mongoURI)
    .then(() => console.log('🟢 Đã kết nối thành công tới MongoDB!'))
    .catch(err => console.error('🔴 Lỗi kết nối MongoDB:', err));

// Định nghĩa cấu trúc lưu trữ tin nhắn
const chatSchema = new mongoose.Schema({
    roomId: String,       // Mã phòng (để biết tin nhắn của user nào)
    sender: String,       // Người gửi (Khách hoặc Admin)
    message: String,      // Nội dung
    isAdmin: Boolean,     // Phân loại vai trò
    timestamp: { type: Date, default: Date.now } // Thời gian tự động
});

const Chat = mongoose.model('Chat', chatSchema);
// ==========================================

io.on('connection', (socket) => {
    console.log(`[+] Có người kết nối: ${socket.id}`);

    // Khách hàng tham gia phòng
    socket.on('join_user_room', async (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);

        // [TÍNH NĂNG MỚI] Lấy lịch sử chat cũ từ DB và gửi lại cho khách
        try {
            const history = await Chat.find({ roomId: roomId }).sort({ timestamp: 1 });
            socket.emit('load_chat_history', history);
        } catch (error) {
            console.error("Lỗi tải lịch sử chat:", error);
        }
    });

    // Admin tham gia phòng
    socket.on('join_admin_room', () => {
        socket.join('admin_room');
        console.log(`Admin joined admin_room`);
    });

    // [TÍNH NĂNG MỚI] Admin yêu cầu xem lịch sử của một khách cụ thể
    socket.on('admin_load_history', async (roomId) => {
        try {
            const history = await Chat.find({ roomId: roomId }).sort({ timestamp: 1 });
            socket.emit('load_chat_history', history);
        } catch (error) {
            console.error("Lỗi tải lịch sử cho Admin:", error);
        }
    });

    // Xử lý khi có tin nhắn mới
    socket.on('client_send_message', async (data) => {
        // [TÍNH NĂNG MỚI] Lưu tin nhắn vào MongoDB trước khi phát sóng
        try {
            const newChat = new Chat({
                roomId: data.roomId,
                sender: data.sender,
                message: data.message,
                isAdmin: data.isAdmin
            });
            await newChat.save();
        } catch (error) {
            console.error("Lỗi lưu tin nhắn:", error);
        }

        // Phát sóng tin nhắn (Giữ nguyên logic cũ)
        if (data.isAdmin) {
            io.to(data.roomId).emit('server_broadcast_message', data);
            io.to('admin_room').emit('server_broadcast_message', data);
        } else {
            io.to('admin_room').emit('server_broadcast_message', data);
            io.to(data.roomId).emit('server_broadcast_message', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Đã ngắt kết nối: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Chat Server đang chạy tại cổng ${PORT}`);
});

// ["http://vietstallminh.site.je", "https://vietstallminh.site.je"],
      