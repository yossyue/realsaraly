(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const KEY = 'realsalary.v2';
  const DEFAULT_LIVING = [
    ['家賃', 70000], ['光熱費', 12000], ['通信費', 8000], ['食費', 40000],
    ['交通費(通勤以外)', 5000], ['日用品', 8000], ['保険・その他固定費', 10000],
  ];
  const SIMPLE = ['annual', 'bonusAnnual', 'monthly', 'bonusMonths', 'age40', 'spouse', 'deps',
    'workHours', 'days', 'breakMin', 'commuteMin', 'prepMin', 'otherMin'];
  const CHECKS = ['incBreak', 'incCommute', 'incPrep', 'incOther'];

  const MAN = 10000;
  const yen = (n) => (isFinite(n) ? Math.round(n).toLocaleString('ja-JP') + '円' : '-');
  const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
  const mode = () => document.querySelector('input[name=mode]:checked').value;

  let living = DEFAULT_LIVING.map(([name, amount]) => ({ name, amount }));

  function save() {
    try {
      const s = { mode: mode(), living };
      SIMPLE.forEach((id) => (s[id] = $(id).value));
      CHECKS.forEach((id) => (s[id] = $(id).checked));
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) { /* 保存できなくても動く */ }
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s) return;
      SIMPLE.forEach((id) => { if (s[id] !== undefined) $(id).value = s[id]; });
      CHECKS.forEach((id) => { if (s[id] !== undefined) $(id).checked = !!s[id]; });
      if (s.mode) document.querySelector('input[name=mode][value=' + s.mode + ']').checked = true;
      if (Array.isArray(s.living)) living = s.living.map((r) => ({ name: String(r.name), amount: Number(r.amount) || 0 }));
    } catch (e) { /* 壊れた保存は無視 */ }
  }

  function renderLiving() {
    const box = $('living');
    box.textContent = '';
    living.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      const name = document.createElement('input');
      name.type = 'text'; name.value = r.name; name.setAttribute('aria-label', '項目名');
      name.addEventListener('input', () => { r.name = name.value; update(); });
      const unit = document.createElement('span');
      unit.className = 'unit';
      const amt = document.createElement('input');
      amt.type = 'number'; amt.min = '0'; amt.step = '1000'; amt.value = r.amount;
      amt.setAttribute('aria-label', r.name + 'の金額');
      amt.addEventListener('input', () => { r.amount = Math.max(0, parseFloat(amt.value) || 0); update(); });
      unit.append(amt, '円');
      const del = document.createElement('button');
      del.type = 'button'; del.textContent = '×'; del.setAttribute('aria-label', r.name + 'を削除');
      del.addEventListener('click', () => { living.splice(i, 1); renderLiving(); update(); });
      row.append(name, unit, del);
      box.appendChild(row);
    });
  }

  function update() {
    const isAnnual = mode() === 'annual';
    $('annualBox').hidden = !isAnnual;
    $('monthlyBox').hidden = isAnnual;

    let annualGross, bonus;
    if (isAnnual) {
      annualGross = num('annual') * MAN; bonus = num('bonusAnnual') * MAN;
    } else {
      const m = num('monthly') * MAN;
      bonus = m * num('bonusMonths');
      annualGross = m * 12 + bonus;
    }

    const t = RealSalary.calcTakeHome({
      annualGross, bonus,
      age40: $('age40').value === '1',
      spouse: $('spouse').value === '1',
      dependents: Math.floor(num('deps')),
    });

    const extra =
      ($('incBreak').checked ? num('breakMin') : 0) +
      ($('incCommute').checked ? num('commuteMin') : 0) +
      ($('incPrep').checked ? num('prepMin') : 0) +
      ($('incOther').checked ? num('otherMin') : 0);
    const livingTotal = living.reduce((a, r) => a + r.amount, 0);

    const h = RealSalary.calcHourly({
      netMonthly: t.netMonthly, grossMonthly: t.gross / 12,
      workHours: num('workHours'), days: num('days'), extraMinutes: extra, living: livingTotal,
    });

    $('livingTotal').textContent = yen(livingTotal);
    $('rGross').textContent = yen(t.gross) + '/年';
    $('rNetMonthly').textContent = yen(t.netMonthly);
    $('rNetAnnual').textContent = '(年 ' + yen(t.netAnnual) + '、額面の ' + (t.gross ? (t.netAnnual / t.gross * 100).toFixed(1) : '0') + '%)';
    $('rBreakdown').textContent = '社会保険 ' + yen(t.social) + ' / 所得税 ' + yen(t.incomeTax) + ' / 住民税 ' + yen(t.residentTax);
    $('rHours').textContent = isFinite(h.boundHours)
      ? '月 ' + h.boundHours.toFixed(1) + '時間(うち実働 ' + h.paidHours.toFixed(1) + '時間)' : '-';
    $('rNominal').textContent = yen(h.nominal) + '/時';
    $('rNetPaid').textContent = yen(h.netPaid) + '/時';
    $('rReal').textContent = yen(h.real) + '/時';
    $('rAfter').textContent = yen(h.netAfterLiving) + '/月';
    $('rLivingHours').textContent = isFinite(h.livingHours) && h.boundHours > 0
      ? '月 ' + h.livingHours.toFixed(1) + '時間(1日あたり ' + (h.livingHours / Math.max(1, num('days'))).toFixed(1) + '時間)' : '-';

    const hero = $('rDisposable');
    hero.textContent = yen(h.disposable) + '/時';
    hero.classList.toggle('neg', h.disposable < 0);
    $('rDisposableNote').textContent = h.disposable < 0
      ? '生活費が手取りを上回っています' : '拘束時間 1時間ごとに自由に使えるお金';

    // 手取りの使い道バー
    const bar = $('bar');
    bar.textContent = '';
    const net = t.netMonthly;
    if (net > 0) {
      const spent = Math.min(livingTotal, net);
      [['var(--bar3)', spent], ['var(--bar1)', Math.max(0, net - livingTotal)]].forEach(([c, v]) => {
        const s = document.createElement('span');
        s.style.background = c; s.style.width = (v / net * 100) + '%';
        bar.appendChild(s);
      });
    }
    $('barLegend').textContent = net > 0
      ? '手取り月額のうち 灰色=生活費 ' + Math.min(100, livingTotal / net * 100).toFixed(0) + '% / 緑=可処分 ' + Math.max(0, 100 - livingTotal / net * 100).toFixed(0) + '%'
      : '';
    save();
  }

  load();
  renderLiving();
  document.querySelectorAll('input[name=mode],' + SIMPLE.map((i) => '#' + i).concat(CHECKS.map((i) => '#' + i)).join(','))
    .forEach((el) => el.addEventListener('input', update));
  $('addRow').addEventListener('click', () => {
    living.push({ name: '新しい項目', amount: 0 });
    renderLiving(); update();
    const inputs = $('living').querySelectorAll('input[type=text]');
    inputs[inputs.length - 1].select();
  });
  update();
})();
