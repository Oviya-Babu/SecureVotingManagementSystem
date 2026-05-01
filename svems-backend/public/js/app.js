// ============================================================
// app.js — Secure Voting System Frontend Logic
// ============================================================

const API = '/api';
const PARTY_COLORS = { TSV: '#FF6B35', PVM: '#1A3A8F', PAS: '#16803C', PRO: '#8B5CF6', WIN: '#DC2626', NOTA: '#6B7280' };

// Global state
let currentVoter = null;
let sessionToken = null;     // JWT token — upgraded after each auth step
let selectedCandidate = null;
let liveInterval = null;
let seatsChart = null;
let voteShareChart = null;

// ── Screen Navigation ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);

  if (id === 'screen-landing') {
    checkElectionStatus();
    loadTicker();
  }
  if (id === 'screen-results') loadResults();
  if (id === 'screen-admin') loadAdminDashboard();
  if (id === 'screen-vote') loadCandidates();

  // ROOT CAUSE A FIX: Reset biometric UI whenever navigating TO the biometric screen.
  // Without this, User A's verified state (green tick, 'success' class) persists
  // for User B — zone.classList.contains('success') would short-circuit the scan.
  if (id === 'screen-biometric') resetBiometricUI();

  // Stop live polling when leaving results
  if (id !== 'screen-results' && liveInterval) {
    clearInterval(liveInterval);
    liveInterval = null;
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  loadTicker();
  setupAadhaarInput();
  checkElectionStatus();
});

// ROOT CAUSE F FIX: Use /status (always available) instead of /summary (Closed-only)
async function checkElectionStatus() {
  try {
    const res = await fetch(`${API}/results/status`);
    const data = await res.json();
    if (!data.success) return;

    const status = data.electionStatus; // 'Active', 'Upcoming', 'Closed'
    const navResults = document.getElementById('nav-results');
    const badge = document.getElementById('election-status-badge');
    const startBtn = document.getElementById('btn-start-voting');

    navResults.style.display = 'inline-block';

    if (status === 'Closed') {
      navResults.textContent = 'Final Results';
      badge.textContent = 'Election Completed';
      if (startBtn) { startBtn.disabled = true; startBtn.innerHTML = 'Voting Closed'; }
    } else if (status === 'Upcoming') {
      navResults.textContent = 'Live Results';
      badge.textContent = 'Polls Not Yet Open';
      if (startBtn) { startBtn.disabled = true; startBtn.innerHTML = 'Voting Not Started'; }
    } else {
      navResults.textContent = 'Live Results';
      badge.textContent = 'Polls Active';
    }
  } catch (e) {
    const navResults = document.getElementById('nav-results');
    if (navResults) navResults.style.display = 'inline-block';
  }
}

// ROOT CAUSE A+B FIX: Full state teardown on cancel
function cancelVoting() {
  currentVoter = null;
  selectedCandidate = null;
  sessionToken = null;

  const input = document.getElementById('aadhaar-input');
  if (input) { input.value = ''; input.classList.remove('valid', 'invalid'); }
  const error = document.getElementById('aadhaar-error');
  if (error) error.style.display = 'none';
  const btn = document.getElementById('btn-verify-aadhaar');
  if (btn) btn.disabled = true;
  const hint = document.getElementById('aadhaar-hint');
  if (hint) { hint.textContent = 'Enter 12 digits'; hint.style.color = ''; }

  resetBiometricUI();
  showScreen('screen-landing');
}

