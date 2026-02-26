---
name: n8n-gotchas
description: Use when configuring n8n nodes via MCP tools, debugging n8n workflow issues, or encountering unexpected node behavior. Covers real-world pitfalls with updateNode, Telegram, IF, Wait nodes, Coolify deployment, and credential management.
---

# n8n 실전 삽질 기록

n8n 노드를 MCP 도구로 다루면서 겪은 실제 함정들. 새로운 삽질을 겪을 때마다 여기에 추가한다.

---

## MCP 도구 관련

### updateNode는 파라미터를 덮어쓴다 (merge 아님)

`updateNode`로 `chatId`만 바꾸려고 `parameters: { chatId: "123" }`을 보내면, **기존 text, replyMarkup 등이 전부 사라진다.** 항상 전체 parameters를 보내야 한다.

```javascript
// ❌ chatId만 보냄 → text, inlineKeyboard 등 소실
{ "parameters": { "chatId": "123" } }

// ✅ 전체 parameters를 항상 포함
{ "parameters": { "operation": "sendMessage", "chatId": "123", "text": "메시지 내용", "replyMarkup": "inlineKeyboard", "inlineKeyboard": { ... } } }
```

### 한국어 노드 이름 인코딩 실패 (updateNode, moveNode 등)

`name: "저녁 9시까지 대기"` 같은 한국어 이름이 빈 문자열로 전달될 수 있다. `updateNode`뿐 아니라 `moveNode` 등 이름으로 노드를 참조하는 모든 작업에서 발생한다. **항상 nodeId를 사용**하라.

```javascript
// ❌ 이름으로 지정 → 인코딩 문제 (updateNode, moveNode 등 모두)
{ "type": "updateNode", "name": "저녁 9시까지 대기", ... }
{ "type": "moveNode", "name": "Claude Proxy", ... }  // 영문도 실패하는 경우 있음

// ✅ nodeId로 지정
{ "type": "updateNode", "nodeId": "b1000000-0005-4000-8000-000000000005", ... }
{ "type": "moveNode", "nodeId": "a1000001-0007-4000-8000-000000000007", ... }
```

---

## Telegram 노드

### 인라인 키보드: callback_data는 snake_case + additionalFields 안에

`callbackData`(camelCase) 직접 사용 → 버튼이 안 나옴. `additionalFields.callback_data`(snake_case) 사용해야 한다.

```javascript
// ❌ 버튼 안 나옴
{ "text": "전기자전거", "callbackData": "ebike" }

// ✅ 정상 작동
{
  "inlineKeyboard": {
    "rows": [{
      "row": {
        "buttons": [{
          "text": "전기자전거 🚲",
          "additionalFields": { "callback_data": "ebike" }
        }]
      }
    }]
  }
}
```

### Telegram Trigger: webhook은 HTTPS 필수

Telegram Bot API는 HTTP webhook을 거부한다. `WEBHOOK_URL`이 `https://`인지 확인.

---

## IF 노드 (v2)

### conditions 구조에 필수 필드가 많다

v2 IF 노드는 `version`, `leftValue`, `typeValidation` 등이 빠지면 에러난다.

```javascript
// ✅ 완전한 v2 IF 조건
{
  "conditions": {
    "options": {
      "version": 2,
      "leftValue": "",
      "caseSensitive": true,
      "typeValidation": "strict"
    },
    "conditions": [{
      "leftValue": "={{ $json.callback_query.data }}",
      "rightValue": "ebike",
      "operator": { "type": "string", "operation": "equals" },
      "id": "condition-unique-id"
    }],
    "combinator": "and"
  }
}
```

### 단항 연산자(isEmpty 등)는 singleValue: true 필요

`isEmpty`, `isNotEmpty` 같은 단항 연산자는 `rightValue` 없이 `singleValue: true`가 필요하다. 안전하게 이항 연산자(`equals`)를 쓰는 게 편하다.

### object 타입의 exists 연산자는 undefined에서 실패한다

`$json.message.voice`처럼 존재하지 않을 수 있는 필드를 `type: "object"`, `operation: "exists"`로 검사하면, 값이 undefined일 때 빈 문자열 `''`로 변환되면서 **"can't be converted to an object"** 에러가 난다. `typeValidation: "loose"`로 바꿔도 동일.

**해결: 삼항 연산자로 안전한 문자열 비교**

```javascript
// ❌ undefined → '' → object 변환 실패
{
  "leftValue": "={{ $json.message.voice }}",
  "operator": { "type": "object", "operation": "exists" }
}

// ✅ 삼항 연산자로 안전하게 변환
{
  "leftValue": "={{ $json.message.voice ? 'yes' : 'no' }}",
  "rightValue": "yes",
  "operator": { "type": "string", "operation": "equals" }
}
```

---

## Wait 노드

### specificTime 모드: 파라미터 이름은 dateTime (date 아님)

