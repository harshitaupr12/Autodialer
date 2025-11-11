let recognition;
let isListening = false;

function startCalling() {
    const numbersText = document.getElementById('phoneNumbers').value;
    const numbers = numbersText.split('\n').filter(num => num.trim() !== '');
    const useAIVoice = document.getElementById('useAIVoice').checked;
    
    if (numbers.length === 0) {
        alert('Please enter at least one phone number');
        return;
    }

    // Show progress section
    document.getElementById('progressSection').classList.remove('hidden');
    document.getElementById('callStats').classList.remove('hidden');
    
    // Start calling
    fetch('/start_calling', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            numbers: numbers,
            ai_voice: useAIVoice
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }
        // Start checking progress
        checkCallingProgress();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error starting calls');
    });
}

function processAICommand() {
    const command = document.getElementById('aiCommand').value.trim();
    const useAIVoice = document.getElementById('useAIVoice').checked;
    
    if (!command) {
        alert('Please enter an AI command');
        return;
    }

    const btn = document.getElementById('textCommandBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    fetch('/ai_command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            command: command,
            ai_voice: useAIVoice
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('❌ ' + data.error);
        } else {
            showCommandSuccess(data.message);
            document.getElementById('aiCommand').value = '';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('❌ Error processing AI command');
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Execute Command';
    });
}

function startVoiceCommand() {
    if (!('webkitSpeechRecognition' in window)) {
        alert('Voice commands not supported in this browser. Use Chrome for best experience.');
        return;
    }

    if (isListening) {
        stopVoiceCommand();
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    const voiceBtn = document.getElementById('voiceCommandBtn');
    voiceBtn.textContent = '🔴 Listening...';
    voiceBtn.style.background = 'linear-gradient(135deg, #dc3545, #e83e8c)';
    
    document.getElementById('voiceStatus').classList.remove('hidden');
    isListening = true;

    recognition.start();
    
    recognition.onresult = function(event) {
        const command = event.results[0][0].transcript;
        document.getElementById('aiCommand').value = command;
        showVoiceResult(`🎤 Heard: "${command}"`);
        
        // Auto-process after 1 second
        setTimeout(() => {
            processAICommand();
        }, 1000);
    };
    
    recognition.onerror = function(event) {
        showVoiceResult('❌ Voice error: ' + event.error);
        resetVoiceButton();
    };
    
    recognition.onend = function() {
        resetVoiceButton();
    };
}

function stopVoiceCommand() {
    if (recognition) {
        recognition.stop();
    }
    resetVoiceButton();
}

function resetVoiceButton() {
    const voiceBtn = document.getElementById('voiceCommandBtn');
    voiceBtn.textContent = '🎤 Voice Command';
    voiceBtn.style.background = '';
    document.getElementById('voiceStatus').classList.add('hidden');
    isListening = false;
}

function showVoiceResult(message) {
    const voiceStatus = document.getElementById('voiceStatus');
    voiceStatus.innerHTML = `<p>${message}</p>`;
    voiceStatus.classList.remove('hidden');
    
    setTimeout(() => {
        voiceStatus.classList.add('hidden');
    }, 3000);
}

function showCommandSuccess(message) {
    const voiceStatus = document.getElementById('voiceStatus');
    voiceStatus.innerHTML = `<p>✅ ${message}</p>`;
    voiceStatus.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
    voiceStatus.classList.remove('hidden');
    
    setTimeout(() => {
        voiceStatus.classList.add('hidden');
        voiceStatus.style.background = '';
    }, 3000);
}

function testVoiceCommand() {
    if (!('webkitSpeechRecognition' in window)) {
        alert('Voice recognition not supported in your browser');
        return;
    }
    
    const testRecognition = new webkitSpeechRecognition();
    testRecognition.continuous = false;
    testRecognition.interimResults = false;
    testRecognition.lang = 'en-US';
    
    alert('Speak anything to test voice recognition...');
    
    testRecognition.start();
    
    testRecognition.onresult = function(event) {
        const spokenText = event.results[0][0].transcript;
        alert(`✅ Voice recognition working! You said: "${spokenText}"`);
    };
    
    testRecognition.onerror = function(event) {
        alert('❌ Voice recognition test failed: ' + event.error);
    };
}

function checkCallingProgress() {
    fetch('/calling_status')
        .then(response => response.json())
        .then(data => {
            document.getElementById('progressFill').style.width = data.progress + '%';
            document.getElementById('progressText').textContent = `Progress: ${data.progress}%`;
            document.getElementById('currentNumber').textContent = data.current_number;
            
            // Update call stats
            updateCallStats();
            
            if (data.running) {
                setTimeout(checkCallingProgress, 2000);
            } else {
                showCompletion();
            }
        });
}

function updateCallStats() {
    // Simulate real-time stats update
    const connected = Math.floor(Math.random() * 5);
    const failed = Math.floor(Math.random() * 3);
    document.getElementById('connectedCount').textContent = `${connected} connected`;
    document.getElementById('failedCount').textContent = `${failed} failed`;
}

function showCompletion() {
    document.getElementById('progressText').textContent = 'Calling completed! ✅';
    document.getElementById('progressFill').style.backgroundColor = '#28a745';
    
    setTimeout(() => {
        viewLogs();
    }, 2000);
}

function viewLogs() {
    window.location.href = '/call_logs';
}

// Initialize voice features
document.addEventListener('DOMContentLoaded', function() {
    const sampleNumbers = [
        '18005551234',
        '18005559876', 
        '18004443333',
        '18007775555',
        '18009998888'
    ].join('\n');
    
    document.getElementById('phoneNumbers').value = sampleNumbers;
    
    // Add voice command examples
    const examples = [
        "call 18005551234",
        "make a call to 18004443333", 
        "dial 18009998888",
        "call +918126963928"
    ];
    
    // Voice command help
    const voiceHelp = document.createElement('div');
    voiceHelp.className = 'voice-help';
    voiceHelp.innerHTML = `
        <strong>Voice Command Examples:</strong><br>
        ${examples.map(cmd => `• "${cmd}"`).join('<br>')}
    `;
    document.querySelector('.ai-section').appendChild(voiceHelp);
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        startCalling();
    }
    if (e.key === 'Escape' && isListening) {
        stopVoiceCommand();
    }
});