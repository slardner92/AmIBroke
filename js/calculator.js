// ============================================
//  AM I BROKE? — Calculator Logic
// ============================================

const form    = document.getElementById('broke-form');
const results = document.getElementById('results');

// ---- Housing type toggle ----

let housingType = 'rent'; // 'rent' | 'mortgage'

const toggleBtns   = document.querySelectorAll('.housing-toggle__btn');
const housingLabel = document.getElementById('housing-label');

toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    housingType = btn.dataset.type;
    // Update active state
    toggleBtns.forEach(b => b.classList.toggle('housing-toggle__btn--active', b === btn));
    // Update input label
    housingLabel.textContent = housingType === 'rent' ? 'Monthly Rent ($)' : 'Monthly Mortgage ($)';
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function formatPercent(n) {
  return n.toFixed(1) + '%';
}

// ---- Form submit ----

form.addEventListener('submit', function (e) {
  e.preventDefault();

  // 1. Read inputs
  const salary  = parseNumber('salary');
  const housing = parseNumber('housing');
  const car     = parseNumber('carPayment');
  const zip     = document.getElementById('zipCode').value.trim();
  const debt    = parseNumber('debt'); // direct monthly payment

  // 2. Basic validation
  if (salary <= 0) {
    alert('Please enter your annual salary.');
    document.getElementById('salary').focus();
    return;
  }

  // 3. Core calculations
  const monthlyIncome = salary / 12;

  // Housing ratio — 30% for renters, 36% for mortgage holders
  const housingBenchmark = housingType === 'rent' ? 30 : 36;
  const housingRatio     = (housing / monthlyIncome) * 100;

  // Car ratio — 8% benchmark
  const carRatio = (car / monthlyIncome) * 100;

  // Total debt ratio — housing + car + other monthly debt, 43% benchmark
  const totalMonthlyDebt = housing + car + debt;
  const totalDebtRatio   = (totalMonthlyDebt / monthlyIncome) * 100;

  // Free cash flow
  const freeCashFlow = monthlyIncome - totalMonthlyDebt;

  // 4. Bundle data for renderResults
  const data = {
    salary,
    monthlyIncome,
    housing,
    housingType,
    housingBenchmark,
    car,
    debt,
    totalMonthlyDebt,
    freeCashFlow,
    housingRatio,
    carRatio,
    totalDebtRatio,
    zip,
  };

  // 5. Show loading state briefly, then render
  showLoading();
  setTimeout(() => renderResults(data), 1200);
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

// ---- Verdict logic ----

/**
 * Three ratio tests:
 *  1. Housing  ≤ 30% (rent) or ≤ 36% (mortgage)
 *  2. Car      ≤  8%
 *  3. Total debt (housing + car + other) ≤ 43%
 *
 * Pass all 3      → YOU'RE KILLING IT
 * Fail exactly 1  → YOU'RE OKAY
 * Fail 2 or 3     → YOU'RE BROKE
 */
function getVerdict(housingRatio, carRatio, totalDebtRatio, housingBenchmark, housingType) {
  const housingLabel = housingType === 'rent' ? 'rent' : 'mortgage';
  const tests = [
    {
      label:  `The ${housingBenchmark}% Housing Rule`,
      rule:   `≤ ${housingBenchmark}% of income on ${housingLabel}`,
      pass:   housingRatio  <= housingBenchmark,
      actual: housingRatio,
    },
    {
      label:  'The 8% Car Rule',
      rule:   '≤ 8% of income on car payments',
      pass:   carRatio      <= 8,
      actual: carRatio,
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

  return { verdict, tagline, verdictClass, tests, failures };
}

// ---- Results renderer ----

function renderResults(data) {
  const { housingRatio, carRatio, totalDebtRatio, housingBenchmark, housingType,
          monthlyIncome, freeCashFlow, totalMonthlyDebt } = data;

  const { verdict, tagline, verdictClass, tests } = getVerdict(
    housingRatio, carRatio, totalDebtRatio, housingBenchmark, housingType
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