```javascript
// ❌ 필드명 틀림 → "Select date and time" 에러
{ "resume": "specificTime", "date": "={{ ... }}" }

// ✅ 정확한 필드명
{ "resume": "specificTime", "dateTime": "={{ $now.set({hour: 21, minute: 0, second: 0, millisecond: 0}).toISO() }}" }
```

---

## Google Calendar 노드

### Calendar ID에 "primary" 사용 시 유효성 에러

n8n Google Calendar 노드에서 calendar ID를 `"primary"`로 설정하면 UI에서 **"Not a valid Google Calendar ID"** 에러가 발생한다. 실제 이메일 주소를 사용해야 한다.

```javascript
// ❌ 에러 발생
{ "calendar": { "__rl": true, "mode": "id", "value": "primary" } }

// ✅ 실제 이메일 사용
{ "calendar": { "__rl": true, "mode": "id", "value": "user@gmail.com" } }
```

---

## Code 노드 — 타임존 함정

### Date 객체의 getDate()/getDay()/getHours()는 서버 타임존 기준

n8n 서버가 UTC에서 실행되면 KST(+09:00) 날짜가 **하루 밀린다.**

```javascript
// 종일 일정: start.date = "2026-03-03"
const d = new Date("2026-03-03T00:00:00+09:00");
// → 내부: 2026-03-02T15:00:00Z
d.getDate();  // ❌ 2 (UTC 기준 3월 2일)
d.getDay();   // ❌ 1 (월요일)
```

**해결 1: 종일 일정은 date 문자열에서 직접 파싱**

```javascript
// ✅ Date 객체를 거치지 않으므로 타임존 영향 없음
const parts = ev.start.date.split('-'); // "2026-03-03"
const y = parseInt(parts[0]), m = parseInt(parts[1]), d = parseInt(parts[2]);
const tmpDate = new Date(y, m - 1, d); // 요일 계산용
const dow = dayNames[tmpDate.getDay()]; // ✅ 화요일
```

**해결 2: 시간 일정은 수동 KST 변환 후 사용**

```javascript
// ✅ 서버 타임존 무관하게 KST로 변환
function toKST(d) {
  const kstOffset = 9 * 60 * 60000;
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + kstOffset);
}
const kd = toKST(new Date(ev.start.dateTime));
kd.getHours(); // ✅ KST 시간
```

### toLocaleString 기반 KST 변환은 불안정하다

`new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))`은 서버 환경에 따라 파싱 결과가 달라질 수 있다. 수동 오프셋 계산이 확실하다.

```javascript
// ❌ toLocaleString 결과를 다시 Date로 파싱 → 환경 의존적
const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

// ✅ 수동 오프셋 계산 → 어디서든 동일
const kstOffset = 9 * 60 * 60000;
const kstNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + kstOffset);
```

### 타임존 버그는 모든 Code 노드를 한꺼번에 점검해야 한다

한 워크플로우에서 `getHours()` 버그를 발견하면, **같은 패턴을 쓰는 다른 워크플로우의 Code 노드도 반드시 확인**하라. 워크플로우별로 따로 만들어서 같은 실수를 반복하기 쉽다. (실제로 WF2 브리핑을 고치고 WF3 리마인더를 빼먹었다.)

### 날짜 필터링은 Date 산술 대신 문자열 비교가 안전

Date 객체 간 뺄셈 `(d - kst) / (1000*60*60*24)`은 타임존 오프셋 차이로 경계값에서 틀릴 수 있다. YYYY-MM-DD 문자열 비교가 더 안전하다.

```javascript
// ❌ 타임존 차이로 경계값 오류 가능
const diffDays = (d - kst) / (1000 * 60 * 60 * 24);
return diffDays > 0 && diffDays <= 7;

// ✅ 문자열 비교는 타임존 무관
const ds = getEventDateStr(ev); // "2026-03-03"
return ds > todayStr && ds <= weekEndStr;
```

---

## 워크플로우 아키텍처

### 순차 연결된 Google Calendar 조회 노드는 중복 실행된다

n8n에서 A → B → C 순으로 Google Calendar getAll 노드를 연결하면, A가 10개 이벤트를 반환할 때 B는 **10번 실행**된다. 기간별 조회(오늘/7일/30일)를 분리하고 싶다면 **1개 노드로 최대 범위를 조회하고 Code 노드에서 필터링**해야 한다.

```
// ❌ 3개 GCal 노드 순차 연결 → 중복 실행
GCal(오늘) → GCal(7일) → GCal(30일) → Code

// ✅ 1개 GCal + Code에서 분류
GCal(30일 전체) → Code(오늘/7일/30일 필터링)
```

---

## AI 노드 / HTTP Proxy 설계

### AI에게 상대 시간 파싱을 시키려면 현재 시간도 알려줘야 한다

"30분 뒤", "1시간 후" 같은 상대 시간 표현을 AI로 파싱할 때, 시스템 프롬프트에 **현재 날짜만 넣고 현재 시간을 빠뜨리면** AI가 시간을 추측한다.

