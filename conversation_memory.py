"""
對話記憶模組 - 用 Upstash Redis 存最近 N 則對話
讓 Bot 能理解「改那個」「對，那筆」等上下文
"""
import os
import json
import urllib.request

UPSTASH_REDIS_URL = os.getenv('UPSTASH_REDIS_URL', '')
UPSTASH_REDIS_TOKEN = os.getenv('UPSTASH_REDIS_TOKEN', '')

MAX_HISTORY = 5  # 保留最近 5 則對話（user + bot 各算一則）
EXPIRY_SECONDS = 3600  # 1 小時後自動過期（避免佔空間）


def _redis_request(command, *args):
    """透過 Upstash REST API 執行 Redis 命令"""
    if not UPSTASH_REDIS_URL or not UPSTASH_REDIS_TOKEN:
        return None
    url = f'{UPSTASH_REDIS_URL}/{command}/{"/".join(str(a) for a in args)}'
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {UPSTASH_REDIS_TOKEN}'
    })
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get('result')
    except Exception as e:
        print(f'[Memory] Redis 請求失敗: {e}')
        return None


def _redis_post(commands):
    """透過 Upstash Pipeline 執行多個命令"""
    if not UPSTASH_REDIS_URL or not UPSTASH_REDIS_TOKEN:
        return None
    url = f'{UPSTASH_REDIS_URL}/pipeline'
    payload = json.dumps(commands).encode()
    req = urllib.request.Request(url, data=payload, method='POST', headers={
        'Authorization': f'Bearer {UPSTASH_REDIS_TOKEN}',
        'Content-Type': 'application/json'
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f'[Memory] Redis pipeline 失敗: {e}')
        return None


def get_conversation_history(uid):
    """取得使用者的對話歷史"""
    key = f'chat:{uid}'
    result = _redis_request('lrange', key, '0', str(MAX_HISTORY * 2 - 1))
    if not result:
        return []
    # Redis list 存的是 JSON 字串
    history = []
    for item in result:
        try:
            history.append(json.loads(item))
        except (json.JSONDecodeError, TypeError):
            continue
    return history


def save_conversation(uid, user_msg, bot_reply):
    """存入一組對話（user + bot）"""
    key = f'chat:{uid}'
    user_entry = json.dumps({'role': 'user', 'content': user_msg}, ensure_ascii=False)
    bot_entry = json.dumps({'role': 'bot', 'content': bot_reply}, ensure_ascii=False)

    # 用 pipeline: lpush 兩則 + ltrim 保留最近 N 則 + expire 設過期
    commands = [
        ['lpush', key, bot_entry, user_entry],
        ['ltrim', key, '0', str(MAX_HISTORY * 2 - 1)],
        ['expire', key, str(EXPIRY_SECONDS)]
    ]
    _redis_post(commands)


def format_history_for_prompt(history):
    """把對話歷史格式化成 prompt 可用的文字"""
    if not history:
        return ''
    # history 是從新到舊，反轉成時間順序
    history = list(reversed(history))
    lines = []
    for entry in history:
        role = '使用者' if entry.get('role') == 'user' else '助手'
        lines.append(f'{role}：{entry.get("content", "")}')
    return '\n'.join(lines)
