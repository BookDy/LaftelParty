// content.js

(function () {

    let role = null;
    let isSyncing = false;
    let video = null;


    chrome.runtime.sendMessage({ type: "CHECK_JOIN" }, (res) => {

        console.log("방 참여 여부 확인:", res);

        if (res && res.hostId) {
            console.log("참여할 방 발견:", res.hostId);
            chrome.runtime.sendMessage({ type: "TRY_JOIN" }, (res) => {
                if (res.status === "success") {
                    console.log("방 참여 성공:", res.hostId);
                } else {
                    console.warn("방 참여 실패:", res.status);
                }
            });

        }
    });

    // 1. 비디오 요소 감지
    const waitForVideo = setInterval(() => {
        const v = document.querySelector('video');
        if (v) {
            video = v;
            clearInterval(waitForVideo);
            attachVideoEvents();
        }
    }, 1000);


    function attachVideoEvents() {
        if (!video) return;
        video.onplay = () => sendEventToBackground('play');
        video.onpause = () => sendEventToBackground('pause');
        let seekTimeout = null;
        video.onseeked = () => {
            clearTimeout(seekTimeout);
            seekTimeout = setTimeout(() => {sendEventToBackground('seek'); }, 200);
        };
    }

    // 2. 백그라운드로 호스트 이벤트 전달
    function sendEventToBackground(type) {
        // 1. 동기화 중이거나 비디오 요소가 없으면 중단
        if (isSyncing || !video) return;

        // 2. 크롬 런타임이 유효한지 확인 (확장 프로그램 컨텍스트가 아닐 때 오류 방지)
        if (!chrome.runtime?.id)
        {
            console.warn("확장 프로그램 연결이 끊어졌습니다. 페이지를 새로고침하세요.");
            return;
        }

        const animeInfo = getAnimeInfo(); // 애니메이션 정보 가져오기

        // 3. 백그라운드로 메시지 전송
        chrome.runtime.sendMessage({
            type: "SEND_HOST_EVENT",
            data: {
                type: type,
                time: video.currentTime, //영상 시간정보 추가
                title: animeInfo.title, // 제목추가
                episode: animeInfo.episode // 화수 정보 추가    
            }
        }, (response) => {
            // 4. 마지막 에러 체크 (수신 측이 없거나 응답이 없을 때 발생)
            if (chrome.runtime.lastError) {
                // 이 로그가 찍힌다면 background.js에서 응답을 안 줬거나 연결이 끊긴 것임
                console.debug("전송 알림:", chrome.runtime.lastError.message);
                return;
            }

            // 백그라운드에서 보낸 응답 확인 (디버깅용)
            if (response && response.status === "success") {
                console.log(`${type} 이벤트 전송 완료`);
            }
        });
    }

    // 3. 백그라운드로부터 오는 동기화 명령 수신
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === "video_sync" && video) {
            const data = msg.data;
            //굳이 필요한가? 아닌거 같은데
            //chrome.runtime.sendMessage({
            //    type: "UPDATE_INFO",
            //    data: {
            //        title: data.title,
            //        episode: data.episode,
            //        isPlaying: data.playing,
            //        time: data.time
            //    }
            //});
            if (!isSyncing) {
                isSyncing = true;

                video.currentTime = data.time;

                if (data.type === "play") {
                    video.play().catch(() => { console.warn("자동 재생이 차단되었습니다. 화면을 한 번 클릭해주세요."); });
                } else if (data.type === "pause") {
                    video.pause();
                }
                console.log(`동기화: ${data.type==="play" ? "재생" : "일시정지"}, 시간: ${data.time}`);

                const syncingInterval = setTimeout(() => { isSyncing = false; clearInterval(syncingInterval); }, 800);
                
                sendResponse({ status: "success", receivedTime: data.time });
            } else {
                // 비디오를 못 찾았거나 타입이 다를 때도 응답은 보냅니다.
                sendResponse({ status: "ignored" });
            }

            return true;
            }
            
    });
    


    // 4. 애니메이션 정보 가져오기
    function getAnimeInfo() {
        // 라프텔 페이지 구조에 따라 선택자는 변경될 수 있습니다. 
        // 보통 h1이나 특정 클래스명을 가진 요소에 제목이 있습니다.
        const titleElement = document.querySelector('.sc-64c05df2-6');
        const episodeElement = document.querySelector('.sc-64c05df2-7');

        return {
            title: titleElement ? titleElement.innerText.trim() : "제목 없음",
            episode: episodeElement ? episodeElement.innerText.trim() : "정보 없음"
        };
    }
})();