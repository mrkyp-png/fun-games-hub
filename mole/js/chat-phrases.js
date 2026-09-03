(function (root) {
  'use strict';
  // 홈 화면 대화 문구 풀 — 언어별. 재방문 시 두더지 오빠 한 줄 + 하마 답.
  // i18n-strings.js 의 key-value 와 달리 "랜덤 풀" 이라 여기 배열로 둔다.
  // 언어 추가: 그 코드로 배열 3개(return/hippo/retry) 추가. 없으면 en → ko 폴백.

  var DATA = {
    ko: {
      returns: [
        '왔어?', '왜 이제 와', '빨리 와', '늦었네', '기다렸잖아', '왔구나 ㅎㅎ', '또 왔네', '오늘도 오셨네',
        '딱 맞춰 왔다', '잠깐 시간 돼?', '5분만 하자', '한 판만', '딱 한 판만 진짜', '겜 ㄱ?',
        '보고싶었어', '나 안 보고싶었어?', '답장 좀 하지', '왜 안 읽어', '어제 왜 씹었어', '나 삐졌어',
        '화 안 났어', '요즘 뭐 하고 지내', '연락 좀 하자', '요즘 바빠?', '나만 안 바쁜가 봐', '오늘 하루 어땠어',
        '힘든 일 있었어?', '얘기 들어줄게', '오빠가 있잖아', '옆에 있어 줄게', '무슨 일 있으면 말해',
        '준비됐어?', '손 풀었어?', '컨디션 어때', '오늘 각 나온다', '느낌 좋아', '오늘은 신기록이야',
        '넌 할 수 있어', '오빠가 믿는다', '가보자고', '두더지 떨고 있어', '걔네 오늘 각오해', '살살 안 봐줄 거지?',
        '다 때려잡자', '몇 마리 목표야?', '최고 기록 깨자', '오늘 미친 척 하자', '집중 모드 ON',
        '자신 있어?', '지난번 그 점수 뭐야', '오늘은 좀 하냐', '또 질 거야?', '내기할까', '지면 뭐 해줄 거야',
        '겁먹었어?', '손 떨고 있네', '긴장했지', '이번엔 다르다며', '말만 하지 말고',
        '밥 먹었어?', '잠은 잤어?', '커피 마셨어?', '날씨 좋더라', '주말이다 ㅎㅎ', '월요일 화이팅',
        '오늘 금요일이야', '비 온대 우산 챙겨', '환절기 감기 조심', '물 좀 마셔',
        '회사지 지금?', '팀장 뒤에 있어?', '걸리지 마', '소리 껐지?', '화면 밝기 낮춰', '통화하는 척 해',
        '이거 업무 전화야', '완벽한 위장이지', '아무도 몰라 이게 게임인지', '상사 오면 통화 버튼',
        '근무 시간엔 조용히', '딴짓 아니야 이거',
        '두더지들이 파업했대', '오늘 운세 대박이래', '나 꿈에 나왔어?', '로또 번호 불러줄까', '두더지 왕이 화났어',
        '우리 전생에 봤나?', 'MBTI 뭐야 너', '갑자기 배고프다', '두더지가 안부 전해달래', '오늘 밤에 별똥별 온대'
      ],
      hippo: ['ㅇㅇ', 'ㄱㄱ', '감', '...', '해', 'ㅇㅋ', '뭐', '왜', 'ㅎ', '바빠', '조용히 해', '알겠어'],
      retry: { best: '미쳤다 신기록!', clear: '잘했어!', bad: 'ㅋㅋ 그럴 수 있어' }
    },
    en: {
      returns: [
        "you're back?", 'finally', 'come on', "you're late", 'been waiting', 'oh hey', 'again huh', 'here again',
        'right on time', 'got a sec?', "let's do 5 min", 'one round', 'one round for real', 'game?',
        'missed you', "didn't you miss me?", 'text me back sometime', 'why no reply', 'you left me on read', "i'm sulking",
        "i'm not mad", 'what have you been up to', "let's talk more", 'busy lately?', 'guess only i have time', 'how was your day',
        'rough day?', "i'll listen", "i've got you", "i'm right here", 'tell me if something is up',
        'ready?', 'warmed up?', 'how you feeling', "today's the day", 'good vibes', "today's a record",
        'you can do this', 'i believe in you', "let's go", 'the moles are shaking', 'they should be scared', 'no mercy right?',
        'whack them all', "what's the target?", 'beat your best', 'go a little wild today', 'focus mode ON',
        'feeling confident?', "what was that score last time", 'any good today?', 'gonna lose again?', 'wanna bet?', 'what do i get if you lose',
        'scared?', 'your hands are shaking', 'nervous huh', 'you said this time is different', 'less talk',
        'did you eat?', 'did you sleep?', 'had coffee?', 'nice weather', "it's the weekend", 'monday, you got this',
        "it's friday", 'rain later, bring an umbrella', "don't catch a cold", 'drink some water',
        'at work right now?', 'is your boss behind you?', "don't get caught", 'sound off?', 'lower your brightness', 'pretend to be on a call',
        "this is a work call", 'perfect cover', 'nobody knows this is a game', 'boss coming? hit the call button',
        'stay quiet during work hours', "this isn't slacking",
        'the moles went on strike', 'your fortune is great today', 'you were in my dream', 'want your lucky numbers?', 'the mole king is angry',
        'have we met in a past life?', "what's your MBTI", 'suddenly hungry', 'a mole says hi', 'shooting stars tonight'
      ],
      hippo: ['k', 'kk', 'ok', '...', 'fine', 'yep', 'what', 'why', 'lol', 'busy', 'shush', 'got it'],
      retry: { best: 'insane, new record!', clear: 'nice one!', bad: 'lol it happens' }
    }
  };

  function forLang(l) { return DATA[l] || DATA.en || DATA.ko; }
  function cur() { return (root.FGH && root.FGH.I18N) ? root.FGH.I18N.lang : 'en'; }

  var api = {
    returnPhrases: function () { return forLang(cur()).returns; },
    hippoReplies: function () { return forLang(cur()).hippo; },
    retryText: function (kind) { return forLang(cur()).retry[kind] || forLang(cur()).retry.clear; }
  };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ChatPhrases = api; }
})(typeof window !== 'undefined' ? window : null);