// Complete biometric scanner state reset — called on every user transition.
function resetBiometricUI() {
  const zone = document.getElementById('scanner-zone');
  if (zone) zone.className = 'scanner-zone';

  const label = document.getElementById('scanner-label');
  if (label) label.textContent = 'Awaiting fingerprint scan';

  const icon = document.getElementById('scanner-icon');
  if (icon) icon.innerHTML = `<svg viewBox="0 0 64 64" width="48" height="48"><path d="M32 4C17.6 4 6 15.6 6 30c0 14.4 11.6 26 26 26s26-11.6 26-26C58 15.6 46.4 4 32 4z M32 8c5.2 0 10 1.8 13.8 4.8C42 16.4 37.2 18 32 18s-10-1.6-13.8-5.2C22 8 26.8 8 32 8z M32 52c-12.2 0-22-9.8-22-22 0-3.4.8-6.6 2.2-9.4C16.2 24.4 23.6 26 32 26s15.8-1.6 19.8-5.4C53.2 23.4 54 26.6 54 30c0 12.2-9.8 22-22 22z" fill="currentColor" opacity="0.8"/><path d="M32 12c-3.6 0-7 .6-10 1.8 3 2.4 6.4 3.8 10 3.8s7-1.4 10-3.8c-3-1.2-6.4-1.8-10-1.8z M20 30c0 6.6 5.4 12 12 12s12-5.4 12-12c0-2-.5-3.8-1.4-5.4-3 2-6.8 3.2-10.6 3.2s-7.6-1.2-10.6-3.2C20.5 26.2 20 28 20 30z M32 38c-4.4 0-8-3.6-8-8 0-1.2.3-2.4.8-3.4 2.2 1 4.6 1.6 7.2 1.6s5-0.6 7.2-1.6c.5 1 .8 2.2.8 3.4 0 4.4-3.6 8-8 8z" fill="currentColor" opacity="0.5"/></svg>`;

  const progress = document.getElementById('scanner-progress');
  if (progress) progress.style.display = 'none';
  const fill = document.getElementById('progress-fill');
  if (fill) { fill.style.width = '0%'; fill.style.background = ''; }
  const ptext = document.getElementById('progress-text');
  if (ptext) ptext.textContent = 'Scanning...';

  const bioError = document.getElementById('bio-error');
  if (bioError) bioError.style.display = 'none';

  const proceedBtn = document.getElementById('btn-proceed-vote');
  if (proceedBtn) proceedBtn.style.display = 'none';

  // FIX: Clear fingerprint input so next user cannot reuse previous scan's data
  const fpInput = document.getElementById('fingerprint-input');
  if (fpInput) fpInput.value = '';

  // FIX: Re-enable the scan button until user provides input
  const scanBtn = document.getElementById('btn-scan-fingerprint');
  if (scanBtn) {
    scanBtn.style.display = 'block';
    scanBtn.disabled = true;
    scanBtn.querySelector('.btn-text').textContent = '🔍 Scan Fingerprint';
    scanBtn.querySelector('.btn-loader').style.display = 'none';
  }

  // Restore input group visibility
  const grp = document.getElementById('fingerprint-input-group');
  if (grp) grp.style.display = 'block';
}

function setupAadhaarInput() {
  const input = document.getElementById('aadhaar-input');
  if (!input) return;
  input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 12);
    // Format as XXXX XXXX XXXX
    let formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
    e.target.value = formatted;

    const btn = document.getElementById('btn-verify-aadhaar');
    const hint = document.getElementById('aadhaar-hint');
    if (val.length === 12) {
      input.classList.remove('invalid');
      input.classList.add('valid');
      btn.disabled = false;
      hint.textContent = '✓ 12 digits entered';
      hint.style.color = '#16803C';
    } else {
      input.classList.remove('valid');
      if (val.length > 0 && val.length < 12) input.classList.add('invalid');
      else input.classList.remove('invalid');
      btn.disabled = true;
      hint.textContent = `${val.length}/12 digits`;
      hint.style.color = '';
    }

    // Hide error on typing
    document.getElementById('aadhaar-error').style.display = 'none';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !document.getElementById('btn-verify-aadhaar').disabled) {
      verifyAadhaar();
    }
  });
}

function fillAadhaar(num) {
  const input = document.getElementById('aadhaar-input');
  input.value = num.replace(/(\d{4})(?=\d)/g, '$1 ');
  input.dispatchEvent(new Event('input'));
}

