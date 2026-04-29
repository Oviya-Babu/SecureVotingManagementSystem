// ============================================================
// app.js — Secure Voting System Frontend Logic
// ============================================================

const API = '/api';
const PARTY_COLORS = {TSV:'#FF6B35',PVM:'#1A3A8F',PAS:'#16803C',PRO:'#8B5CF6',NVM:'#DC2626',NOTA:'#6B7280'};

// Global state
let currentVoter = null;
let selectedCandidate = null;
let liveInterval = null;
let seatsChart = null;
let voteShareChart = null;

// ── Screen Navigation ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(id);
  if (screen) screen.classList.add('active');

  if (id === 'screen-results') loadResultsDashboard();
  if (id === 'screen-admin') loadAdminDashboard();
  if (id === 'screen-landing') loadTicker();
  if (id === 'screen-vote' && currentVoter) loadCandidates();

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
});

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

  btn.querySelector('.btn-text').textContent = 'Verifying...';
  btn.querySelector('.btn-loader').style.display = 'inline-block';
  btn.disabled = true;
  errorBox.style.display = 'none';

  try {
    const res = await fetch(`${API}/auth/aadhaar`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ aadhaar })
    });
    const data = await res.json();

    if (data.success) {
      currentVoter = data;
      // Update biometric screen
      document.getElementById('bio-voter-name').textContent = data.voterName;
      document.getElementById('bio-constituency').textContent = data.constituencyName;
      document.getElementById('bio-region').textContent = data.regionName;
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

// ── Biometric Scan ──
async function startBiometricScan() {
  const zone = document.getElementById('scanner-zone');
  const progress = document.getElementById('scanner-progress');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('scanner-label');
  const ptext = document.getElementById('progress-text');
  const errorBox = document.getElementById('bio-error');
  const proceedBtn = document.getElementById('btn-proceed-vote');

  if (zone.classList.contains('scanning') || zone.classList.contains('success')) return;

  zone.classList.add('scanning');
  label.textContent = 'Scanning... Hold finger steady';
  progress.style.display = 'block';
  errorBox.style.display = 'none';
  fill.style.width = '0%';

  // Animate progress over 2 seconds
  let pct = 0;
  const interval = setInterval(() => {
    pct += 2;
    fill.style.width = pct + '%';
    if (pct >= 100) clearInterval(interval);
  }, 40);

  // Wait 2 seconds then call API
  await new Promise(r => setTimeout(r, 2100));

  try {
    const res = await fetch(`${API}/auth/biometric`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ 
        voterID: currentVoter.voterID,
        fingerprint: currentVoter.aadhaarNumber 
      })
    });
    const data = await res.json();

    zone.classList.remove('scanning');

    if (data.success) {
      zone.classList.add('success');
      label.textContent = '✓ Fingerprint Verified';
      document.getElementById('scanner-icon').innerHTML = '<span style="font-size:48px;color:#16803C">✓</span>';
      ptext.textContent = 'Biometric verified successfully';
      fill.style.background = '#16803C';
      proceedBtn.style.display = 'block';
    } else {
      zone.classList.add('failed');
      label.textContent = '✕ Verification Failed';
      fill.style.background = '#C0260D';
      ptext.textContent = data.message;
      errorBox.style.display = 'flex';
      errorBox.querySelector('.error-text').textContent = data.message;
      // Allow retry
      setTimeout(() => {
        zone.classList.remove('failed');
        label.textContent = 'Tap to retry';
        progress.style.display = 'none';
      }, 3000);
    }
  } catch (err) {
    zone.classList.remove('scanning');
    zone.classList.add('failed');
    label.textContent = 'Connection error';
    errorBox.style.display = 'flex';
    errorBox.querySelector('.error-text').textContent = 'Server connection failed.';
    setTimeout(() => { zone.classList.remove('failed'); label.textContent = 'Tap to retry'; }, 3000);
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
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        voterID: currentVoter.voterID,
        candidateID: selectedCandidate.CandidateID,
        electionID: 1
      })
    });
    const data = await res.json();

    if (data.success) {
      // Show success screen
      document.getElementById('receipt-voteid').textContent = data.voteID;
      document.getElementById('receipt-hash').textContent = data.receiptHash ? data.receiptHash.substring(0, 32) + '...' : 'N/A';
      document.getElementById('receipt-timestamp').textContent = new Date(data.timestamp).toLocaleString();
      document.getElementById('receipt-constituency').textContent = currentVoter.constituencyName;

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

// ── Ticker ──
async function loadTicker() {
  try {
    const res = await fetch(`${API}/results/live`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('ticker-votes').textContent = data.totalVotes.toLocaleString();
      document.getElementById('ticker-turnout').textContent = data.turnout + '%';
      const leading = data.partyTally && data.partyTally.length > 0 ? data.partyTally[0].PartyCode : '—';
      document.getElementById('ticker-leading').textContent = leading;
    }
  } catch (e) { /* silent */ }
}

// ── Results Dashboard ──
async function loadResultsDashboard() {
  try {
    // Summary
    const sumRes = await fetch(`${API}/results/summary`);
    const sum = await sumRes.json();
    if (sum.success) {
      document.getElementById('stat-totalvotes').textContent = sum.totalVotesCast.toLocaleString();
      document.getElementById('stat-turnout').textContent = sum.turnoutPercentage + '%';
      document.getElementById('stat-seats').textContent = sum.seatsDecided + '/36';
      document.getElementById('stat-winner').textContent = sum.winningParty || '—';

      if (sum.winningParty && sum.seatsDecided > 0) {
        document.getElementById('winner-banner').style.display = 'flex';
        document.getElementById('winner-party-name').textContent = sum.winningParty;
      }
    }

    // Final results for charts
    const finalRes = await fetch(`${API}/results/final`);
    const finalData = await finalRes.json();
    if (finalData.success && finalData.results) {
      renderCharts(finalData.results);
      renderScoreboard(finalData.results);
    }

    // Winners for table
    const winRes = await fetch(`${API}/results/winners`);
    const winData = await winRes.json();
    if (winData.success) {
      renderWinnersTable(winData.winners);
    }

    // Start live polling
    if (!liveInterval) {
      liveInterval = setInterval(async () => {
        try {
          const lr = await fetch(`${API}/results/live`);
          const ld = await lr.json();
          if (ld.success) {
            document.getElementById('stat-totalvotes').textContent = ld.totalVotes.toLocaleString();
            document.getElementById('stat-turnout').textContent = ld.turnout + '%';
          }
        } catch (e) { /* silent */ }
      }, 10000);
    }
  } catch (err) {
    console.error('Failed to load results:', err);
  }
}

function renderCharts(results) {
  const parties = results.filter(r => r.PartyCode !== 'NOTA');
  const labels = parties.map(r => r.PartyCode);
  const seats = parties.map(r => r.SeatsWon || 0);
  const votes = parties.map(r => r.TotalVotes || 0);
  const colors = labels.map(l => PARTY_COLORS[l] || '#6B7280');

  // Seats Bar Chart
  const seatsCtx = document.getElementById('chart-seats');
  if (seatsChart) seatsChart.destroy();
  seatsChart = new Chart(seatsCtx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Seats Won', data: seats, backgroundColor: colors, borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });

  // Vote Share Doughnut
  const vsCtx = document.getElementById('chart-voteshare');
  if (voteShareChart) voteShareChart.destroy();
  voteShareChart = new Chart(vsCtx, {
    type: 'doughnut',
    data: { labels: parties.map(r => r.PartyName || r.PartyCode), datasets: [{ data: votes, backgroundColor: colors }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } } } }
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
    tbody.innerHTML += `<tr>
      <td>${w.ConstituencyName}</td>
      <td>${w.CandidateName}</td>
      <td><span style="color:${color};font-weight:600">${w.PartyCode}</span></td>
      <td>${w.WinningVotes || 0}</td>
    </tr>`;
  });

  // Search filter
  document.getElementById('constituency-search').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };
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
    const res = await fetch(`${API}/results/summary`);
    const data = await res.json();
    if (data.success) {
      document.getElementById('admin-total-voters').textContent = data.totalRegisteredVoters;
      document.getElementById('admin-total-votes').textContent = data.totalVotesCast;
      document.getElementById('admin-turnout').textContent = data.turnoutPercentage + '%';
      document.getElementById('admin-seats').textContent = data.seatsDecided;
    }
  } catch (e) { /* silent */ }
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
    const res = await fetch(`${API}/admin/simulate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ electionID: 1 }) });
    const data = await res.json();
    if (data.success) {
      simLog(`✅ Simulation complete: ${data.totalVotes} votes cast`);
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
    const res = await fetch(`${API}/admin/mark-winners`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ electionID: 1 }) });
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
    const res = await fetch(`${API}/admin/reset-votes`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ confirmReset: 'CONFIRM_RESET_2025' }) });
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
        pag.innerHTML += `<button class="${i===page?'active':''}" onclick="loadVoters(${i})">${i}</button>`;
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

// Modal
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
