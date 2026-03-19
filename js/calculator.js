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

// ---- Resource links (affiliate-ready) ----

const RESOURCES = {
  apartments: {
    icon: '🏠', title: 'Search Apartments Near You',
    desc: 'Compare current rental listings in your area',
    url: 'https://www.apartments.com', cta: 'SEARCH →',
  },
  refinanceCar: {
    icon: '🚗', title: 'Check Auto Refinance Rates',
    desc: 'See if you qualify for a lower monthly payment',
    url: 'https://www.credible.com/auto-refinance', cta: 'CHECK RATES →',
  },
  debtPayoff: {
    icon: '📊', title: 'Build a Debt Payoff Plan',
    desc: 'Free calculator to map out your debt-free date',
    url: 'https://www.nerdwallet.com/personal-loans/learn/pay-off-debt', cta: 'CALCULATE →',
  },
  hysa: {
    icon: '🛡️', title: 'Compare High-Yield Savings',
    desc: 'Top accounts currently earning up to 4% APY',
    url: 'https://www.nerdwallet.com/best/banking/high-yield-online-savings-accounts', cta: 'COMPARE →',
  },
  investing: {
    icon: '📈', title: 'Start Investing with Betterment',
    desc: 'Hands-off investing — set a goal, they handle the rest',
    url: 'https://www.betterment.com', cta: 'GET STARTED →',
  },
  budget: {
    icon: '📝', title: 'Try Empower — it\'s free',
    desc: 'Track spending, budgets, and net worth in one place — no cost',
    url: 'https://www.empower.com', cta: 'GET STARTED →',
  },
};

function resourceCardHtml(key) {
  const r = RESOURCES[key];
  return `
    <a class="action-card__resource" href="${r.url}" target="_blank" rel="noopener noreferrer">
      <span class="action-card__resource-icon">${r.icon}</span>
      <div class="action-card__resource-body">
        <p class="action-card__resource-title">${r.title}</p>
        <p class="action-card__resource-desc">${r.desc}</p>
      </div>
      <span class="action-card__resource-cta">${r.cta}</span>
    </a>
  `;
}

// ---- Next Steps builder ----

function buildNextStepsHtml(data, tests) {
  const { housingRatio, housingBenchmark, housingType, monthlyIncome,
          freeCashFlow, totalMonthlyDebt, housing, car, debt,
          totalDebtRatio, carRatio } = data;

  const failures = tests.filter(t => !t.pass);

  if (failures.length === 0) {
    return buildPathB(freeCashFlow, monthlyIncome, totalMonthlyDebt, car, debt);
  }
  return buildPathA(data, tests);
}