// ── Aadhaar Verification ──
async function verifyAadhaar() {
  const input = document.getElementById('aadhaar-input');
  const aadhaar = input.value.replace(/\s/g, '');
  const btn = document.getElementById('btn-verify-aadhaar');
  const errorBox = document.getElementById('aadhaar-error');

  // RESET biometric state for the new user attempt
  resetBiometricUI();

  btn.querySelector('.btn-text').textContent = 'Verifying...';
  btn.querySelector('.btn-loader').style.display = 'inline-block';
  btn.disabled = true;
  errorBox.style.display = 'none';

  try {
    const res = await fetch(`${API}/auth/aadhaar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaar })
    });
    const data = await res.json();

    if (data.success) {
      currentVoter = data;
      sessionToken = data.token; // Store step-1 JWT
      // Update biometric screen
      document.getElementById('bio-voter-name').textContent = data.voterName;
      document.getElementById('bio-constituency').textContent = data.constituencyName;
      document.getElementById('bio-region').textContent = data.regionName;

      // Reset fingerprint input field
      const fpInput = document.getElementById('fingerprint-input');
      if (fpInput) fpInput.value = '';

      showScreen('screen-biometric');
    } else {
      errorBox.style.display = 'flex';
      errorBox.querySelector('.error-text').textContent = data.message;
    }
  } catch (err) {
    errorBox.style.display = 'flex';
    errorBox.querySelector('.error-text').textContent = 'Connection error. Is the server running?';
  }

  btn.querySelector('.btn-text').textContent = 'Verify Aadhaar';
  btn.querySelector('.btn-loader').style.display = 'none';
  btn.disabled = false;
}

// ── Biometric Scan Input Gate ──
// Enables/disables the scan button based on input content.
function onFingerprintInput() {
  const fpInput = document.getElementById('fingerprint-input');
  const scanBtn = document.getElementById('btn-scan-fingerprint');
  if (!fpInput || !scanBtn) return;
  // Require at least 6 characters before enabling scan
  scanBtn.disabled = fpInput.value.trim().length < 6;
}

// ── Biometric Scan ── (UI SIMULATION ONLY — no backend call)
// Shows fingerprint animation and always succeeds after 2.5s.
// Real security enforcement is done by Aadhaar check + vote deduplication in DB.
// ── Biometric Scan ──
async function startBiometricScan() {
  const fpInput = document.getElementById('fingerprint-input');
  const scanBtn = document.getElementById('btn-scan-fingerprint');
  const zone = document.getElementById('scanner-zone');
  const progress = document.getElementById('scanner-progress');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('scanner-label');
  const ptext = document.getElementById('progress-text');
  const errorBox = document.getElementById('bio-error');
  const proceedBtn = document.getElementById('btn-proceed-vote');

  if (zone.classList.contains('scanning') || zone.classList.contains('success')) return;

  const fpValue = fpInput ? fpInput.value.trim() : '';
  if (fpValue.length < 6) {
    if (errorBox) {
      errorBox.style.display = 'flex';
      errorBox.querySelector('.error-text').textContent = 'Please enter your fingerprint code first.';
    }
    return;
  }

  // Disable scan button during animation
  if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.querySelector('.btn-text').textContent = 'Scanning...';
    scanBtn.querySelector('.btn-loader').style.display = 'inline-block';
  }
  if (errorBox) errorBox.style.display = 'none';

  zone.classList.add('scanning');
  label.textContent = 'Scanning... Hold finger steady';
  if (progress) progress.style.display = 'block';
  if (fill) { fill.style.width = '0%'; fill.style.background = ''; }

  // Animate progress bar over 2.5 seconds
  let pct = 0;
  const interval = setInterval(() => {
    pct += 2;
    if (fill) fill.style.width = pct + '%';
    if (pct >= 100) clearInterval(interval);
  }, 50);

  // Wait for animation then call API
  await new Promise(r => setTimeout(r, 2600));

  try {
    const res = await fetch(`${API}/auth/verify-biometric`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        aadhaar: currentVoter.aadhaarNumber,
        fingerprintCode: fpValue
      })
    });
    const data = await res.json();

    zone.classList.remove('scanning');

    if (data.success) {
      zone.classList.add('success');
      label.textContent = '✓ Fingerprint Verified';
      const icon = document.getElementById('scanner-icon');
      if (icon) icon.innerHTML = '<span style="font-size:48px;color:#16803C">✓</span>';
      if (ptext) { ptext.textContent = 'Biometric verified successfully'; }
      if (fill) { fill.style.width = '100%'; fill.style.background = '#16803C'; }

      // Hide input + scan button, reveal Proceed
      if (fpInput) {
        const grp = document.getElementById('fingerprint-input-group');
        if (grp) grp.style.display = 'none';
      }
      if (scanBtn) scanBtn.style.display = 'none';
      if (proceedBtn) proceedBtn.style.display = 'block';
    } else {
      zone.classList.add('failed');
      label.textContent = '✕ Verification Failed';
      if (fill) fill.style.background = '#C0260D';
      if (errorBox) {
        errorBox.style.display = 'flex';
        errorBox.querySelector('.error-text').textContent = data.message || 'Verification failed.';
      }
      // Re-enable for retry
      setTimeout(() => {
        zone.classList.remove('failed');
        label.textContent = 'Awaiting fingerprint scan';
        if (progress) progress.style.display = 'none';
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.querySelector('.btn-text').textContent = '🔍 Scan Fingerprint';
          scanBtn.querySelector('.btn-loader').style.display = 'none';
        }
      }, 3000);
    }
  } catch (err) {
    zone.classList.remove('scanning');
    zone.classList.add('failed');
    label.textContent = 'Connection error';
    if (errorBox) {
      errorBox.style.display = 'flex';
      errorBox.querySelector('.error-text').textContent = 'Server error. Please try again.';
    }
    setTimeout(() => {
      zone.classList.remove('failed');
      label.textContent = 'Awaiting fingerprint scan';
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.querySelector('.btn-text').textContent = '🔍 Scan Fingerprint';
      }
    }, 3000);
  }
}

// ── Load Candidates ──
async function loadCandidates() {
  if (!currentVoter) return;
  document.getElementById('vote-constituency').textContent = currentVoter.constituencyName;
  document.getElementById('vote-region').textContent = currentVoter.regionName;

  try {
    const res = await fetch(`${API}/candidates?constituencyID=${currentVoter.constituencyID}`);
    const data = await res.json();
    if (!data.success) return;

    const grid = document.getElementById('candidates-grid');
    const notaContainer = document.getElementById('nota-container');
    const notaSep = document.getElementById('nota-separator');
    grid.innerHTML = '';
    notaContainer.innerHTML = '';
    selectedCandidate = null;
    document.getElementById('confirm-box').style.display = 'none';

    data.candidates.forEach(c => {
      const color = PARTY_COLORS[c.PartyCode] || '#6B7280';
      const card = document.createElement('div');
      card.className = 'candidate-card' + (c.IsNOTA ? ' nota' : '');
      card.dataset.id = c.CandidateID;
      card.innerHTML = `
        <div class="party-badge" style="background:${color}">${c.PartyCode}</div>
        <div class="candidate-info">
          <div class="candidate-name">${c.CandidateName}</div>
          <div class="candidate-party">${c.PartyName}</div>
          ${c.AgeAtElection ? `<div class="candidate-meta">Age: ${c.AgeAtElection} · ${c.Education || ''}</div>` : ''}
        </div>
        <div class="candidate-radio"></div>
      `;
      card.onclick = () => selectCandidate(c, card);

      if (c.IsNOTA) {
        notaSep.style.display = 'flex';
        notaContainer.appendChild(card);
      } else {
        grid.appendChild(card);
      }
    });
  } catch (err) {
    console.error('Failed to load candidates:', err);
  }
}

function selectCandidate(candidate, cardEl) {
  document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  selectedCandidate = candidate;

  const confirmBox = document.getElementById('confirm-box');
  const color = PARTY_COLORS[candidate.PartyCode] || '#6B7280';
  document.getElementById('confirm-candidate-info').innerHTML =
    `<strong>${candidate.CandidateName}</strong> — <span style="color:${color}">${candidate.PartyName} (${candidate.PartyCode})</span>`;
  confirmBox.style.display = 'block';
  confirmBox.scrollIntoView({ behavior: 'smooth' });
}

function cancelSelection() {
  document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
  selectedCandidate = null;
  document.getElementById('confirm-box').style.display = 'none';
}

// ── Submit Vote ──
async function submitVote() {
  if (!selectedCandidate || !currentVoter) return;
  const btn = document.getElementById('btn-submit-vote');
  const errorBox = document.getElementById('vote-error');
  btn.querySelector('.btn-text').textContent = 'Submitting...';
  btn.querySelector('.btn-loader').style.display = 'inline-block';
  btn.disabled = true;
  errorBox.style.display = 'none';

  try {
    const res = await fetch(`${API}/vote/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}` // Pass fully-verified JWT
      },
      body: JSON.stringify({
        voterID: currentVoter.voterID,
        candidateID: selectedCandidate.CandidateID,
        electionID: 1
      })
    });
    const data = await res.json();

    if (data.success) {
      // 1. Update Results Instantly
      loadResultsDashboard();

      // 2. Show Success Screen
      document.getElementById('receipt-voteid').textContent = data.voteID;
      document.getElementById('receipt-hash').textContent = data.receiptHash;
      document.getElementById('receipt-timestamp').textContent = new Date(data.timestamp).toLocaleString();
      document.getElementById('receipt-constituency').textContent = currentVoter.constituencyName;
      showScreen('screen-success');

      // ROOT CAUSE B FIX: Destroy session after successful vote so it cannot be reused.
      // The JWT would still be valid for 15 min server-side, but clearing it here
      // means the frontend cannot submit a second vote attempt without full re-auth.
      sessionToken = null;
      currentVoter = null;
      selectedCandidate = null;
      resetBiometricUI(); // Also reset scanner so next user starts clean

      // Immediately refresh ticker
      loadTicker();

      showScreen('screen-success');

      // Lock back navigation
      history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', () => {
        history.pushState(null, '', window.location.href);
      });
    } else {
      errorBox.style.display = 'flex';
      errorBox.querySelector('.error-text').textContent = data.message;
    }
  } catch (err) {
    errorBox.style.display = 'flex';
    errorBox.querySelector('.error-text').textContent = 'Connection error. Please try again.';
  }

  btn.querySelector('.btn-text').textContent = 'Submit Vote';
  btn.querySelector('.btn-loader').style.display = 'none';
  btn.disabled = false;
}

// ── Ticker ── (uses /status for tie-aware leadingParty field)
async function loadTicker() {
  try {
    const res = await fetch(`${API}/results/status`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('ticker-votes').textContent = (data.totalVotes || 0).toLocaleString();
      document.getElementById('ticker-turnout').textContent = (data.turnout || '0.00') + '%';
      // ROOT CAUSE D FIX: Use pre-computed leadingParty which handles ties correctly
      document.getElementById('ticker-leading').textContent = data.leadingParty || '—';
    }
  } catch (e) { /* silent */ }
}

// ── Results Dashboard ──
// BUG1 FIX: loadResults() entry point (was undefined, called by showScreen)
async function loadResults() {
  await loadResultsDashboard();
}

async function loadResultsDashboard() {
  try {
    // BUG2 FIX: /status works during Active AND Closed — old code used /summary (Closed-only)
    const statusRes = await fetch(`${API}/results/status`);
    const status = await statusRes.json();
    if (!status.success) return;

    const isClosed = status.electionStatus === 'Closed';

    // Always show live totals
    document.getElementById('stat-totalvotes').textContent = (status.totalVotes || 0).toLocaleString();
    document.getElementById('stat-turnout').textContent = (status.turnout || '0.00') + '%';

    if (isClosed) {
      // Full results only when election is closed
      try {
        const sumRes = await fetch(`${API}/results/summary`);
        const sum = await sumRes.json();
        if (sum.success) {
          document.getElementById('stat-seats').textContent = sum.seatsDecided + '/36';
          document.getElementById('stat-winner').textContent = sum.winningParty || '—';
          if (sum.winningParty && sum.seatsDecided > 0) {
            document.getElementById('winner-banner').style.display = 'flex';
            document.getElementById('winner-party-name').textContent = sum.winningParty;
            document.getElementById('winner-party-seats').textContent = sum.seatsDecided + ' seats';
          }
        }
      } catch (_) { }

      try {
        const finalRes = await fetch(`${API}/results/final`);
        const finalData = await finalRes.json();
        if (finalData.success && finalData.results) {
          renderCharts(finalData.results);
          renderScoreboard(finalData.results);
        }
      } catch (_) { }

      try {
        const winRes = await fetch(`${API}/results/winners`);
        const winData = await winRes.json();
        if (winData.success) renderWinnersTable(winData.winners);
      } catch (_) { }

    } else {
      // Active election — show live party vote tallies, no winner/candidate data
      document.getElementById('stat-seats').textContent = '—';
      // ROOT CAUSE D FIX: Use pre-computed leadingParty (handles ties)
      document.getElementById('stat-winner').textContent = status.leadingParty || '—';
      document.getElementById('winner-banner').style.display = 'none';
      renderScoreboardFromLive(status.partyTally || [], status.totalVotes || 0, status.leadingParty);
      // FIX 10: Render live bar + pie charts for active election
      renderLiveCharts(status.partyTally || []);
      renderConstituencyLivePlaceholder();
    }

    // Live polling every 8 seconds
    if (!liveInterval) {
      liveInterval = setInterval(async () => {
        try {
          const lr = await fetch(`${API}/results/status`);
          const ld = await lr.json();
          if (ld.success) {
            document.getElementById('stat-totalvotes').textContent = (ld.totalVotes || 0).toLocaleString();
            document.getElementById('stat-turnout').textContent = (ld.turnout || '0.00') + '%';
            if (!isClosed) {
              document.getElementById('stat-winner').textContent = ld.leadingParty || '—';
              renderScoreboardFromLive(ld.partyTally || [], ld.totalVotes || 0, ld.leadingParty);
            }
          }
        } catch (e) { /* silent */ }
      }, 8000);
    }
  } catch (err) {
    console.error('Failed to load results:', err);
  }
}

// ROOT CAUSE E FIX: Enhanced live scoreboard with visual vote bars and leading indicator.
// Shows party vote counts with proportional bars — much more informative during active election.
function renderScoreboardFromLive(partyTally, totalVotes, leadingParty) {
  const board = document.getElementById('party-scoreboard');
  if (!board) return;
  board.innerHTML = '';
  const parties = partyTally.filter(r => r.PartyCode !== 'NOTA');
  const maxVotes = parties.reduce((m, r) => Math.max(m, Number(r.votes || 0)), 1);

  parties.forEach(r => {
    const color = PARTY_COLORS[r.PartyCode] || '#6B7280';
    const votes = Number(r.votes || 0);
    const barPct = maxVotes > 0 ? Math.round((votes / maxVotes) * 100) : 0;
    const isLeader = leadingParty && leadingParty !== 'TIE' && r.PartyCode === leadingParty;
    board.innerHTML += `
      <div class="party-score-card${isLeader ? ' leader' : ''}" style="border-top-color:${color}">
        ${isLeader ? '<div class="leader-badge">🏆 Leading</div>' : ''}
        <div class="party-code" style="color:${color}">${r.PartyCode}</div>
        <div class="party-name-small">${r.PartyName}</div>
        <div class="party-seats">${votes.toLocaleString()}</div>
        <div class="party-votes">votes</div>
        <div class="party-bar-track"><div class="party-bar-fill" style="width:${barPct}%;background:${color}"></div></div>
      </div>`;
  });

  if (leadingParty === 'TIE') {
    board.insertAdjacentHTML('afterbegin', '<div class="tie-banner">⚖ Election is currently tied between top parties</div>');
  }
}

function renderConstituencyLivePlaceholder() {
  const tbody = document.getElementById('constituency-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:32px"><div style="font-size:24px;margin-bottom:8px">🔒</div>Constituency results will be revealed after the election closes.</td></tr>';
}

// Final results charts (Closed election — shows seats won)
function renderCharts(results) {
  const parties = results.filter(r => r.PartyCode !== 'NOTA');
  const labels = parties.map(r => r.PartyCode);
  const seats = parties.map(r => r.SeatsWon || 0);
  const votes = parties.map(r => r.TotalVotes || 0);
  const colors = labels.map(l => PARTY_COLORS[l] || '#6B7280');
  const maxSeats = Math.max(...seats, 1);

  // Seats Bar Chart — highlight winner bar
  const seatsCtx = document.getElementById('chart-seats');
  if (seatsChart) seatsChart.destroy();
  seatsChart = new Chart(seatsCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Seats Won',
        data: seats,
        backgroundColor: colors.map((c, i) => seats[i] === maxSeats ? c : c + '99'),
        borderColor: colors,
        borderWidth: colors.map((_, i) => seats[i] === maxSeats ? 3 : 1),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} seats` } } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
    }
  });

  // Vote Share Doughnut
  const vsCtx = document.getElementById('chart-voteshare');
  if (voteShareChart) voteShareChart.destroy();
  voteShareChart = new Chart(vsCtx, {
    type: 'doughnut',
    data: { labels: parties.map(r => r.PartyName || r.PartyCode), datasets: [{ data: votes, backgroundColor: colors, hoverOffset: 12, borderWidth: 2 }] },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toLocaleString()} votes` } } }
    }
  });
}

// FIX 10: Live charts for Active election — shows votes per party (not seats)
function renderLiveCharts(partyTally) {
  const parties = (partyTally || []).filter(r => r.PartyCode !== 'NOTA');
  if (parties.length === 0) return;

  const labels = parties.map(r => r.PartyCode);
  const votes = parties.map(r => Number(r.votes) || 0);
  const colors = labels.map(l => PARTY_COLORS[l] || '#6B7280');
  const maxVotes = Math.max(...votes, 1);

  // Bar chart: votes per party
  const seatsCtx = document.getElementById('chart-seats');
  if (seatsChart) seatsChart.destroy();
  seatsChart = new Chart(seatsCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Votes',
        data: votes,
        backgroundColor: colors.map((c, i) => votes[i] === maxVotes && votes[i] > 0 ? c : c + '88'),
        borderColor: colors,
        borderWidth: colors.map((_, i) => votes[i] === maxVotes && votes[i] > 0 ? 3 : 1),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Live Votes per Party', font: { size: 14, weight: '600' }, color: '#1a3a8f' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toLocaleString()} votes` } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    }
  });

  // Doughnut: vote share
  const vsCtx = document.getElementById('chart-voteshare');
  if (voteShareChart) voteShareChart.destroy();
  const hasVotes = votes.some(v => v > 0);
  voteShareChart = new Chart(vsCtx, {
    type: 'doughnut',
    data: {
      labels: parties.map(r => r.PartyName || r.PartyCode),
      datasets: [{
        data: hasVotes ? votes : parties.map(() => 1), // equal slices until votes come in
        backgroundColor: hasVotes ? colors : colors.map(c => c + '44'),
        hoverOffset: 14,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      cutout: '60%',
      animation: { duration: 600 },
      plugins: {
        title: { display: true, text: hasVotes ? 'Vote Share' : 'Vote Share (Awaiting Votes)', font: { size: 14, weight: '600' }, color: '#1a3a8f' },
        legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => hasVotes ? ` ${ctx.raw.toLocaleString()} votes` : ' No votes yet' } }
      }
    }
  });
}

