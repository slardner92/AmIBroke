// ============================================
//  AM I BROKE? — Calculator Logic
// ============================================

const form    = document.getElementById('broke-form');
const results = document.getElementById('results');

// ---- Housing type toggle ----

let housingType = 'rent'; // 'rent' | 'mortgage'

const toggleBtns      = document.querySelectorAll('.housing-toggle__btn');
const housingLabel    = document.getElementById('housing-label');
const bedroomSelect   = document.getElementById('bedroom-select');

toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    housingType = btn.dataset.type;
    toggleBtns.forEach(b => b.classList.toggle('housing-toggle__btn--active', b === btn));
    housingLabel.textContent = housingType === 'rent' ? 'Monthly Rent ($)' : 'Monthly Mortgage ($)';
    bedroomSelect.hidden = housingType === 'mortgage';
  });
});

// ---- Bedroom selector ----

let bedroomKey = 'br1'; // default 1BR

const brBtns = document.querySelectorAll('.br-btn');
brBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    bedroomKey = btn.dataset.br;
    brBtns.forEach(b => b.classList.toggle('br-btn--active', b === btn));
  });
});

// ---- Comma formatting on $ inputs ----

const CURRENCY_INPUT_IDS = ['salary', 'housing', 'carPayment', 'debt'];

function addCommaFormatting(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', function () {
    const digits = this.value.replace(/[^\d]/g, '');
    this.value = digits === '' ? '' : Number(digits).toLocaleString('en-US');
  });
}

CURRENCY_INPUT_IDS.forEach(addCommaFormatting);

// ---- Helpers ----

function parseNumber(id) {
  const val = document.getElementById(id).value.replace(/,/g, '').trim();
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(n) {
  return n.toFixed(1) + '%';
}

// ---- Form submit (async) ----

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  // 1. Read inputs
  const salary  = parseNumber('salary');
  const housing = parseNumber('housing');
  const car     = parseNumber('carPayment');
  const zip     = document.getElementById('zipCode').value.trim();
  const debt    = parseNumber('debt');

  // 2. Validation
  if (salary <= 0) {
    alert('Please enter your annual salary.');
    document.getElementById('salary').focus();
    return;
  }

  // 3. Core calculations
  const monthlyIncome    = salary / 12;
  const housingBenchmark = housingType === 'rent' ? 30 : 36;
  const housingRatio     = (housing / monthlyIncome) * 100;
  const carRatio         = (car / monthlyIncome) * 100;
  const totalMonthlyDebt = housing + car + debt;
  const totalDebtRatio   = (totalMonthlyDebt / monthlyIncome) * 100;
  const freeCashFlow     = monthlyIncome - totalMonthlyDebt;

  // 4. Show loading (visible while HUD/Census fetch runs)
  showLoading();

  // 5. Conditionally fetch rent insight (renter + failing housing test + valid ZIP)
  let rentInsightData = null;
  if (housingType === 'rent' && housingRatio > 30 && zip.length === 5) {
    rentInsightData = await fetchRentInsight(zip, bedroomKey);
  }

  // 6. Render
  renderResults({
    salary, monthlyIncome, housing, housingType, housingBenchmark,
    car, debt, totalMonthlyDebt, freeCashFlow,
    housingRatio, carRatio, totalDebtRatio,
    zip, bedroomKey, rentInsightData,
  });
});

// ---- Loading state ----

