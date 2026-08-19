"""
Vercel Serverless Function - LINE Bot Webhook
"""
from flask import Flask, request, abort
from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError
from linebot.models import (
    MessageEvent, TextMessage, TextSendMessage,
    PostbackEvent
)
from dotenv import load_dotenv
import os, json, re, traceback

from calendar_api import (
    add_event, get_today_events, get_week_events,
    get_month_events, get_future_events,
    filter_by_person, format_events,
    delete_event, delete_events_by_keyword, update_event, get_tomorrow_events
)
from llm_handler import parse_user_intent
from whitelist_store import is_authorized, authorize_user
from sheet_logger import log_action
from conversation_memory import get_conversation_history, save_conversation, format_history_for_prompt

load_dotenv()
app = Flask(__name__)

line_bot_api = LineBotApi(os.getenv('LINE_CHANNEL_ACCESS_TOKEN'))
handler = WebhookHandler(os.getenv('LINE_CHANNEL_SECRET'))
USER_ID = os.getenv('LINE_USER_ID')

# === 密碼機制 ===
BOT_PASSWORD = os.getenv('BOT_PASSWORD', '1234')
pending_auth = {}

FAMILY_MEMBERS = ['Anderson', 'Sunny', '奶奶', '爺爺', '爸爸', '媽媽']

# LINE User ID 對照身份（用於辨識「我來接」中的「我」是誰）
USER_IDENTITY = {
    'U88d450ee6d4250969c3ae1ea923320e3': '媽媽',
    'Uf52a946217885981339ec07514ef8619': '奶奶',
    'U72ce12345b270016ccf9c01beaa9c2ba': '爸爸',
    'Ufb0d83d0b198fda6cd1571d182b84021': '爺爺',
}


@app.route('/', methods=['GET'])
@app.route('/api/webhook', methods=['GET'])
def health():
    return 'OK', 200


@app.route('/api/daily-push', methods=['GET'])
def daily_push():
    """每日推播今日行程給所有白名單使用者（沒行程就不推）"""
    from calendar_api import _now_taipei
    from whitelist_store import load_whitelist as get_all_users

    events = get_today_events()

    # 沒有行程就不推送
    if not events:
        return 'OK - 今天沒有行程，不推送', 200

    WEEKDAY_MAP_PUSH = {0: '一', 1: '二', 2: '三', 3: '四', 4: '五', 5: '六', 6: '日'}
    now = _now_taipei()
    weekday = WEEKDAY_MAP_PUSH.get(now.weekday(), '')
    date_str = now.strftime('%m/%d')

    formatted = format_events(events)
    msg = f'🌅 早安！今天 {date_str}（{weekday}）行程：\n\n{formatted}'

    whitelist = get_all_users()
    success_count = 0
    for uid in whitelist:
        try:
            line_bot_api.push_message(uid, TextSendMessage(text=msg))
            success_count += 1
        except Exception as e:
            print(f'推送失敗 {uid}: {e}')

    return f'OK - 已推送給 {success_count} 人', 200


@app.route('/api/daily-push-test', methods=['GET'])
def daily_push_test():
    """測試推播 - 只推給 owner"""
    from calendar_api import _now_taipei

    WEEKDAY_MAP_PUSH = {0: '一', 1: '二', 2: '三', 3: '四', 4: '五', 5: '六', 6: '日'}
    now = _now_taipei()
    weekday = WEEKDAY_MAP_PUSH.get(now.weekday(), '')
    date_str = now.strftime('%m/%d')

    events = get_today_events()
    formatted = format_events(events)

    msg = f'🌅 早安！今天 {date_str}（{weekday}）行程：\n\n{formatted}'

    try:
        line_bot_api.push_message(USER_ID, TextSendMessage(text=msg))
        return 'OK - 已推送給你', 200
    except Exception as e:
        return f'推送失敗: {e}', 500


@app.route('/', methods=['POST'])
@app.route('/api/webhook', methods=['POST'])
@app.route('/callback', methods=['POST'])
def callback():
    signature = request.headers.get('X-Line-Signature', '')
    body = request.get_data(as_text=True)
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        abort(400)
    except Exception as e:
        print(f'Webhook 處理錯誤: {e}')
        traceback.print_exc()
    return 'OK'