function renderScoreboard(results) {
  const board = document.getElementById('party-scoreboard');
  board.innerHTML = '';
  results.filter(r => r.PartyCode !== 'NOTA').forEach(r => {
    const color = PARTY_COLORS[r.PartyCode] || '#6B7280';
    board.innerHTML += `
      <div class="party-score-card" style="border-top-color:${color}">
        <div class="party-code" style="color:${color}">${r.PartyCode}</div>
        <div class="party-seats">${r.SeatsWon || 0}</div>
        <div class="party-votes">${(r.TotalVotes || 0).toLocaleString()} votes</div>
      </div>`;
  });
}

function renderWinnersTable(winners) {
  const tbody = document.getElementById('constituency-tbody');
  tbody.innerHTML = '';
  winners.forEach(w => {
    const color = PARTY_COLORS[w.PartyCode] || '#6B7280';
    // BUG7 FIX: API returns WinnerName alias, was using CandidateName (undefined)
    tbody.innerHTML += `<tr>
      <td>${w.ConstituencyName}</td>
      <td>${w.WinnerName || w.CandidateName || '—'}</td>
      <td><span style="color:${color};font-weight:600">${w.PartyCode}</span></td>
      <td>${w.WinningVotes || 0}</td>
    </tr>`;
  });

  const searchEl = document.getElementById('constituency-search');
  if (searchEl) {
    searchEl.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      tbody.querySelectorAll('tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
  }
}

// ── Admin Panel ──
function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const tab = document.getElementById('admin-' + tabName);
  if (tab) tab.classList.add('active');
  const link = document.getElementById('tab-' + tabName);
  if (link) link.classList.add('active');

  if (tabName === 'voters') loadVoters(1);
  if (tabName === 'candidates-tab') loadAdminCandidates();
  if (tabName === 'audit') loadAuditLog();
  if (tabName === 'dashboard') loadAdminDashboard();
}