function buildPathA(data, tests) {
  const { housingRatio, housingBenchmark, housingType, monthlyIncome,
          housing, car, debt, totalMonthlyDebt, totalDebtRatio,
          rentInsightData } = data;

  const cards = [];
  const housingFailed = housingRatio > housingBenchmark;
  const debtFailed    = totalDebtRatio > 43;
  const carPct        = (car / monthlyIncome) * 100;

  // Housing card
  if (housingFailed) {
    const targetHousing = monthlyIncome * (housingBenchmark / 100);
    const housingCut    = Math.ceil(housing - targetHousing);
    const isRenter      = housingType === 'rent';

    // Nearest falling-rent ZIP tip (renters only)
    const nearestFalling = rentInsightData?.nearestFalling ?? null;
    const nearbyTip = nearestFalling
      ? `ZIP ${nearestFalling.zip} (${nearestFalling.miles} miles away) has seen rents fall ${Math.abs(nearestFalling.yoy)}% over the past year — worth checking listings there`
      : null;

    const renterTips = [
      'Negotiate your next lease renewal — many landlords will lower rent rather than deal with vacancy',
      ...(nearbyTip ? [nearbyTip] : []),
    ];

    const tips = isRenter ? renterTips
      : [
          'Look into refinancing your mortgage if rates have dropped since you locked in',
          'Consider recasting your mortgage with a lump-sum principal payment',
          'Review your property tax assessment — many homeowners are over-assessed',
        ];

    cards.push(`
      <div class="action-card action-card--housing">
        <div class="action-card__header">
          <span class="action-card__icon">🏠</span>
          <div>
            <h3 class="action-card__title">Lower Your ${isRenter ? 'Rent' : 'Mortgage Cost'}</h3>
            <p class="action-card__subtitle">You need to save ~${formatCurrency(housingCut)}/mo to hit the ${housingBenchmark}% target</p>
          </div>
        </div>
        <ul class="action-card__tips">
          ${tips.map(t => `<li>${t}</li>`).join('')}
        </ul>
        ${isRenter ? resourceCardHtml('apartments') : ''}
      </div>
    `);
  }

  // Car card
  if (debtFailed && car > 0 && carPct > 10) {
    const excessDebt   = totalMonthlyDebt - (monthlyIncome * 0.43);
    const carCutNeeded = Math.min(Math.ceil(excessDebt), car);

    cards.push(`
      <div class="action-card action-card--car">
        <div class="action-card__header">
          <span class="action-card__icon">🚗</span>
          <div>
            <h3 class="action-card__title">Trim Your Car Payment</h3>
            <p class="action-card__subtitle">Cutting ${formatCurrency(carCutNeeded)}/mo would bring you under 43%</p>
          </div>
        </div>
        <ul class="action-card__tips">
          <li>Refinance at a lower rate — even 1-2% can save $50-80/mo on a $30K balance</li>
          <li>Extend your loan term to reduce the monthly hit (but pay extra when you can)</li>
          <li>Consider trading into a less expensive, reliable vehicle</li>
        </ul>
        ${resourceCardHtml('refinanceCar')}
      </div>
    `);
  }

  // Other debt card
  if (debtFailed && debt > 0) {
    cards.push(`
      <div class="action-card action-card--debt">
        <div class="action-card__header">
          <span class="action-card__icon">💳</span>
          <div>
            <h3 class="action-card__title">Attack Your Other Debt</h3>
            <p class="action-card__subtitle">Your other monthly payments (${formatCurrency(debt)}) are adding up</p>
          </div>
        </div>
        <ul class="action-card__tips">
          <li>List your debts smallest to largest and knock them out one by one (the "snowball" method)</li>
          <li>Look into 0% intro APR balance transfer cards to stop interest from piling on</li>
          <li>Consider consolidating multiple payments into one lower-rate loan</li>
        </ul>
        ${resourceCardHtml('debtPayoff')}
      </div>
    `);
  }

  // Budgeting card (always show for Path A)
  cards.push(`
    <div class="action-card action-card--budget">
      <div class="action-card__header">
        <span class="action-card__icon">📝</span>
        <div>
          <h3 class="action-card__title">Track Where Your Money Goes</h3>
          <p class="action-card__subtitle">You can't fix what you can't see</p>
        </div>
      </div>
      <ul class="action-card__tips">
        <li>A budgeting app can reveal spending leaks you didn't know you had</li>
        <li>Start with the 50/30/20 rule: 50% needs, 30% wants, 20% savings & debt payoff</li>
      </ul>
      ${resourceCardHtml('budget')}
    </div>
  `);

  return `
    <div class="next-steps">
      <span class="step-label">WHAT NOW</span>
      <h2 class="next-steps__title">Your Next Moves</h2>
      <p class="next-steps__subtitle">Personalized actions based on your results — start with #1.</p>
      <div class="next-steps__cards">
        ${cards.join('')}
      </div>
    </div>
  `;
}

