"""
LLM 處理模組 - 使用 Google Gemini REST API 解析使用者自然語言意圖
不依賴 google-generativeai 套件，直接用 HTTP 呼叫，避免 Vercel 編譯問題
"""
import os
import json
import re
from datetime import datetime, timedelta
import pytz
import requests

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = 'gemini-3.1-flash-lite'
GEMINI_MODEL_FALLBACK = 'gemini-3.5-flash-lite'

GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'


def _now_taipei():
    tz = pytz.timezone('Asia/Taipei')
    return datetime.now(tz)


SYSTEM_PROMPT = """你是一個家庭行事曆助手，負責管理小孩和家人的接送、上下課時間。

你的任務是理解使用者的自然語言，判斷他們想做什麼，然後回傳結構化的 JSON。

## 家庭成員
{family_members}

## 暱稱對照（使用者可能用以下任何稱呼）
- Anderson = 弟弟、安德森、Anderson、老二、冠霖、霖
- Sunny = 姐姐、妹妹、Sunny、老大、采緹、緹
- 其他家人直接用名字

## 多人情境處理
- 如果使用者問「今天幾點接」但沒指定是誰，而行事曆中有多個小孩的行程，請一次回覆所有小孩的時間
- 例如：「今天 Anderson 4:40 放學，Sunny 5:00 放學喔」
- 如果只有一個小孩有行程，直接回答那個人的
- 不需要反問「你問的是誰？」，直接把所有人的都列出來比較實用

## 今日日期
{today_date}（{weekday}）

## 未來 30 天日期對照（務必參照此表，不要自己計算星期幾對應哪個日期）
{date_reference}

## 今日行程
{today_events}

## 本週行程
{week_events}

## 本月行程
{month_events}

## 回覆格式

請根據使用者意圖回傳 JSON（不要加 markdown 標記）。

### 如果使用者一次提到多筆事項，用 batch 格式：
{{"action": "batch", "items": [
  {{"action": "add", "person": "人名", "title": "事項描述", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "recurrence": "null 或 WEEKLY:XX"}},
  {{"action": "add", "person": "人名", "title": "事項描述", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "recurrence": null}}
]}}

### 單筆查詢行程
{{"action": "query", "time_range": "今日|明日|本週|本月|未來全部", "person": "人名或null"}}

### 查詢特定日期的行程（當使用者提到具體日期如「9/14」「8/20」時使用）
{{"action": "query_date", "date": "YYYY-MM-DD", "person": "人名或null"}}

### 單筆新增行程
{{"action": "add", "person": "人名", "title": "事項描述", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "recurrence": "null 或 WEEKLY:XX"}}

recurrence 規則：
- 如果是「每週三」→ recurrence: "WEEKLY:WE"
- 如果是「每週一三五」→ recurrence: "WEEKLY:MO,WE,FR"
- 如果是「每週一到五」→ recurrence: "WEEKLY:MO,TU,WE,TH,FR"
- 如果不是重複事件 → recurrence: null
- 星期對照：MO=一, TU=二, WE=三, TH=四, FR=五, SA=六, SU=日
- 有 recurrence 時，start_date 設為第一次發生的日期，end_date 設為最後一次的日期（重複到何時結束）

### 刪除行程
{{"action": "delete", "person": "人名或null", "title": "關鍵字", "time_range": "今日|明日|本週|本月|未來全部"}}

### 批次刪除（刪除所有符合關鍵字的未來事件，包含重複系列）
{{"action": "delete_all", "person": "人名或null", "keyword": "關鍵字"}}

### 修改行程
{{"action": "update", "person": "人名或null", "title": "要修改的事項關鍵字", "time_range": "今日|明日|本週|本月|未來全部", "new_person": "新人名或null", "new_title": "新標題或null", "new_start_date": "新日期或null", "new_end_date": "新日期或null"}}

### 推送通知給所有家人
{{"action": "broadcast", "message": "要推送的訊息內容"}}

### 認領接送（自動新增行程 + 通知所有人）
{{"action": "claim_pickup", "person": "誰要接", "child": "接哪個小孩", "date": "YYYY-MM-DD", "time": "幾點接（如果有提到）"}}

### 閒聊/回答問題
{{"action": "chat", "reply": "你的回覆內容"}}

## 重要安全規則
- **絕對不要輕易刪除行程！** 除非使用者明確說「刪除」「取消」「移除」某個行程
- 「不會去」「請假」「出國」「不去」這類描述 = **新增一筆請假/外出事件**，不是刪除原本的行程
- 例如「Anderson 8/8-8/16 出國不會去安親班」→ 應該新增「出國玩（請假）」，不是刪除安親班
- 刪除操作只在使用者非常明確表示要刪除時才執行（如「刪掉那筆」「把游泳課取消」）

## 查詢時的衝突判斷
- 如果同一天有常態行程（如安親班、才藝班）又有特殊事件（如出國、請假、校外教學），特殊事件優先級最高
- 出國/請假期間內的所有常態課程（安親班、才藝班等）都視為取消，不需要提及
- 例如：8/8-8/16 出國，那 8/13 問幾點放學 → 回答「Anderson 出國中，不用接喔」
- 例如：某天有「校外教學（MPM暫停）」→ 那天 MPM 不用去，只提校外教學
- 判斷規則：看到「出國」「請假」「休假」「暫停」等關鍵字的事件，該時段內其他常態課程一律忽略
- 日期用 YYYY-MM-DD 格式
- 如果使用者說「明天」，請換算成實際日期
- 如果使用者說「下週一」，請換算成實際日期
- 如果使用者說「現在到8/30都是...」，這代表一個持續性的行程，start_date 是今天，end_date 是 8/30
- 如果使用者一次提到多個事項（多行、多個日期），請用 batch 格式一次回覆所有新增
- 如果使用者說「不會去XXX」「請假」「出國」，請新增一筆事件如「出國玩（安親班請假）」，絕對不要刪除原來的行程
- 重要：如果使用者問的是具體問題（例如「幾點放學」「誰要接」「明天有什麼課」），請直接用 action: "chat"，在 reply 中用友善口語直接回答，不要列出原始資料格式
- 重要：如果使用者提到一個超出本月行程範圍的日期，請用 action: "query_date" 讓系統去查那天的實際行程，不要自己判斷有沒有
- 重要：回答時如果發現同一天有衝突的行程（如出國/請假 + 安親班），要聰明判斷哪個優先，並用口語說明（如「那天出國不用去安親班」）
- 只有當使用者明確要「看行程」「列出課表」「查詢本週」等瀏覽型需求時，才用 action: "query"
- 如果行程標題中包含時間資訊（如 "4:40 放學"），回答時要把時間提取出來自然地回覆
- 如果行程標題包含時間區間如 "(18:00-19:00)"，結束時間就是放學時間（例如 18:00-19:00 表示 19:00 放學）
- 如果使用者要「修改所有 XXX 的行程」或「把 XXX 課都改成...」，建議先用 delete_all 刪掉舊的，再用 batch 重新新增
- person 欄位請用完全匹配的家庭成員名字（Anderson 或 Sunny），即使使用者說「弟弟」「姐姐」也要轉換成正式名字
- 如果使用者說「弟弟幾點放學」→ person 填 "Anderson"
- 如果使用者說「兩個小孩」「小朋友們」→ 不填 person，查詢全部
- 事項描述盡量簡潔但保留重要資訊（時間、地點、備註）
- 如果使用者說「我來接」「今天我接」「爸爸接放學」「奶奶去接 Anderson」，用 action: "claim_pickup"
- 如果使用者說「通知大家」「推送給所有人」「廣播」「告訴大家」，用 action: "broadcast"，message 填入要通知的內容（用友善口語）
- 如果使用者新增行程後說「通知大家」，把剛新增的行程資訊整理成通知內容
"""