async function loadAdminDashboard() {
  try {
    // BUG3 FIX: was calling /summary (Closed-only gate) — /status works always
    const res = await fetch(`${API}/results/status`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('admin-total-voters').textContent = (data.totalVoters || 0).toLocaleString();
      document.getElementById('admin-total-votes').textContent = (data.totalVotes || 0).toLocaleString();
      document.getElementById('admin-turnout').textContent = (data.turnout || '0.00') + '%';
      if (data.electionStatus === 'Closed') {
        try {
          const sumRes = await fetch(`${API}/results/summary`);
          const sum = await sumRes.json();
          if (sum.success) document.getElementById('admin-seats').textContent = sum.seatsDecided;
        } catch (_) { }
      } else {
        document.getElementById('admin-seats').textContent = '—';
      }
    }
  } catch (e) { console.error('Admin dashboard load failed:', e); }
}

function simLog(msg) {
  const log = document.getElementById('sim-log');
  const time = new Date().toLocaleTimeString();
  log.innerHTML += `<div>[${time}] ${msg}</div>`;
  log.scrollTop = log.scrollHeight;
}

async function runSimulation() {
  const btn = document.getElementById('btn-simulate');
  btn.disabled = true; btn.textContent = 'Running...';
  simLog('Starting bulk vote simulation...');
  try {
    const res = await fetch(`${API}/admin/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ electionID: 1 }) });
    const data = await res.json();
    if (data.success) {
      simLog(`✅ Simulation complete: ${data.totalVotes} votes cast`);
      // Update results instantly
      loadResultsDashboard();
    } else {
      simLog(`❌ Error: ${data.message}`);
    }
  } catch (e) { simLog(`❌ Connection error: ${e.message}`); }
  btn.disabled = false; btn.textContent = 'Run Simulation';
  loadAdminDashboard();
}

async function markWinners() {
  const btn = document.getElementById('btn-mark-winners');
  btn.disabled = true; btn.textContent = 'Processing...';
  simLog('Marking winners...');
  try {
    const res = await fetch(`${API}/admin/mark-winners`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ electionID: 1 }) });
    const data = await res.json();
    if (data.success) { simLog(`✅ Winners marked: ${data.winnersCount} constituencies`); }
    else { simLog(`❌ Error: ${data.message}`); }
  } catch (e) { simLog(`❌ Connection error: ${e.message}`); }
  btn.disabled = false; btn.textContent = 'Mark Winners';
  loadAdminDashboard();
}

async function resetDemo() {
  if (!confirm('This will delete ALL votes, results, and auth records. Continue?')) return;
  const btn = document.getElementById('btn-reset');
  btn.disabled = true; btn.textContent = 'Resetting...';
  simLog('Resetting all data...');
  try {
    const res = await fetch(`${API}/admin/reset-votes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmReset: 'CONFIRM_RESET_2025' }) });
    const data = await res.json();
    if (data.success) { simLog('✅ Reset complete. All votes cleared.'); }
    else { simLog(`❌ Error: ${data.message}`); }
  } catch (e) { simLog(`❌ Connection error: ${e.message}`); }
  btn.disabled = false; btn.textContent = 'Reset All Data';
  loadAdminDashboard();
}

