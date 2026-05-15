const GEMINI_API_KEY = 'AIzaSyDQL6g-7cEBzPxMTXXLwbVpryKG0HiZBkc';

document.addEventListener('DOMContentLoaded', () => {

    const complaintsList = document.getElementById('complaints-list');
    const complaintForm = document.getElementById('complaint-form');

    // Utility: Get complaints from LocalStorage
    const getComplaints = () => {
        const data = localStorage.getItem('complaints');
        return data ? JSON.parse(data) : [];
    };

    // Utility: Save complaints to LocalStorage
    const saveComplaint = (complaint) => {
        const complaints = getComplaints();
        complaints.unshift(complaint); // Add new complaint to the start
        localStorage.setItem('complaints', JSON.stringify(complaints));
    };

    // Render complaints on Dashboard
    if (complaintsList) {
        const complaints = getComplaints();

        if (complaints.length === 0) {
            complaintsList.innerHTML = `
                <div class="no-data fade-in">
                    <p>No complaints registered yet. Click on "+ Add Complaint" to submit one.</p>
                </div>
            `;
        } else {
            complaints.forEach((c, index) => {
                // Ensure text is safely rendered (basic HTML escape)
                const safeName = escapeHTML(c.name);
                const safeCity = escapeHTML(c.city);
                const safeMobile = escapeHTML(c.mobile);
                const safeText = escapeHTML(c.text);
                const date = new Date(c.timestamp).toLocaleString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                const card = document.createElement('div');
                card.className = 'card complaint-card fade-in';
                // stagger animation delays
                card.style.animationDelay = `${index * 0.05}s`;

                card.innerHTML = `
                    <h3>${safeName}</h3>
                    <div class="complaint-meta">
                        <span>📍 ${safeCity}</span>
                        <span>📞 ${safeMobile}</span>
                        <span>🕒 ${date}</span>
                    </div>
                    <p class="complaint-text">${safeText}</p>
                `;

                if (c.aiQuestion && c.userAnswer) {
                    card.innerHTML += `
                        <div class="ai-qa-section">
                            <p class="ai-q">AI Follow-up: ${escapeHTML(c.aiQuestion)}</p>
                            <p class="ai-a">Answer: ${escapeHTML(c.userAnswer)}</p>
                        </div>
                    `;
                }

                complaintsList.appendChild(card);
            });
        }
    }

    // Handle form submission on Add page
    if (complaintForm) {
        let pendingComplaint = null;
        let generatedQuestion = '';

        const aiModal = document.getElementById('ai-modal');
        const aiLoading = document.getElementById('ai-loading');
        const aiQuestionContainer = document.getElementById('ai-question-container');
        const aiQuestionText = document.getElementById('ai-question-text');
        const aiAnswerInput = document.getElementById('ai-answer');
        const aiSkipBtn = document.getElementById('ai-skip-btn');
        const aiSubmitBtn = document.getElementById('ai-submit-btn');

        const finalizeComplaint = (aiQ, userA) => {
            if (!pendingComplaint) return;

            if (aiQ && userA) {
                pendingComplaint.aiQuestion = aiQ;
                pendingComplaint.userAnswer = userA;
            }

            saveComplaint(pendingComplaint);

            const btn = complaintForm.querySelector('button[type="submit"]');
            btn.innerText = 'Submitted Successfully!';
            btn.style.background = '#10B981'; // Success green color

            if (aiModal) {
                aiModal.classList.add('hidden');
            }

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 800);
        };

        complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const city = document.getElementById('city').value.trim();
            const mobile = document.getElementById('mobile').value.trim();
            const text = document.getElementById('complaintText').value.trim();

            if (name && city && mobile && text) {
                pendingComplaint = {
                    id: Date.now().toString(),
                    name,
                    city,
                    mobile,
                    text,
                    timestamp: new Date().toISOString()
                };

                // Show modal and loading state
                aiModal.classList.remove('hidden');
                aiLoading.classList.remove('hidden');
                aiQuestionContainer.classList.add('hidden');

                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': GEMINI_API_KEY
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Based on the following complaint description, ask one single specific short follow-up question to gather more relevant details. Return only the question text.\n\nComplaint: ${text}`
                                }]
                            }]
                        })
                    });

                    if (!response.ok) {
                        throw new Error('API request failed');
                    }

                    const data = await response.json();
                    generatedQuestion = data.candidates[0].content.parts[0].text.trim();

                    // Hide loading, show question
                    aiLoading.classList.add('hidden');
                    aiQuestionContainer.classList.remove('hidden');
                    aiQuestionText.textContent = generatedQuestion;
                    aiAnswerInput.value = '';

                } catch (error) {
                    console.error('Error fetching AI question:', error);
                    // On error (or invalid key), just finalize the complaint immediately
                    finalizeComplaint(null, null);
                }
            }
        });

        if (aiSkipBtn) {
            aiSkipBtn.addEventListener('click', () => {
                finalizeComplaint(null, null);
            });
        }

        if (aiSubmitBtn) {
            aiSubmitBtn.addEventListener('click', () => {
                const answer = aiAnswerInput.value.trim();
                // If user didn't enter an answer, treat it as skip
                if (!answer) {
                    finalizeComplaint(null, null);
                } else {
                    finalizeComplaint(generatedQuestion, answer);
                }
            });
        }
    }

    // Helper for basic XSS protection when injecting values via innerHTML
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
