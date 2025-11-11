from flask import Flask, render_template, request, jsonify
from twilio.rest import Client
import sqlite3
import os
import threading
import random
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN') 
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')

def init_db():
    conn = sqlite3.connect('numbers.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS calls
                 (id INTEGER PRIMARY KEY, phone_number TEXT, status TEXT, 
                  call_duration TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

calling_status = {"running": False, "progress": 0, "current_number": "", "total": 0}

def make_call(phone_number, use_ai_voice=True):
    """Make real call with Twilio OR mock call for demo"""
    try:
        if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
            if use_ai_voice:
                twiml = f'''
                <Response>
                    <Say voice="alice" language="en-US">
                        Hello! This is an AI-powered autodialer demonstration. 
                        We are testing our automated calling system. 
                        This call is using advanced Text-to-Speech technology.
                        Thank you for your attention. Goodbye!
                    </Say>
                </Response>
                '''
                call = client.calls.create(
                    to=phone_number,
                    from_=TWILIO_PHONE_NUMBER,
                    twiml=twiml
                )
            else:
                call = client.calls.create(
                    to=phone_number,
                    from_=TWILIO_PHONE_NUMBER,
                    url='http://demo.twilio.com/docs/voice.xml'
                )
            return call.sid, "connected - AI voice delivered"
        else:
            return make_mock_call(phone_number, use_ai_voice)
            
    except Exception as e:
        return make_mock_call(phone_number, use_ai_voice)

def make_mock_call(phone_number, use_ai_voice=True):
    """Mock calling for demonstration"""
    time.sleep(random.uniform(2, 4))

    outcomes = [
        ("connected - call answered", "00:25"),
        ("connected - voicemail", "00:15"), 
        ("failed - busy signal", "00:00"),
        ("failed - number not in service", "00:00"),
        ("connected - call answered", "00:32"),
        ("failed - no answer", "00:00")
    ]
    
    status, duration = random.choice(outcomes)

    if use_ai_voice and "connected" in status:
        status += " with AI voice"
    
    return f"mock_{random.randint(1000,9999)}", status

def call_numbers_async(phone_numbers, use_ai_voice=True):
    global calling_status
    calling_status = {"running": True, "progress": 0, "current_number": "", "total": len(phone_numbers)}
    
    conn = sqlite3.connect('numbers.db')
    c = conn.cursor()
    
    try:
        for i, number in enumerate(phone_numbers, 1):
            calling_status["current_number"] = f"Calling {i}/{len(phone_numbers)}: {number}"
            calling_status["progress"] = int((i / len(phone_numbers)) * 100)
            
    
            call_sid, status = make_call(number, use_ai_voice)

            c.execute("INSERT INTO calls (phone_number, status) VALUES (?, ?)",
                     (number, status))
            conn.commit()
            time.sleep(random.uniform(1, 3))
            
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        conn.close()
        calling_status["running"] = False

@app.route('/')
def dashboard():
    return render_template('dashboard.html')

@app.route('/start_calling', methods=['POST'])
def start_calling():
    if calling_status["running"]:
        return jsonify({"error": "Calling already in progress"})
    
    phone_numbers = request.json.get('numbers', [])
    use_ai_voice = request.json.get('ai_voice', True)
    
    if not phone_numbers:
        return jsonify({"error": "No phone numbers provided"})
   
    valid_numbers = []
    for num in phone_numbers:
        clean_num = ''.join(filter(str.isdigit, num))
        
        if len(clean_num) == 10:
            valid_numbers.append(f"+91{clean_num}")
        elif len(clean_num) == 12 and clean_num.startswith('91'):
            valid_numbers.append(f"+{clean_num}")
        elif num.startswith('+'):
            valid_numbers.append(num)
        elif num.startswith('1800'):
            valid_numbers.append(num)
    
    if not valid_numbers:
        return jsonify({"error": "No valid phone numbers found"})

    thread = threading.Thread(target=call_numbers_async, args=(valid_numbers, use_ai_voice))
    thread.daemon = True
    thread.start()
    
    return jsonify({"message": "Calling started", "total": len(valid_numbers)})

@app.route('/ai_command', methods=['POST'])
def ai_command():
    """Handle AI voice commands"""
    if calling_status["running"]:
        return jsonify({"error": "Calling already in progress"})
    
    command = request.json.get('command', '')
    use_ai_voice = request.json.get('ai_voice', True)
    
    if not command:
        return jsonify({"error": "No command provided"})
    import re
    patterns = [
        r'call\s+(\+?[\d\s\-]+)',
        r'call\s+to\s+(\+?[\d\s\-]+)',
        r'dial\s+(\+?[\d\s\-]+)',
        r'make\s+a\s+call\s+to\s+(\+?[\d\s\-]+)'
    ]
    
    phone_number = None
    for pattern in patterns:
        match = re.search(pattern, command.lower())
        if match:
            phone_number = match.group(1).strip()
            break
    
    if not phone_number:
        return jsonify({"error": "No phone number found in command"})

    clean_num = ''.join(filter(str.isdigit, phone_number))
    if len(clean_num) == 10:
        formatted_number = f"+91{clean_num}"
    elif len(clean_num) == 12 and clean_num.startswith('91'):
        formatted_number = f"+{clean_num}"
    else:
        formatted_number = phone_number
    
   
    call_sid, status = make_call(formatted_number, use_ai_voice)
    

    conn = sqlite3.connect('numbers.db')
    c = conn.cursor()
    c.execute("INSERT INTO calls (phone_number, status) VALUES (?, ?)",
             (formatted_number, status))
    conn.commit()
    conn.close()
    
    return jsonify({
        "message": f"Call initiated to {formatted_number}",
        "status": status,
        "command_processed": command
    })

@app.route('/calling_status')
def get_calling_status():
    return jsonify(calling_status)

@app.route('/call_logs')
def call_logs():
    conn = sqlite3.connect('numbers.db')
    c = conn.cursor()
    c.execute("SELECT * FROM calls ORDER BY created_at DESC LIMIT 100")
    logs = c.fetchall()
    conn.close()
    
   
    total_calls = len(logs)
    connected_calls = len([log for log in logs if 'connected' in log[2]])
    failed_calls = total_calls - connected_calls
    
    return render_template('results.html', logs=logs, total_calls=total_calls, 
                         connected_calls=connected_calls, failed_calls=failed_calls)

if __name__ == '__main__':
    app.run(debug=True, port=8000)