async function loadVoters(page) {
  try {
    const res = await fetch(`${API}/admin/voters?page=${page}&limit=50`);
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('voters-tbody');
      tbody.innerHTML = '';
      data.voters.forEach(v => {
        tbody.innerHTML += `<tr>
          <td>${v.VoterID}</td><td>${v.VoterName}</td><td>${v.Gender}</td>
          <td>${v.ConstituencyName}</td><td>${v.RegionName}</td>
          <td>${v.HasVoted ? '<span style="color:#16803C">Voted</span>' : '<span style="color:#64748b">Not Voted</span>'}</td>
        </tr>`;
      });
      // Pagination
      const pages = Math.ceil(data.total / data.limit);
      const pag = document.getElementById('voters-pagination');
      pag.innerHTML = '';
      for (let i = 1; i <= Math.min(pages, 15); i++) {
        pag.innerHTML += `<button class="${i === page ? 'active' : ''}" onclick="loadVoters(${i})">${i}</button>`;
      }
    }
  } catch (e) { console.error(e); }
}

async function loadAdminCandidates() {
  try {
    const res = await fetch(`${API}/admin/candidates`);
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('candidates-tbody');
      tbody.innerHTML = '';
      data.candidates.forEach(c => {
        const color = PARTY_COLORS[c.PartyCode] || '#6B7280';
        tbody.innerHTML += `<tr>
          <td>${c.CandidateName}</td>
          <td><span style="color:${color};font-weight:600">${c.PartyCode}</span></td>
          <td>${c.ConstituencyName}</td>
          <td>${c.TotalVotes}</td>
          <td>${c.IsWinner ? '🏆' : ''}</td>
        </tr>`;
      });
    }
  } catch (e) { console.error(e); }
}

