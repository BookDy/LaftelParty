document.addEventListener('DOMContentLoaded', async () => {
    const inputArea = document.getElementById('input-area');
    const statusArea = document.getElementById('status-area');
    const msgArea = document.getElementById('msg');

    // 팝업이 열리자마자 현재 연결된 상태가 있는지 체크
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (info) => {
        if (info) {
            showStatus(info.url, info.room, info.role, info.lastTime, info.isPlaying, info.title, info.episode);
        }
    });
    //팝업창에 상태 표시
    const showStatus = (url, room, role, lastTime = 0, isPlaying, title, episode) => {
        inputArea.style.display = 'none';
        statusArea.style.display = 'block';

        document.getElementById('display-url').innerText = url;
        document.getElementById('display-room').innerText = room;


        // 1. 제목 및 화수 표시
        const animeText = title ? `${title} - ${episode}` : "재생 중인 정보 없음";  //title이 있다면 애니메이션 제목과 화수를 보여주고 아니면 재생 중인 정보 없음으로 뜸.
        document.getElementById('display-anime').innerText = animeText;

        // 2. 시간 포맷팅 (00:00:00)
        const timeStr = formatTime(lastTime);

        // 3. 재생/멈춤 아이콘 및 텍스트 설정
        const statusIcon = isPlaying ? "▶️ 재생 중" : "⏸️ 일시정지";
        const roleText = role === 'host' ? '방장' : '시청자';

        // 4. 화면 출력
        document.getElementById('display-role').innerText =
            `상태: ${roleText} | ${statusIcon} (${timeStr})`;
    };
    //데이터 보내는 함수 (생성/참여 버튼 공통)
    const handleConnection = (type) => {
        const data = {
            type: type, // "TRY_CREATE" 또는 "TRY_JOIN"
            serverUrl: document.getElementById('serverUrl').value.trim(),
            room: document.getElementById('roomName').value.trim(),
            pw: document.getElementById('roomPw').value // 소문자 pw
        };

        console.log("📤 백그라운드로 보낼 데이터:", data); // 로그 추가
        msgArea.innerText = "연결 시도 중...";

        // Background에 연결 요청
        chrome.runtime.sendMessage(data, (response) => {
            if (response && response.status === "success") {
                showStatus(data.serverUrl, data.room, response.role, data.lastTime, data.isPlaying, data.title, data.episode);
            } else {
                msgArea.innerText = "실패: " + (response?.status || "응답 없음");
            }
        });
    };

    document.getElementById('createBtn').addEventListener('click', () => handleConnection("TRY_CREATE")); // 생성 버튼 클릭 시 handleConnection 함수 호출, "TRY_CREATE" 타입 전달
    document.getElementById('joinBtn').addEventListener('click', () => handleConnection("TRY_JOIN"));  //   참여 버튼 클릭 시 handleConnection 함수 호출, "TRY_JOIN" 타입 전달

    document.getElementById('leaveBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "DISCONNECT" }, () => {
            location.reload();
        });
    });

    // 실시간 업데이트를 위한 타이머 변수
    let updateInterval = null;

    // 상태를 가져와서 UI를 갱신하는 함수
    const fetchStatus = () => {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (info) => {
            if (info) {
                showStatus(
                    info.url,
                    info.room,
                    info.role,
                    info.lastTime || 0,
                    info.isPlaying || false,
                    info.title,
                    info.episode
                );
            }
        });
    };

    // 1. 팝업이 열리자마자 한 번 실행
    fetchStatus();

    // 2. 1초마다 반복 실행 (팝업이 닫히면 자동으로 멈춤)
    updateInterval = setInterval(fetchStatus, 1000);

    // 팝업이 닫힐 때 타이머 정리 (선택 사항)
    window.onunload = () => {
        clearInterval(updateInterval);
    };
});

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const displayH = h > 0 ? `${String(h).padStart(2, '0')}:` : ''; // 1시간 미만이면 '시' 생략 가능
    return `${displayH}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
