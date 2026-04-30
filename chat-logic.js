/* ============================================
   AVA Assistant — chat-logic.js
   Integration for ChatGPT Clone Interface
   ============================================ */

const CONFIG = {
    CHAT_WEBHOOK_URL: 'https://n8n2.omelhorvendedoronline.com.br/webhook/ava-chat',
    SESSION_KEY: 'ava_session_id'
};

const STATE = {
    sessionId: localStorage.getItem(CONFIG.SESSION_KEY) || genId(),
    isWaiting: false
};

function genId() {
    const id = 'ava_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem(CONFIG.SESSION_KEY, id);
    return id;
}

// DOM Elements
const textarea = document.querySelector('textarea[name="prompt-textarea"]');
const sendButton = document.querySelector('[data-testid="send-button"]');
const thread = document.querySelector('#thread');
const welcomeState = document.querySelector('.composer-parent') || document.querySelector('main > div:first-child'); 

// Initialize
function init() {
    if (!textarea) return;

    // Adjust textarea height and enable/disable send button
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        
        if (sendButton) {
            if (textarea.value.trim().length > 0) {
                sendButton.disabled = false;
                sendButton.style.opacity = '1';
            } else {
                sendButton.disabled = true;
                sendButton.style.opacity = '0.5';
            }
        }
    });

    // Handle Enter key
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button click
    if (sendButton) {
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    // Form submit fallback
    const form = textarea.closest('form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }

    console.log("AVA Chat Logic Initialized. Session:", STATE.sessionId);
}

async function sendMessage() {
    const text = textarea.value.trim();
    if (!text || STATE.isWaiting) return;

    // Clear input
    textarea.value = '';
    textarea.style.height = 'auto';

    // Hide welcome state on first message
    if (welcomeState && welcomeState.style.display !== 'none') {
        welcomeState.style.display = 'none';
        // Ensure thread is visible and clean for bubbles
        thread.classList.add('active-chat');
    }

    // Add User Bubble
    appendBubble('user', text);

    STATE.isWaiting = true;
    
    // Show Typing indicator (optional, but let's add a simple one)
    const typingBubble = appendBubble('assistant', '...', true);

    try {
        const response = await fetch(CONFIG.CHAT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                sessionId: STATE.sessionId,
                source: 'web_chat_v2'
            })
        });

        const data = await response.json();
        
        // Remove typing indicator
        typingBubble.remove();

        if (data && data.output) {
            appendBubble('assistant', data.output);
        } else {
            appendBubble('assistant', 'Desculpe, tive um problema ao processar sua mensagem.');
        }
    } catch (error) {
        console.error("Error calling n8n:", error);
        typingBubble.remove();
        appendBubble('assistant', 'Erro de conexão com o servidor. Verifique sua internet.');
    } finally {
        STATE.isWaiting = false;
    }
}

function appendBubble(role, text, isTyping = false) {
    const bubble = document.createElement('div');
    bubble.className = `w-full text-token-text-primary border-b border-black/10 dark:border-gray-900/50 ${role === 'assistant' ? 'bg-gray-50 dark:bg-[#444654]' : ''}`;
    
    const inner = `
        <div class="p-4 justify-center text-base md:gap-6 md:py-6 m-auto">
            <div class="flex flex-1 text-base mx-auto gap-3 md:px-5 lg:px-1 xl:px-5 md:max-w-3xl lg:max-w-[40rem] xl:max-w-[48rem] group">
                <div class="flex-shrink-0 flex flex-col relative items-end">
                    <div class="w-[30px] h-[30px] rounded-sm flex items-center justify-center relative ${role === 'assistant' ? 'bg-[#10a37f] text-white' : 'bg-gray-300'}">
                        ${role === 'assistant' ? 'AVA' : 'U'}
                    </div>
                </div>
                <div class="relative flex w-full flex-col">
                    <div class="font-semibold select-none">${role === 'assistant' ? 'AVA Assistant' : 'Você'}</div>
                    <div class="flex-col gap-1 md:gap-3">
                        <div class="flex flex-grow flex-col max-w-full">
                            <div class="min-h-[20px] text-message flex flex-col items-start gap-3 whitespace-pre-wrap break-words">
                                ${text}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    bubble.innerHTML = inner;
    thread.appendChild(bubble);
    
    // Auto scroll
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    
    return bubble;
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