@handler.add(MessageEvent, message=TextMessage)
def handle_message(event):
    reply_token = event.reply_token
    uid = event.source.user_id
    text = event.message.text.strip()

    try:
        # === 白名單驗證流程 ===
        if not is_authorized(uid):
            print(f'[AUTH] 未授權使用者嘗試存取: {uid}')
            if uid in pending_auth:
                if text == BOT_PASSWORD:
                    authorize_user(uid)
                    pending_auth.pop(uid, None)
                    line_bot_api.reply_message(reply_token, TextSendMessage(
                        text='✅ 驗證成功！歡迎使用寶貝行事曆 📅\n\n'
                             '你可以直接用自然語言跟我說，例如：\n'
                             '• 「明天 Anderson 下午3點下課」\n'
                             '• 「Sunny 這週有什麼課？」\n'
                             '• 「今天誰要接送？」'
                    ))
                else:
                    line_bot_api.reply_message(reply_token, TextSendMessage(
                        text='❌ 密碼錯誤，請重新輸入：'
                    ))
                return
            else:
                pending_auth[uid] = True
                line_bot_api.reply_message(reply_token, TextSendMessage(
                    text='🔒 歡迎！請輸入驗證密碼以使用此服務：'
                ))
                return

        # === 已驗證使用者 ===

        # 說明指令
        if text in ['說明', '幫助', 'help', '?', '？']:
            help_text = (
                '📅 寶貝行事曆使用說明\n\n'
                '【查詢行程】\n'
                '• 「今天行程」\n'
                '• 「明天幾點放學」\n'
                '• 「8/13 有什麼課」\n'
                '• 「Anderson 這週行程」\n'
                '• 「弟弟下週三幾點接」\n\n'
                '【新增行程】\n'
                '• 「明天 Anderson 下午3點 游泳課」\n'
                '• 「8/20-8/25 Sunny 出國」\n'
                '• 「新增 每週三 才藝班 18:00」\n\n'
                '【刪除行程】\n'
                '• 「刪除 Anderson 明天的游泳課」\n'
                '• 「刪除所有 MPM 才藝班」\n\n'
                '【通知家人】\n'
                '• 「通知大家今天爸爸接放學」\n'
                '• 「廣播：明天提早 3:30 放學」\n'
                '• 「告訴大家這週五校外教學」\n\n'
                '【認領接送】（自動通知所有人）\n'
                '• 「今天我來接」\n'
                '• 「明天爸爸接 Anderson」\n'
                '• 「奶奶去接弟弟放學」\n\n'
                '【其他】\n'
                '• 可以用暱稱：弟弟=Anderson、姐姐=Sunny\n'
                '• 直接用自然語言說就好，不用固定格式'
            )
            line_bot_api.reply_message(reply_token, TextSendMessage(text=help_text))
            return

        # 透過 LLM 處理
        response = process_with_llm(uid, text)
        line_bot_api.reply_message(reply_token, TextSendMessage(text=response))

        # 存對話記憶
        save_conversation(uid, text, response)

    except Exception as e:
        print(f'handle_message 錯誤: {e}')
        traceback.print_exc()
        try:
            line_bot_api.reply_message(reply_token, TextSendMessage(
                text=f'抱歉，發生了一點問題 😅\n錯誤：{str(e)}'
            ))
        except Exception:
            pass


