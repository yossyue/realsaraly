/* 可処分時給 計算ロジック(概算)。ブラウザ・Node 両対応。 */
(function (root) {
  'use strict';

  // 給与所得控除(令和7年分以降)
  function salaryDeduction(g) {
    if (g <= 1625000) return 650000;
    if (g <= 1800000) return g * 0.4 - 100000;
    if (g <= 3600000) return g * 0.3 + 80000;
    if (g <= 6600000) return g * 0.2 + 440000;
    if (g <= 8500000) return g * 0.1 + 1100000;
    return 1950000;
  }

  // 基礎控除(所得税。令和7・8年分の特例込み)
  function basicDeductionIncomeTax(income) {
    if (income <= 1320000) return 950000;
    if (income <= 3360000) return 880000;
    if (income <= 4890000) return 680000;
    if (income <= 6550000) return 630000;
    if (income <= 23500000) return 580000;
    return 0;
  }

  function incomeTaxBase(taxable) {
    const t = Math.floor(taxable / 1000) * 1000;
    const brackets = [
      [1950000, 0.05, 0],
      [3300000, 0.10, 97500],
      [6950000, 0.20, 427500],
      [9000000, 0.23, 636000],
      [18000000, 0.33, 1536000],
      [40000000, 0.40, 2796000],
      [Infinity, 0.45, 4796000],
    ];
    for (const [limit, rate, ded] of brackets) {
      if (t <= limit) return Math.max(0, t * rate - ded);
    }
    return 0;
  }

  /**
   * opts:
   *   annualGross  額面年収(賞与込み)
   *   bonus        うち賞与(社会保険の計算で月給分と分ける)
   *   age40        40歳以上か(介護保険料)
   *   spouse       控除対象の配偶者がいる
   *   dependents   控除対象の扶養親族(一般)の人数
   */
  function calcTakeHome(opts) {
    const gross = Math.max(0, opts.annualGross || 0);
    const bonus = Math.min(gross, Math.max(0, opts.bonus || 0));
    const monthlyBase = (gross - bonus) / 12;

    const health = (0.05 + (opts.age40 ? 0.008 : 0)) * (Math.min(monthlyBase, 1390000) * 12 + bonus);
    const pension = 0.0915 * (Math.min(monthlyBase, 650000) * 12 + bonus);
    const employment = 0.0055 * gross;
    const social = Math.floor(health + pension + employment);

    const salaryIncome = Math.max(0, gross - salaryDeduction(gross));
    const spouse = opts.spouse ? 1 : 0;
    const deps = Math.max(0, opts.dependents || 0);

    const taxableIT = Math.max(
      0,
      salaryIncome - basicDeductionIncomeTax(salaryIncome) - social - 380000 * spouse - 380000 * deps
    );
    const incomeTax = Math.floor(incomeTaxBase(taxableIT) * 1.021);

    const taxableRT = Math.max(0, salaryIncome - 430000 - social - 330000 * spouse - 330000 * deps);
    const residentTax = gross <= 1100000 ? 0 : Math.floor(taxableRT * 0.10) + 5000;

    const net = gross - social - incomeTax - residentTax;
    return { gross, social, incomeTax, residentTax, netAnnual: net, netMonthly: net / 12 };
  }

  /**
   * opts:
   *   netMonthly, grossMonthly  手取り月額 / 額面月額(賞与込み平均)
   *   workHours   1日の実働時間
   *   days        月の出勤日数
   *   extraMinutes 拘束に含める分(休憩・通勤・身支度など。含めるものだけ合計)
   *   living      月の生活費合計
   */
  function calcHourly(opts) {
    const days = Math.max(0, opts.days);
    const paidHours = opts.workHours * days;
    const boundHours = (opts.workHours + opts.extraMinutes / 60) * days;
    const per = (v, h) => (h > 0 ? v / h : NaN);
    const netAfterLiving = opts.netMonthly - opts.living;
    return {
      paidHours,
      boundHours,
      nominal: per(opts.grossMonthly, paidHours),
      netPaid: per(opts.netMonthly, paidHours),
      real: per(opts.netMonthly, boundHours),
      disposable: per(netAfterLiving, boundHours),
      netAfterLiving,
      livingHours: per(opts.living, per(opts.netMonthly, boundHours)),
    };
  }

  const api = { calcTakeHome, calcHourly, salaryDeduction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RealSalary = api;
})(typeof window !== 'undefined' ? window : globalThis);