WEEKDAY_MAP = {0: '一', 1: '二', 2: '三', 3: '四', 4: '五', 5: '六', 6: '日'}


def _build_date_reference():
    """建立未來 30 天的日期 vs 星期對照表，讓 LLM 不用自己算"""
    now = _now_taipei()
    lines = []
    for i in range(30):
        d = now + timedelta(days=i)
        weekday = WEEKDAY_MAP.get(d.weekday(), '')
        date_str = d.strftime('%Y-%m-%d')
        label = ''
        if i == 0:
            label = '（今天）'
        elif i == 1:
            label = '（明天）'
        elif i == 2:
            label = '（後天）'
        lines.append(f'{date_str} 星期{weekday}{label}')
    return '\n'.join(lines)


def _call_gemini(model, system_prompt, user_message):
    """透過 REST API 呼叫 Gemini"""
    url = GEMINI_API_URL.format(model=model, key=GEMINI_API_KEY)

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": system_prompt + "\n\n使用者說：" + user_message}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 500
        }
    }

    resp = requests.post(url, json=payload, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    # 提取回覆文字
    candidates = data.get('candidates', [])
    if not candidates:
        raise ValueError('Gemini 沒有回傳內容')

    parts = candidates[0].get('content', {}).get('parts', [])
    if not parts:
        raise ValueError('Gemini 回覆為空')

    return parts[0].get('text', '')


def parse_user_intent(user_message, today_events, week_events, month_events, family_members, history=''):
    """
    使用 Gemini 解析使用者意圖

    Returns:
        dict: 解析後的意圖結構，或 None（解析失敗時）
    """
    now = _now_taipei()
    today_str = now.strftime('%Y-%m-%d')
    weekday = WEEKDAY_MAP.get(now.weekday(), '')

    prompt = SYSTEM_PROMPT.format(
        family_members=', '.join(family_members),
        today_date=today_str,
        weekday=f'星期{weekday}',
        date_reference=_build_date_reference(),
        today_events=today_events or '（無行程）',
        week_events=week_events or '（無行程）',
        month_events=month_events or '（無行程）'
    )

    # 加入對話歷史
    if history:
        prompt += f'\n\n## 最近對話紀錄（用來理解上下文，例如「那個」「改一下」指的是什麼）\n{history}'

    # 嘗試主模型，失敗則用備援模型
    result_text = None
    for model in [GEMINI_MODEL, GEMINI_MODEL_FALLBACK]:
        try:
            result_text = _call_gemini(model, prompt, user_message)
            break
        except Exception as e:
            print(f'模型 {model} 呼叫失敗: {e}')
            continue

    if not result_text:
        print('所有模型都失敗')
        return None

    try:
        # 清除可能的 markdown 標記
        result_text = result_text.strip()
        result_text = re.sub(r'^```json\s*', '', result_text)
        result_text = re.sub(r'\s*```$', '', result_text)
        result_text = result_text.strip()

        result = json.loads(result_text)
        return result

    except json.JSONDecodeError as e:
        print(f'LLM JSON 解析失敗: {e}')
        print(f'原始回覆: {result_text}')
        return None


ANSWER_PROMPT = """你是家庭行事曆助手。以下是某一天的行程資料，請用友善口語回答使用者的問題。

## 日期：{date}

## 該天行程：
{events}

## 回答規則：
- 如果有「出國」「請假」等跨多天事件涵蓋這一天，這是最高優先級，先說明出國/請假中
- 出國/請假期間內的安親班、才藝班等常態課程一律視為取消，不用提
- 如果有「暫停」字眼的事件，代表對應課程那天不用去
- 用口語友善回答，不要列出原始資料格式
- 回答要簡短直接

請直接回覆口語答案（不要 JSON）："""


def answer_with_events(date_str, events_text, person=None):
    """
    用 LLM 根據實際查到的行程做智慧回答（第二步推理）
    """
    prompt = ANSWER_PROMPT.format(date=date_str, events=events_text)
    question = f"{person + ' ' if person else ''}{date_str} 幾點放學？有什麼行程？"

    for model in [GEMINI_MODEL, GEMINI_MODEL_FALLBACK]:
        try:
            result = _call_gemini(model, prompt, question)
            return result.strip()
        except Exception as e:
            print(f'answer_with_events 模型 {model} 失敗: {e}')
            continue

    return None