async function loadAuditLog() {
  try {
    const res = await fetch(`${API}/admin/audit-log`);
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('audit-tbody');
      tbody.innerHTML = '';
      data.auditLog.forEach(a => {
        tbody.innerHTML += `<tr>
          <td>${a.LogID}</td><td>${a.TableName}</td><td>${a.Action}</td>
          <td>${a.RecordID || ''}</td><td>${a.ChangedBy || ''}</td>
          <td>${a.ChangeTime ? new Date(a.ChangeTime).toLocaleString() : ''}</td>
        </tr>`;
      });
    }
  } catch (e) { console.error(e); }
}

// ── Modal ──
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  if (window._modalResolve) { window._modalResolve(false); window._modalResolve = null; }
}

// BUG4 FIX: confirmModal() was referenced in HTML but never defined
function confirmModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  if (window._modalResolve) { window._modalResolve(true); window._modalResolve = null; }
}

// Gate "Proceed to Vote" on biometric verification
function proceedToVote() {
  const zone = document.getElementById('scanner-zone');
  if (!zone.classList.contains('success')) {
    alert('Please complete biometric verification first.');
    return;
  }

  if (!sessionToken || !currentVoter) {
    showScreen('screen-aadhaar');
    return;
  }
  showScreen('screen-vote');
}