def process_with_llm(uid, text):
    """透過 LLM 理解使用者意圖並執行對應操作"""
    # 辨識「我」是誰
    sender_name = USER_IDENTITY.get(uid, '未知')
    # 如果使用者說「我」，在訊息前加上身份提示
    user_message = text
    if '我' in text:
        user_message = f'（說話的人是{sender_name}）{text}'

    # 取得對話歷史
    history = get_conversation_history(uid)
    history_text = format_history_for_prompt(history)

    today_events = get_today_events()
    week_events = get_week_events()
    month_events = get_month_events()

    context_events = format_events(today_events)
    context_week = format_events(week_events)
    context_month = format_events(month_events)

    result = parse_user_intent(
        user_message=user_message,
        today_events=context_events,
        week_events=context_week,
        month_events=context_month,
        family_members=FAMILY_MEMBERS,
        history=history_text
    )

    if result is None:
        return '抱歉，我沒有理解你的意思 😅\n可以試試：\n• 「今天行程」\n• 「新增 明天 Anderson 下午3點 游泳課」\n• 「Sunny 這週課表」'

    action = result.get('action')

    # === 批次新增 ===
    if action == 'batch':
        items = result.get('items', [])
        if not items:
            return '沒有解析到要新增的事項 🤔'
        success_list = []
        for item in items:
            item_action = item.get('action', 'add')
            if item_action == 'add':
                person = item.get('person', '')
                title = item.get('title', '')
                start_date = item.get('start_date', '')
                end_date = item.get('end_date', start_date)
                recurrence = item.get('recurrence')
                if person and title and start_date:
                    add_event(person, title, start_date, end_date, recurrence=recurrence)
                    log_action('新增', person, title, f'{start_date}～{end_date}', uid)
                    rec_label = f' (重複: {recurrence})' if recurrence else ''
                    success_list.append(f'• {person} | {title} | {start_date}～{end_date}{rec_label}')
        if success_list:
            return f'✅ 已新增 {len(success_list)} 筆行程：\n\n' + '\n'.join(success_list)
        return '資訊不夠完整，無法新增 😅'

    if action == 'query':
        time_range = result.get('time_range', '今日')
        person = result.get('person')
        events = fetch_events_by_range(time_range)
        if person:
            events = filter_by_person(events, person)
        formatted = format_events(events)
        header = f'👤 {person} ' if person else ''
        return f'{header}📅 {time_range}行程：\n\n{formatted}'

    elif action == 'query_date':
        from calendar_api import get_events, _filter_by_actual_date
        date_str = result.get('date', '')
        person = result.get('person')
        if date_str:
            from datetime import datetime as dt
            target = dt.strptime(date_str, '%Y-%m-%d')
            # 從年初開始查，確保任何跨多天事件（含半年課程）都能被抓到
            start = f'{target.year}-01-01T00:00:00+08:00'
            end = f'{date_str}T23:59:59+08:00'
            events = get_events(start, end)
            # 只保留實際涵蓋目標日期的事件
            events = _filter_by_actual_date(events, date_str)
            if person:
                events = filter_by_person(events, person)
            if events:
                # 用 LLM 做智慧回答
                from llm_handler import answer_with_events
                formatted = format_events(events)
                answer = answer_with_events(date_str, formatted, person)
                if answer:
                    return answer
                # fallback: 直接列出
                header = f'👤 {person} ' if person else ''
                return f'{header}📅 {date_str} 行程：\n\n{formatted}'
            else:
                header = f'{person} ' if person else ''
                return f'📭 {header}{date_str} 沒有找到行程'
        return '日期格式有誤，請再試一次'

    elif action == 'add':
        person = result.get('person', '')
        title = result.get('title', '')
        start_date = result.get('start_date', '')
        end_date = result.get('end_date', start_date)
        if not person or not title or not start_date:
            return '資訊不夠完整，請告訴我：誰、什麼時候、做什麼事？\n例如：「明天 Anderson 下午3點 游泳課」'
        recurrence = result.get('recurrence')
        add_event(person, title, start_date, end_date, recurrence=recurrence)
        log_action('新增', person, title, f'{start_date}～{end_date}', uid)
        rec_label = f'\n🔁 重複: {recurrence}' if recurrence else ''
        return f'✅ 已新增！\n👤 {person}\n📅 {start_date}～{end_date}\n📝 {title}{rec_label}'

    elif action == 'delete':
        person = result.get('person')
        title_keyword = result.get('title', '')
        time_range = result.get('time_range', '未來全部')
        events = fetch_events_by_range(time_range)
        if person:
            events = filter_by_person(events, person)
        matched = [e for e in events if title_keyword in e.get('summary', '')]
        if not matched:
            return f'找不到符合「{title_keyword}」的事項 🤔'
        if len(matched) == 1:
            ev = matched[0]
            log_action('刪除', person or '', ev.get('summary', ''), time_range, uid)
            delete_event(ev['id'])
            return f'🗑️ 已刪除：{ev.get("summary", "")}'
        lines = [f'{i+1}. {e.get("summary", "")}' for i, e in enumerate(matched)]
        return '找到多筆符合的事項，請更具體一點：\n' + '\n'.join(lines)

    elif action == 'delete_all':
        from calendar_api import delete_events_by_keyword
        person = result.get('person')
        keyword = result.get('keyword', '')
        if not keyword:
            return '請告訴我要刪除哪個行程的關鍵字'
        count = delete_events_by_keyword(keyword, person=person)
        if count > 0:
            log_action('批次刪除', person or '', f'關鍵字: {keyword} ({count}筆)', '', uid)
            return f'🗑️ 已刪除 {count} 筆包含「{keyword}」的行程'
        return f'找不到包含「{keyword}」的行程 🤔'

    elif action == 'update':
        person = result.get('person')
        title_keyword = result.get('title', '')
        time_range = result.get('time_range', '未來全部')
        new_person = result.get('new_person')
        new_title = result.get('new_title')
        new_start = result.get('new_start_date')
        new_end = result.get('new_end_date')
        events = fetch_events_by_range(time_range)
        if person:
            events = filter_by_person(events, person)
        matched = [e for e in events if title_keyword in e.get('summary', '')]
        if not matched:
            return f'找不到符合「{title_keyword}」的事項 🤔'
        if len(matched) > 1:
            lines = [f'{i+1}. {e.get("summary", "")}' for i, e in enumerate(matched)]
            return '找到多筆符合的事項，請更具體一點：\n' + '\n'.join(lines)
        ev = matched[0]
        update_event(ev['id'], person=new_person, title=new_title,
                     start_date=new_start, end_date=new_end)
        return '✅ 修改完成！'

    elif action == 'broadcast':
        from whitelist_store import load_whitelist as get_all_users
        message = result.get('message', '')
        if not message:
            return '請告訴我要通知大家什麼內容'
        whitelist = get_all_users()
        success_count = 0
        for target_uid in whitelist:
            try:
                line_bot_api.push_message(target_uid, TextSendMessage(text=f'📢 {message}'))
                success_count += 1
            except Exception as e:
                print(f'推送失敗 {target_uid}: {e}')
        return f'✅ 已通知 {success_count} 位家人'

    elif action == 'claim_pickup':
        from whitelist_store import load_whitelist as get_all_users
        person = result.get('person', '')
        child = result.get('child', '')
        date = result.get('date', '')
        time_str = result.get('time', '')

        if not person or not date:
            return '請告訴我誰要接、哪一天？'

        # 新增接送行程
        title = f'{person}接放學'
        if time_str:
            title += f' {time_str}'
        add_event(child or 'Anderson', title, date, date)
        log_action('認領接送', person, title, date, uid)

        # 自動推播通知所有人
        child_label = f'{child} ' if child else ''
        time_label = f' {time_str}' if time_str else ''
        broadcast_msg = f'📢 {person}認領了 {date} {child_label}的接送{time_label}！'

        whitelist = get_all_users()
        for target_uid in whitelist:
            try:
                line_bot_api.push_message(target_uid, TextSendMessage(text=broadcast_msg))
            except Exception as e:
                print(f'推送失敗 {target_uid}: {e}')

        return f'✅ 已新增並通知大家：{person} {date} 負責接{child_label}放學'

    elif action == 'chat':
        return result.get('reply', '有什麼我可以幫忙的嗎？📅')

    return '我不太確定你的意思，可以再說一次嗎？'


def fetch_events_by_range(time_range):
    if time_range == '今日':
        return get_today_events()
    elif time_range == '明日':
        return get_tomorrow_events()
    elif time_range == '本週':
        return get_week_events()
    elif time_range == '本月':
        return get_month_events()
    else:
        return get_future_events()
