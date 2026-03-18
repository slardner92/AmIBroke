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

// ---- Rent insight: HUD SAFMR + Zillow ZORI lookup ----

/**
 * Looks up the bedroom-specific SAFMR (federal rent benchmark) for a ZIP code,
 * plus Zillow ZORI trend data (current market rent & YoY % change).
 */
async function fetchRentInsight(zip, brKey) {
  try {
    // Load both datasets in parallel (cached after first call)
    if (!fetchRentInsight._hudCache) {
      fetchRentInsight._hudPromise = fetchRentInsight._hudPromise || fetch('data/hud_50pct.json').then(r => r.json());
      fetchRentInsight._hudCache = await fetchRentInsight._hudPromise;
    }
    if (!fetchRentInsight._zoriCache) {
      fetchRentInsight._zoriPromise = fetchRentInsight._zoriPromise || fetch('data/zori_trends.json').then(r => r.json());
      fetchRentInsight._zoriCache = await fetchRentInsight._zoriPromise;
    }

    const hudEntry  = fetchRentInsight._hudCache[zip];
    const zoriEntry = fetchRentInsight._zoriCache[zip];

    const typicalRent = hudEntry?.[brKey] ?? null;

    return typicalRent !== null ? {
      typicalRent,
      zoriRent: zoriEntry?.rent ?? null,
      zoriYoY:  zoriEntry?.yoy  ?? null,
    } : null;
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
    const { typicalRent, zoriRent, zoriYoY } = rentInsightData;
    const brLabel   = { br0: 'studio', br1: '1-bedroom', br2: '2-bedroom', br3: '3-bedroom', br4: '4-bedroom' }[bedroomKey];
    const isOver    = housing > typicalRent;
    const diffPct   = Math.round(Math.abs((housing - typicalRent) / typicalRent) * 100);
    const direction = isOver ? 'above' : 'below';

    // Both bars scale relative to whichever value is larger
    const maxVal    = Math.max(housing, typicalRent);
    const userPct   = (housing / maxVal) * 100;
    const benchPct  = (typicalRent / maxVal) * 100;

    // ZORI trend line (optional — only for ZIPs Zillow covers)
    let zoriTrendHtml = '';
    if (zoriRent !== null) {
      const hasYoY     = zoriYoY !== null;
      const isFalling  = hasYoY && zoriYoY < 0;
      const isRising   = hasYoY && zoriYoY > 0;
      const absYoY     = hasYoY ? Math.abs(zoriYoY) : 0;
      const arrowIcon  = isFalling ? '↓' : isRising ? '↑' : '→';
      const trendClass = isFalling ? 'rent-trend--falling' : isRising ? 'rent-trend--rising' : 'rent-trend--flat';

      zoriTrendHtml = `
        <div class="rent-trend ${trendClass}">
          <span class="rent-trend__arrow">${arrowIcon}</span>
          <span class="rent-trend__text">
            Zillow market rent in ZIP ${zip}: <strong>${formatCurrency(zoriRent)}/mo</strong>${hasYoY ? ` — <strong>${isFalling ? 'down' : isRising ? 'up' : 'flat'} ${absYoY}%</strong> year-over-year` : ''}
          </span>
        </div>
      `;
    }

    // Nudge for overpayers — enhanced with ZORI trend if available
    let nudgeHtml = '';
    if (isOver) {
      let nudgeText = '';
      const isFalling = zoriYoY !== null && zoriYoY < 0;
      const absYoY    = zoriYoY !== null ? Math.abs(zoriYoY) : 0;

      if (isFalling) {
        nudgeText = `Good news: rents in your area have <strong>dropped ${absYoY}%</strong> over the past year according to Zillow. That means landlords are competing for tenants — and you have real leverage. Check <strong>Zillow</strong>, <strong>Apartments.com</strong>, and <strong>Facebook Marketplace</strong> for current ${brLabel} listings in ZIP ${zip}, and use those prices to negotiate your next renewal.`;
      } else if (zoriYoY !== null && zoriYoY >= 0 && zoriYoY <= 2) {
        nudgeText = `Rents in your area have been <strong>roughly flat</strong> over the past year — which means landlords have less justification for big increases. Shop around on <strong>Zillow</strong>, <strong>Apartments.com</strong>, and <strong>Facebook Marketplace</strong> for current ${brLabel} listings in ZIP ${zip} to see what's available for less.`;
      } else {
        nudgeText = `Units comparable to yours are available in ZIP ${zip} for less. Landlords rarely volunteer a discount, but market conditions shift constantly. Check <strong>Zillow</strong>, <strong>Apartments.com</strong>, and <strong>Facebook Marketplace</strong> for current ${brLabel} listings, and don't be afraid to negotiate your next renewal.`;
      }

      nudgeHtml = `
        <div class="rent-nudge">
          <p class="rent-nudge__icon">🔍</p>
          <div class="rent-nudge__body">
            <p class="rent-nudge__title">You may be overpaying — it's worth shopping around.</p>
            <p class="rent-nudge__text">${nudgeText}</p>
          </div>
        </div>
      `;
    }

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

        ${zoriTrendHtml}
        ${nudgeHtml}

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