function showLoading() {
  results.removeAttribute('hidden');
  results.innerHTML = `
    <div class="results-loading">
      <div class="results-loading__icon">💸</div>
      <h2 class="results-loading__title">JUDGING IN PROGRESS</h2>
      <p class="results-loading__subtitle">We're crunching the numbers to reveal your financial truth...</p>
    </div>
  `;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Rent insight: HUD SAFMR lookup ----

/**
 * Looks up the bedroom-specific SAFMR (federal rent benchmark) for a ZIP code.
 * Both the "typical rent" figure and any comparison are drawn from the same
 * bedroom-specific dataset, avoiding mixed-data inconsistencies.
 */
async function fetchRentInsight(zip, brKey) {
  try {
    if (!fetchRentInsight._cache) {
      const res = await fetch('data/hud_50pct.json');
      fetchRentInsight._cache = await res.json();
    }
    const entry = fetchRentInsight._cache[zip];
    const typicalRent = entry?.[brKey] ?? null;
    return typicalRent !== null ? { typicalRent } : null;
  } catch (_) {
    return null;
  }
}

// ---- Verdict logic ----

function getVerdict(housingRatio, totalDebtRatio, housingBenchmark, housingType) {
  const housingLbl = housingType === 'rent' ? 'rent' : 'mortgage';
  const tests = [
    {
      label:  `The ${housingBenchmark}% Housing Rule`,
      rule:   `≤ ${housingBenchmark}% of income on ${housingLbl}`,
      pass:   housingRatio <= housingBenchmark,
      actual: housingRatio,
    },
    {
      label:  'The 43% Total Debt Rule',
      rule:   '≤ 43% of income on all debt (housing + car + other)',
      pass:   totalDebtRatio <= 43,
      actual: totalDebtRatio,
    },
  ];

  const failures = tests.filter(t => !t.pass).length;

  let verdict, tagline, verdictClass;
  if (failures === 0) {
    verdict      = "YOU'RE KILLING IT";
    tagline      = "Seriously — your ratios are on point. Keep it up.";
    verdictClass = 'verdict--great';
  } else if (failures === 1) {
    verdict      = "YOU'RE OKAY";
    tagline      = "One area needs attention, but you're not underwater yet.";
    verdictClass = 'verdict--okay';
  } else {
    verdict      = "YOU'RE BROKE";
    tagline      = "The numbers don't lie. Time for a hard look at your finances.";
    verdictClass = 'verdict--broke';
  }

  return { verdict, tagline, verdictClass, tests };
}

// ---- Results renderer ----

function renderResults(data) {
  const { housingRatio, totalDebtRatio, housingBenchmark, housingType,
          monthlyIncome, freeCashFlow, totalMonthlyDebt,
          housing, zip, bedroomKey, rentInsightData } = data;

  const { verdict, tagline, verdictClass, tests } = getVerdict(
    housingRatio, totalDebtRatio, housingBenchmark, housingType
  );

  const testCards = tests.map(t => `
    <div class="result-test ${t.pass ? 'result-test--pass' : 'result-test--fail'}">
      <div class="result-test__icon">${t.pass ? '✅' : '❌'}</div>
      <div class="result-test__body">
        <p class="result-test__label">${t.label}</p>
        <p class="result-test__rule">${t.rule}</p>
      </div>
      <div class="result-test__actual ${t.pass ? 'result-test__actual--pass' : 'result-test__actual--fail'}">
        ${formatPercent(t.actual)}
      </div>
    </div>
  `).join('');

  // Rent insight chart (renter + failed housing + HUD data available)
  let rentInsightHtml = '';
  if (rentInsightData?.typicalRent) {
    const { typicalRent } = rentInsightData;
    const brLabel   = { br0: 'studio', br1: '1-bedroom', br2: '2-bedroom', br3: '3-bedroom', br4: '4-bedroom' }[bedroomKey];
    const isOver    = housing > typicalRent;
    const diffPct   = Math.round(Math.abs((housing - typicalRent) / typicalRent) * 100);
    const direction = isOver ? 'above' : 'below';

    // Both bars scale relative to whichever value is larger
    const maxVal    = Math.max(housing, typicalRent);
    const userPct   = (housing / maxVal) * 100;
    const benchPct  = (typicalRent / maxVal) * 100;

    rentInsightHtml = `
      <div class="rent-insight">
        <p class="rent-insight__label">📍 Local Rent Context</p>

        <div class="rent-chart">

          <div class="rent-chart__row">
            <span class="rent-chart__row-label">Your Rent</span>
            <div class="rent-chart__track">
              <div class="rent-chart__fill ${isOver ? 'rent-chart__fill--over' : 'rent-chart__fill--under'}" style="width:${userPct}%"></div>
            </div>
            <span class="rent-chart__row-amount ${isOver ? 'rent-chart__row-amount--over' : 'rent-chart__row-amount--under'}">${formatCurrency(housing)}</span>
          </div>

          <div class="rent-chart__row">
            <span class="rent-chart__row-label">Area Benchmark</span>
            <div class="rent-chart__track">
              <div class="rent-chart__fill rent-chart__fill--bench" style="width:${benchPct}%"></div>
            </div>
            <span class="rent-chart__row-amount">${formatCurrency(typicalRent)}</span>
          </div>

          <div class="rent-chart__footer">
            <span class="rent-chart__context">${brLabel} · ZIP ${zip}</span>
            <span class="rent-chart__badge ${isOver ? 'rent-chart__badge--over' : 'rent-chart__badge--under'}">
              ${diffPct}% ${direction}
            </span>
          </div>

        </div>

        ${isOver ? `
        <div class="rent-nudge">
          <p class="rent-nudge__icon">🔍</p>
          <div class="rent-nudge__body">
            <p class="rent-nudge__title">You may be overpaying — it's worth shopping around.</p>
            <p class="rent-nudge__text">Units comparable to yours are available in ZIP ${zip} for less. Landlords rarely volunteer a discount, but vacancy rates are up in many markets right now — meaning you have more leverage than you think. Check <strong>Zillow</strong>, <strong>Apartments.com</strong>, and <strong>Facebook Marketplace</strong> for current listings, and don't be afraid to negotiate your next renewal.</p>
          </div>
        </div>
        ` : ''}

      </div>
    `;
  }

  const cashFlowClass  = freeCashFlow >= 0 ? 'stat--positive' : 'stat--negative';
  const cashFlowPrefix = freeCashFlow >= 0 ? '+' : '';

  results.innerHTML = `
    <div class="results-inner">

      <span class="step-label">STEP 02</span>

      <div class="verdict ${verdictClass}">
        <p class="verdict__eyebrow">Your verdict</p>
        <h2 class="verdict__title">${verdict}</h2>
        <p class="verdict__tagline">${tagline}</p>
      </div>

      <div class="result-tests">
        ${testCards}
      </div>

      ${rentInsightHtml}

      <div class="result-stats">
        <div class="stat">
          <span class="stat__label">Monthly Income</span>
          <span class="stat__value">${formatCurrency(monthlyIncome)}</span>
        </div>
        <div class="stat">
          <span class="stat__label">Total Monthly Debt</span>
          <span class="stat__value">${formatCurrency(totalMonthlyDebt)}</span>
        </div>
        <div class="stat ${cashFlowClass}">
          <span class="stat__label">Free Cash Flow</span>
          <span class="stat__value">${cashFlowPrefix}${formatCurrency(freeCashFlow)}</span>
        </div>
      </div>

    </div>
  `;

  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
