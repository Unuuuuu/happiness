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

### updateNode에서 한국어 노드 이름 인식 실패

`name: "저녁 9시까지 대기"` 같은 한국어 이름이 빈 문자열로 전달될 수 있다. **nodeId를 사용**하라.

```javascript
// ❌ 이름으로 지정 → 인코딩 문제
{ "type": "updateNode", "name": "저녁 9시까지 대기", ... }

// ✅ nodeId로 지정
{ "type": "updateNode", "nodeId": "b1000000-0005-4000-8000-000000000005", ... }
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
