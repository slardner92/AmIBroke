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
    rentInsightData = await fetchRentInsight(zip, bedroomKey, housing);
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

// ---- Rent insight: HUD lookup + Census percentile ----

/**
 * Census ACS 5-year Table B25063 (Gross Rent, all bedrooms combined).
 * 24 rent brackets from <$100 to $3,500+.
 * Returns cumulative count of renters below user's rent ÷ total = percentile.
 */
const CENSUS_BRACKETS = [
  { varName: 'B25063_003E', lower: 0,    upper: 99   },
  { varName: 'B25063_004E', lower: 100,  upper: 149  },
  { varName: 'B25063_005E', lower: 150,  upper: 199  },
  { varName: 'B25063_006E', lower: 200,  upper: 249  },
  { varName: 'B25063_007E', lower: 250,  upper: 299  },
  { varName: 'B25063_008E', lower: 300,  upper: 349  },
  { varName: 'B25063_009E', lower: 350,  upper: 399  },
  { varName: 'B25063_010E', lower: 400,  upper: 449  },
  { varName: 'B25063_011E', lower: 450,  upper: 499  },
  { varName: 'B25063_012E', lower: 500,  upper: 549  },
  { varName: 'B25063_013E', lower: 550,  upper: 599  },
  { varName: 'B25063_014E', lower: 600,  upper: 649  },
  { varName: 'B25063_015E', lower: 650,  upper: 699  },
  { varName: 'B25063_016E', lower: 700,  upper: 749  },
  { varName: 'B25063_017E', lower: 750,  upper: 799  },
  { varName: 'B25063_018E', lower: 800,  upper: 899  },
  { varName: 'B25063_019E', lower: 900,  upper: 999  },
  { varName: 'B25063_020E', lower: 1000, upper: 1249 },
  { varName: 'B25063_021E', lower: 1250, upper: 1499 },
  { varName: 'B25063_022E', lower: 1500, upper: 1999 },
  { varName: 'B25063_023E', lower: 2000, upper: 2499 },
  { varName: 'B25063_024E', lower: 2500, upper: 2999 },
  { varName: 'B25063_025E', lower: 3000, upper: 3499 },
  { varName: 'B25063_026E', lower: 3500, upper: Infinity },
];

const CENSUS_VARS = ['B25063_002E', ...CENSUS_BRACKETS.map(b => b.varName)].join(',');

function calcPercentile(apiResponse, rent) {
  const headers = apiResponse[0];
  const values  = apiResponse[1];

  const getVal = varName => Math.max(0, parseInt(values[headers.indexOf(varName)]) || 0);

  const total = getVal('B25063_002E');
  if (total === 0) return null;

  let countBelow = 0;

  for (const bracket of CENSUS_BRACKETS) {
    const count = getVal(bracket.varName);
    if (rent > bracket.upper) {
      // Entirely below user's rent
      countBelow += count;
    } else if (rent >= bracket.lower) {
      // User's rent falls inside this bracket — linear interpolation
      if (bracket.upper === Infinity) {
        countBelow += count * 0.1; // assume near bottom of open-ended bracket
      } else {
        const width    = bracket.upper - bracket.lower + 1;
        const position = rent - bracket.lower;
        countBelow += count * (position / width);
      }
      break;
    }
  }

  return Math.min(99, Math.max(1, Math.round((countBelow / total) * 100)));
}

async function fetchRentInsight(zip, brKey, userRent) {
  let typicalRent = null;
  let percentile  = null;

  // 1. HUD SAFMR lookup (static JSON, bedroom-specific)
  try {
    if (!fetchRentInsight._cache) {
      const res = await fetch('data/hud_50pct.json');
      fetchRentInsight._cache = await res.json();
    }
    const entry = fetchRentInsight._cache[zip];
    typicalRent = entry?.[brKey] ?? null;
  } catch (_) { /* silently skip */ }

  // 2. Census ACS B25063 (live API, all bedrooms combined)
  try {
    const url = `https://api.census.gov/data/2023/acs/acs5?get=${CENSUS_VARS}&for=zip%20code%20tabulation%20area:${zip}`;
    const res  = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.length >= 2) percentile = calcPercentile(json, userRent);
    }
  } catch (_) { /* silently skip */ }

  return (typicalRent !== null || percentile !== null)
    ? { typicalRent, percentile }
    : null;
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

  // Rent insight block (renter + failed housing + data available)
  let rentInsightHtml = '';
  if (rentInsightData) {
    const { typicalRent, percentile } = rentInsightData;
    const brLabel = { br0: 'studio', br1: '1-bedroom', br2: '2-bedroom', br3: '3-bedroom', br4: '4-bedroom' }[bedroomKey];

    const typicalLine = typicalRent
      ? `The typical rent for a <strong>${brLabel}</strong> in ZIP ${zip} is <strong>${formatCurrency(typicalRent)}</strong>.`
      : '';

    const yourRentLine = percentile !== null
      ? `You are paying <strong>${formatCurrency(housing)}</strong> — putting you in approximately the <strong>${percentile}th percentile</strong> of renters in your area.`
      : typicalRent
        ? `You are paying <strong>${formatCurrency(housing)}</strong>, which is <strong>${Math.round(((housing - typicalRent) / typicalRent) * 100)}% ${housing >= typicalRent ? 'above' : 'below'}</strong> the local benchmark.`
        : '';

    if (typicalLine || yourRentLine) {
      rentInsightHtml = `
        <div class="rent-insight">
          <p class="rent-insight__label">📍 Local Rent Context</p>
          <p class="rent-insight__body">${typicalLine} ${yourRentLine}</p>
        </div>
      `;
    }
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