```javascript
// ❌ 날짜만 제공 → "30분 뒤"를 계산할 수 없음
'오늘 날짜: ' + $now.setZone('Asia/Seoul').toISODate()

// ✅ 날짜 + 시간 + 요일 모두 제공
'현재 날짜: ' + $now.setZone('Asia/Seoul').toISODate() +
'\n현재 요일: ' + $now.setZone('Asia/Seoul').toFormat('cccc') +
'\n현재 시간: ' + $now.setZone('Asia/Seoul').toFormat('HH:mm')
```

### 파싱 실패 시 에러 throw 대신 안내 메시지를 반환하라

AI가 JSON을 반환하지 않을 때 `throw new Error()`를 하면 워크플로우가 에러로 멈추고 사용자에게 아무 응답이 없다. **에러 플래그 + 안내 메시지를 반환**하고, 이후 IF 노드로 분기해서 캘린더 생성을 건너뛰는 게 낫다.

```javascript
// ❌ 워크플로우 중단, 사용자에게 무응답
if (!jsonMatch) throw new Error('파싱 실패');

// ✅ 에러 플래그 반환 → IF로 분기 → 안내 메시지 전송
if (!jsonMatch) {
  return [{ json: { error: true, confirmMessage: '❌ 일정을 인식할 수 없습니다.' } }];
}
```

---

## Telegram 음성 메시지 처리

### 음성 파일 다운로드는 2단계 (getFile → download)

Telegram 음성 메시지의 `file_id`로 직접 다운로드할 수 없다. 먼저 `getFile`로 파일 경로를 얻고, 그 경로로 다운로드해야 한다.

```
1. GET https://api.telegram.org/bot<TOKEN>/getFile?file_id=<FILE_ID>
   → { result: { file_path: "voice/file_123.oga" } }

2. GET https://api.telegram.org/file/bot<TOKEN>/<file_path>
   → 바이너리 오디오 데이터 (responseFormat: "file")
```

### 바이너리 다운로드 → 외부 API 업로드 패턴

HTTP Request로 파일을 다운로드한 후 다른 API에 multipart로 업로드하는 패턴:

```javascript
// 1단계: 다운로드 (HTTP Request)
{
  "method": "GET",
  "url": "=https://...{{ $json.result.file_path }}",
  "options": {
    "response": { "response": { "responseFormat": "file" } }  // 바이너리로 저장
  }
}

// 2단계: 업로드 (HTTP Request)
{
  "method": "POST",
  "url": "http://whisper-server/v1/audio/transcriptions",
  "sendBody": true,
  "contentType": "multipart-form-data",
  "bodyParameters": {
    "parameters": [
      { "parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data" },
      { "parameterType": "formData", "name": "model", "value": "Systran/faster-whisper-small" }
    ]
  }
}
```

`inputDataFieldName: "data"`는 이전 노드의 바이너리 데이터 키 이름 (기본값 `data`).

---

## Docker 네트워크 (Coolify)

### 컨테이너 간 통신은 host.docker.internal + 포트 매핑이 안정적

Docker 내부 IP(`10.0.1.x`)는 컨테이너 재시작 시 변경될 수 있다. Coolify에서 포트 매핑을 설정하고 `host.docker.internal`로 접근하면 안정적이다.

```javascript
// ❌ 내부 IP → 컨테이너 재시작 시 변경됨
"url": "http://10.0.1.8:8000/v1/audio/transcriptions"

// ✅ host.docker.internal + 포트 매핑 → 영구적
"url": "http://host.docker.internal:8100/v1/audio/transcriptions"
```

---

## 환경변수 / 배포 (Coolify)

### $vars (Variables)는 Enterprise 전용

Community Edition에서는 n8n Variables 기능을 사용할 수 없다. 값을 하드코딩하거나 $env를 사용해야 한다.

### $env 접근이 차단될 수 있다

`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`가 기본값이면 노드에서 `$env`를 쓸 수 없다. docker-compose에서 확인.

### Coolify의 ${SERVICE_URL_N8N}은 내부 HTTP URL

`${SERVICE_URL_N8N}`은 `http://n8n.192.168.xxx.sslip.io` 같은 내부 주소로 풀린다. **WEBHOOK_URL, N8N_EDITOR_BASE_URL은 공개 HTTPS URL을 하드코딩**해야 한다.

### N8N_ENCRYPTION_KEY 불일치 → 조용한 실패

볼륨에 이미 키가 있는 상태에서 새 키를 env로 넣으면 n8n이 시작 실패한다. 볼륨이 유지되면 키를 설정하지 않거나, 볼륨의 기존 키와 일치시켜야 한다.

### 워크플로우 "active"인데 webhook 미등록

컨테이너 재시작 후 워크플로우가 DB에서는 active이지만 **webhook 핸들러가 메모리에 등록되지 않은** 경우가 있다. 로그에서 `Activated workflow "이름"` 메시지 확인. 없으면 UI에서 토글 OFF → ON.
