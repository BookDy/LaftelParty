// background.js
try {
    importScripts('./socket.io.min.js'); // 파일이 같은 폴더에 있어야 함
} catch (e) {
    console.error("라이브러리 로드 실패:", e);
}

let socket = null;
let currentInfo = null;     //상태 저장용
let timerInterval = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    console.log("받은 메시지:", msg); //디버깅용로그
    // 1. 상태 확인
    if (msg.type === "GET_STATUS") {
        sendResponse(currentInfo);
        return true;
    }

    // 2. 서버 연결 시도 (생성/참여)
    if (msg.type === "TRY_JOIN" || msg.type === "TRY_CREATE") {
        console.log("1. 연결 시도 메시지 수신:", msg); // 확인용 로그

        try {
            if (typeof io === "undefined") {
                console.error("2. 에러: io 라이브러리가 로드되지 않음");
                sendResponse({ status: "error", message: "라이브러리 로드 실패" });
                return true;
            }

            if (socket) socket.disconnect(); // 기존 연결이 있으면 끊기; 

            socket = io(msg.serverUrl, {
                reconnection: true,                 //끊겼을 때 자동 재연결 활성화
                extraHeaders: {
                    "Bypass-Tunnel-Reminder": "true" // ngrok 우회 헤더 (필요한 경우)"
                },
                transports: ['websocket']
            });

            socket.once("connect", () => {
                console.log("3.서버와 진짜로 연결됨! ID:", socket.id);

                // [추가] 서버에서 보내는 동기화 이벤트를 직접 감시해야 합니다!
                socket.on("video_sync", (serverData) => {
                    console.log("서버로부터 동기화 신호 수신:", serverData);


                    currentInfo.lastTime = serverData.time;
                    currentInfo.isPlaying = serverData.type === 'play';
                    currentInfo.title = serverData.title; // 제목 업데이트
                    currentInfo.episode = serverData.episode; // 화수 업데이트

                    // 재생 상태에 따라 백그라운드 자체 타이머 가동
                    clearInterval(timerInterval);

                    if (currentInfo.isPlaying) {
                        timerInterval = setInterval(() => {
                            if (currentInfo) currentInfo.lastTime += 1;
                        }, 1000);
                    }

                    // 현재 라프텔 탭을 찾아 전송
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            //탭의 URL이 라프텔인지 확인, tab .url이 undefined일 수 있으므로 안전하게 체크
                            if (tab.url && tab.url.includes("laftel.net")) {
                                console.log(`라프텔 탭 발견 (ID: ${tab.id}), 메시지 전송 중...`);

                                chrome.tabs.sendMessage(tab.id, {
                                    type: "video_sync", // 컨텐트 스크립트가 기다리는 타입명
                                    data: serverData     // 서버에서 받은 {time, playing, title...} 객체
                                }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        // Content Script가 아직 로드 안 됐거나 페이지가 유효하지 않을 때 발생
                                        console.warn(`탭 ${tab.id} 전송 실패:`, chrome.runtime.lastError.message);
                                    } else {
                                        console.log(`탭 ${tab.id} 동기화 성공!`);
                                        console.log("탭 응답:", response); // 디버깅용 응답 로그
                                    }
                                });
                            }
                        });
                    });
                });

                const event = msg.type === "TRY_CREATE" ? "create_room" : "join_room";
                socket.emit(event, { room: msg.room, pw: msg.pw }, (res) => {
                    console.log("서버 응답 도착:", res);

                    currentInfo = {
                        url: msg.serverUrl,
                        room: msg.room,
                        role: res.role // 서버에서 내려주는 역할 (host/viewer)
                    };

                    sendResponse(res);
                });
            });

            socket.once("connect_error", (err) => {
                console.error("서버 연결 실패:", err.message);
                sendResponse({ status: "error", message: "서버 연결 실패" });
            });

            return true;
        } catch (e) {
            console.error("런타임 에러 발생:", e);
            sendResponse({ status: "error", message: e.message });
        }
        return true;
    }





    // 3. 호스트 이벤트 전송 (이 로직은 반드시 addListener 내부에 있어야 함)
    if (msg.type === "SEND_HOST_EVENT") {

        console.log("보낼 데이터 확인", msg.data); //디버깅용로그

        if (socket && currentInfo?.role === 'host') {       //호스트인지 확인. currentInfo가 null일 때 오류 방지 위해 옵셔널 체이닝 사용(?붙인것)

            currentInfo.lastTime = msg.data.time;
            currentInfo.isPlaying = (msg.data.type === 'play');
            currentInfo.title = msg.data.title; // 제목 업데이트
            currentInfo.episode = msg.data.episode; // 화수 업데이트

            clearInterval(timerInterval);

            if (currentInfo.isPlaying) {
                timerInterval = setInterval(() => {
                    if (currentInfo) currentInfo.lastTime += 1;
                }, 1000);
            }

            //서버로 전송
            socket.emit("host_event", {
                room: currentInfo.room,
               ...msg.data
            });
            sendResponse({ status: "success" });
            
        }
        return true;
     }
        
    

    

    // 4. 접속 해제
    if (msg.type === "DISCONNECT") {
        if (socket) { socket.disconnect(); socket = null; currentInfo = null; }
        sendResponse({ status: "success" });
        return true;
    }

    return true;


    //굳이 필요한가? 어차피 서버 동기화 신호 오면 동기화 됨.
    //// background.js의 메시지 리스너 안에 추가
    //if (msg.type === "UPDATE_INFO") {
    //    if (currentInfo) {
    //        currentInfo.title = msg.data.title;
    //        currentInfo.episode = msg.data.episode;
    //    }
    //}


});