function buildPathB(freeCashFlow, monthlyIncome, totalMonthlyDebt, car, debt) {
  const emergencyMin = totalMonthlyDebt * 3;
  const emergencyMax = totalMonthlyDebt * 6;
  const investSuggest = Math.min(Math.round(freeCashFlow * 0.2), 500);

  const cards = [];

  // Emergency fund
  cards.push(`
    <div class="action-card action-card--wealth">
      <div class="action-card__header">
        <span class="action-card__icon">🛡️</span>
        <div>
          <h3 class="action-card__title">Build Your Safety Net</h3>
          <p class="action-card__subtitle">Aim for ${formatCurrency(emergencyMin)} – ${formatCurrency(emergencyMax)} (3-6 months of expenses)</p>
        </div>
      </div>
      <ul class="action-card__tips">
        <li>Open a high-yield savings account — top accounts are currently paying up to 4% APY, far better than a regular checking account</li>
        <li>Automate a monthly transfer — even ${formatCurrency(Math.min(200, freeCashFlow))}/mo adds up fast</li>
      </ul>
      ${resourceCardHtml('hysa')}
    </div>
  `);

  // Investing
  cards.push(`
    <div class="action-card action-card--wealth">
      <div class="action-card__header">
        <span class="action-card__icon">📈</span>
        <div>
          <h3 class="action-card__title">Put Your Money to Work</h3>
          <p class="action-card__subtitle">Even ${formatCurrency(investSuggest)}/mo invested consistently can grow to six figures</p>
        </div>
      </div>
      <ul class="action-card__tips">
        <li>If your employer offers a 401(k) match, contribute enough to get the full match — it's free money</li>
        <li>Low-cost index funds (like a total market fund) are the simplest starting point</li>
        <li>Time in the market beats timing the market — starting now matters more than starting perfectly</li>
      </ul>
      ${resourceCardHtml('investing')}
    </div>
  `);

  // Accelerate debt payoff (conditional)
  if (car > 0 || debt > 0) {
    cards.push(`
      <div class="action-card action-card--wealth">
        <div class="action-card__header">
          <span class="action-card__icon">🎯</span>
          <div>
            <h3 class="action-card__title">Accelerate Debt Payoff</h3>
            <p class="action-card__subtitle">Extra payments now = less interest over time</p>
          </div>
        </div>
        <ul class="action-card__tips">
          <li>Put extra cash toward your highest-interest debt first (the "avalanche" method)</li>
          <li>Even an extra $100/mo on a car loan can shave months off and save hundreds in interest</li>
        </ul>
        ${resourceCardHtml('debtPayoff')}
      </div>
    `);
  }

  return `
    <div class="next-steps">
      <span class="step-label">WHAT NOW</span>
      <h2 class="next-steps__title">Your Next Moves</h2>
      <p class="next-steps__subtitle">You have ${formatCurrency(freeCashFlow)}/mo in free cash flow — here's how to make it work harder.</p>
      <div class="next-steps__cards">
        ${cards.join('')}
      </div>
    </div>
  `;
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
    // Load all three datasets in parallel (cached after first call)
    fetchRentInsight._hudPromise  = fetchRentInsight._hudPromise  || fetch('data/hud_50pct.json').then(r => r.json());
    fetchRentInsight._zoriPromise = fetchRentInsight._zoriPromise || fetch('data/zori_trends.json').then(r => r.json());
    fetchRentInsight._coordPromise= fetchRentInsight._coordPromise|| fetch('data/zip_coords.json').then(r => r.json());

    if (!fetchRentInsight._hudCache)   fetchRentInsight._hudCache   = await fetchRentInsight._hudPromise;
    if (!fetchRentInsight._zoriCache)  fetchRentInsight._zoriCache  = await fetchRentInsight._zoriPromise;
    if (!fetchRentInsight._coordCache) fetchRentInsight._coordCache = await fetchRentInsight._coordPromise;

    const hudEntry  = fetchRentInsight._hudCache[zip];
    const zoriEntry = fetchRentInsight._zoriCache[zip];
    const typicalRent = hudEntry?.[brKey] ?? null;

    if (typicalRent === null) return null;

    // Find nearest ZIP with falling rents within 30 miles
    const nearestFalling = findNearestFallingZip(zip,
      fetchRentInsight._coordCache,
      fetchRentInsight._zoriCache);

    return {
      typicalRent,
      zoriRent:      zoriEntry?.rent    ?? null,
      zoriYoY:       zoriEntry?.yoy     ?? null,
      nearestFalling,
    };
  } catch (_) {
    return null;
  }
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function findNearestFallingZip(userZip, coords, zori) {
  const userCoord = coords[userZip];
  if (!userCoord) return null;
  const [uLat, uLng] = userCoord;

  let best = null;
  let bestDist = Infinity;

  for (const [zip, entry] of Object.entries(zori)) {
    if (zip === userZip) continue;
    if (!entry.yoy || entry.yoy >= 0) continue; // only falling
    const c = coords[zip];
    if (!c) continue;
    const dist = haversineMiles(uLat, uLng, c[0], c[1]);
    if (dist <= 30 && dist < bestDist) {
      bestDist = dist;
      best = { zip, yoy: entry.yoy, miles: Math.round(dist * 10) / 10 };
    }
  }
  return best;
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
          housing, car, salary, zip, bedroomKey, rentInsightData } = data;

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

  // Car payment insight (fails 43% rule + car is a significant contributor)
  let carInsightHtml = '';
  const carPct = (car / monthlyIncome) * 100;
  const guidelineCar = monthlyIncome * 0.10;
  if (totalDebtRatio > 43 && car > 0 && carPct > 10) {
    const carMaxVal  = Math.max(car, guidelineCar);
    const carUserPct = (car / carMaxVal) * 100;
    const carBenchPct = (guidelineCar / carMaxVal) * 100;
    const carOverPct = Math.round(((car - guidelineCar) / guidelineCar) * 100);

    // How much would they need to cut to pass 43%?
    const excessDebt   = totalMonthlyDebt - (monthlyIncome * 0.43);
    const carCutNeeded = Math.min(Math.ceil(excessDebt), car); // can't cut more than the full payment

    carInsightHtml = `
      <div class="car-insight">
        <p class="car-insight__label">🚗 Car Payment Check</p>

        <div class="car-chart">
          <div class="car-chart__row">
            <span class="car-chart__row-label">Your Payment</span>
            <div class="car-chart__track">
              <div class="car-chart__fill car-chart__fill--over" style="width:${carUserPct}%"></div>
            </div>
            <span class="car-chart__row-amount car-chart__row-amount--over">${formatCurrency(car)}</span>
          </div>

          <div class="car-chart__row">
            <span class="car-chart__row-label">10% Guideline</span>
            <div class="car-chart__track">
              <div class="car-chart__fill car-chart__fill--bench" style="width:${carBenchPct}%"></div>
            </div>
            <span class="car-chart__row-amount">${formatCurrency(guidelineCar)}</span>
          </div>

          <div class="car-chart__footer">
            <span class="car-chart__context">Based on ${formatCurrency(salary)} gross salary</span>
            <span class="car-chart__badge car-chart__badge--over">${carOverPct}% above</span>
          </div>
        </div>

        <div class="car-nudge">
          <p class="car-nudge__icon">🎯</p>
          <div class="car-nudge__body">
            <p class="car-nudge__title">Reducing your payment by ${formatCurrency(carCutNeeded)}/mo would get you under 43%.</p>
            <p class="car-nudge__text">Consider refinancing for a lower rate, extending your term (if you can), or trading into a less expensive vehicle. Even a 1-2% rate reduction on a $30K balance can save $50-80/mo.</p>
          </div>
        </div>
      </div>
    `;
  }

  const cashFlowClass  = freeCashFlow >= 0 ? 'stat--positive' : 'stat--negative';
  const cashFlowPrefix = freeCashFlow >= 0 ? '+' : '';

  // Build personalized next-steps section
  const nextStepsHtml = buildNextStepsHtml(data, tests);

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

      ${carInsightHtml}

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

      ${nextStepsHtml}

    </div>
  `;

  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
