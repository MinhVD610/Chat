require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose'); // Thêm thư viện Mongoose

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Khởi tạo AI với API Key của bạn
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


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
const mongoURI = process.env.MONGODB_URI;


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

    socket.on('client_send_message', async (data) => {
        // 1. Lưu tin nhắn của khách/admin vào MongoDB (Giữ nguyên logic cũ của bạn)
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

        // 2. PHÂN LUỒNG XỬ LÝ AI vs NGƯỜI THẬT
        // Kiểm tra xem khách có gọi @AI không (chỉ xử lý nếu không phải là admin nhắn)
        if (!data.isAdmin && data.message.toLowerCase().startsWith("@ai ")) {
            
            // Phát sóng câu hỏi của khách cho mọi người thấy trước
            io.to('admin_room').emit('server_broadcast_message', data);
            io.to(data.roomId).emit('server_broadcast_message', data);

            try {
                // Tách lấy nội dung câu hỏi (Bỏ chữ @ai đi)
                const userQuestion = data.message.substring(4);
                
                // Nhồi thêm bối cảnh để AI nhập vai xuất sắc hơn
                const prompt = `Bạn là một nhân viên tư vấn thời trang sành điệu của cửa hàng quần áo VieStall. 
                Hãy trả lời câu hỏi sau của khách hàng một cách ngắn gọn, lịch sự, thân thiện và mang đậm phong cách Gen Z. 
                Câu hỏi của khách: ${userQuestion}`;

                // Gọi Google Gemini trả lời
                const result = await aiModel.generateContent(prompt);
                const aiResponseText = result.response.text();

                // Đóng gói câu trả lời của AI thành dạng tin nhắn của Admin
                const aiMessageData = {
                    isAdmin: true,            
                    roomId: data.roomId, 
                    sender: "VieStall AI Bot 🤖", // Tên hiển thị của AI
                    message: aiResponseText
                };

                // Lưu câu trả lời của AI vào MongoDB để giữ lịch sử
                await new Chat(aiMessageData).save();

                // Bắn câu trả lời của AI về cho Khách và Admin cùng xem
                io.to(data.roomId).emit('server_broadcast_message', aiMessageData);
                io.to('admin_room').emit('server_broadcast_message', aiMessageData);

            } catch (aiError) {
                console.error("Lỗi khi gọi AI:", aiError);
            }

        } else {
            // Nếu không gọi @AI thì phát sóng tin nhắn bình thường giữa Admin và Khách
            if (data.isAdmin) {
                io.to(data.roomId).emit('server_broadcast_message', data);
                io.to('admin_room').emit('server_broadcast_message', data);
            } else {
                io.to('admin_room').emit('server_broadcast_message', data);
                io.to(data.roomId).emit('server_broadcast_message', data);
            }
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
      