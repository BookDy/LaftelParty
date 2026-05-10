const http = require('http');
const { Server } = require("socket.io");

const rooms = {};

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('🚀 라프텔 파티 서버가 정상 작동 중입니다!');
});

const io = require("socket.io")(server, {
    cors: {
        origin: true, // 요청이 온 곳을 자동으로 허용
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true // 이전 버전 호환성 허용 (혹시 모를 라이브러리 버전 차이 대비)
});

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const displayH = h > 0 ? `${String(h).padStart(2, '0')}:` : ''; // 1시간 미만이면 '시' 생략 가능
    return `${displayH}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

io.on("connection", (socket) => {
    console.log(`\n[접속] 새로운 사용자 연결됨 (ID: ${socket.id})`);

    // 1. 방 생성 로그 추가
    socket.on("create_room", ({ room, pw }, callback) => {

        console.log(`\n[방 생성 시도]`);
        console.log(`- 방 이름: ${room}`);
        console.log(`- 비밀번호: ${pw}`);
        console.log(`- 생성자 ID: ${socket.id}`);

        if (rooms[room]) {
            console.log(`  => 결과: 실패 (이미 존재하는 방 이름)`);
            return callback({ status: "exists" });
        }

        rooms[room] = {
            password: pw,
            hostId: socket.id,
            lastState: { time: 0, playing: false }
        };

        socket.join(room);
        console.log(`  => 결과: 성공 (방 생성 완료)`);
        callback({ status: "success", role: "host" });
    });

    // 2. 방 참여 로그 추가
    socket.on("join_room", ({ room, pw }, callback) => {
        console.log(`\n[방 참여 시도]`);
        console.log(`- 방 이름: ${room}`);
        console.log(`- 입력 비번: ${pw}`);
        console.log(`- 참여자 ID: ${socket.id}`);

        const targetRoom = rooms[room];

        if (!targetRoom) {
            console.log(`  => 결과: 실패 (존재하지 않는 방)`);
            return callback({ status: "no_room" });
        }

        if (targetRoom.password !== pw) {
            console.log(`  => 결과: 실패 (비밀번호 불일치)`);
            return callback({ status: "wrong_pw" });
        }

        socket.join(room);
        console.log(`  => 결과: 성공 (시청자로 참여 완료)`);
        callback({ status: "success", role: "viewer" });
    });

    // 상태 전송 로그 (선택 사항: 로그가 너무 많으면 삭제하세요)
    socket.on("host_event", (data) => {
        const roomData = rooms[data.room];
        if (roomData && roomData.hostId === socket.id) {
            roomData.lastState = { time: data.time, playing: data.type === 'play' };
            socket.to(data.room).emit("video_sync", data);
            console.log(`[이벤트] ${data.room} 방 동기화: ${data.type} at ${data.time}s`);
        }
    });

    socket.on("disconnect", () => {
        for (const room in rooms) {
            if (rooms[room] && rooms[room].hostId === socket.id) {
                console.log(`\n[방 삭제] 방장이 나감: ${room}`);
                delete rooms[room];
            }
        }
        console.log(`[퇴장] 사용자 연결 종료 (ID: ${socket.id})`);
    });

        // (선택 사항) 만약 파일이나 DB에 저장하고 싶다면 여기서 처리합니다

});

server.listen(3000, () => {
    console.log("========================================");
    console.log("✅ 라프텔 파티 서버가 3000번 포트에서 시작되었습니다.");
    console.log("========================================");
});
