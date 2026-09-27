/* حساب‌وکتاب — اپ شخصی و آفلاین مدیریت مالی */
(function () {
  'use strict';
  const C = window.Core;
  const { faNum, faDigits, today, ym, MONTHS } = C;
  const KEY = 'hesab-v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- ذخیره‌سازی ----------
  function defaults() {
    return {
      v: 1,
      settings: { unit: 'toman', expectedIncome: 0, lastBackup: null },
      categories: {
        expense: ['سوپرمارکت', 'رستوران و کافه', 'حمل‌ونقل', 'قبض و شارژ', 'خرید', 'سلامت', 'تفریح', 'هدیه', 'خانه', 'سایر'],
        income: ['حقوق', 'پروژه', 'سایر درآمد']
      },
      accounts: [], tx: [], loans: [], fixed: [], debts: []
    };
  }
  let S;
  function load() {
    try { const raw = localStorage.getItem(KEY); S = raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults(); }
    catch (e) { S = defaults(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('ذخیره نشد: حافظه‌ی مرورگر پر است یا در دسترس نیست. از داده‌ها بکاپ بگیر.', 'bad'); }
  }

  // ---------- پول ----------
  const unitLabel = () => S.settings.unit === 'toman' ? 'تومان' : 'ریال';
  const disp = rial => S.settings.unit === 'toman' ? rial / 10 : rial;
  const money = (rial, withUnit = true) => faNum(disp(rial)) + (withUnit ? ' ' + unitLabel() : '');
  const toRial = v => S.settings.unit === 'toman' ? v * 10 : v;

  // ---------- تاریخ ----------
  const monthTitle = ymStr => { const [y, m] = ymStr.split('/').map(Number); return `${MONTHS[m - 1]} ${faDigits(y)}`; };
  const dateTitle = js => { const { y, m, d } = C.jParse(js); return `${faDigits(d)} ${MONTHS[m - 1]}${y !== C.jParse(today()).y ? ' ' + faDigits(y) : ''}`; };
  const dateFull = js => { const { y, m, d } = C.jParse(js); return `${faDigits(d)} ${MONTHS[m - 1]} ${faDigits(y)}`; };
  function relDay(js) {
    const n = C.diffDays(today(), js);
    if (n === 0) return 'امروز';
    if (n === 1) return 'فردا';
    if (n === -1) return 'دیروز';
    return n > 0 ? `${faDigits(n)} روز دیگر` : `${faDigits(-n)} روز گذشته`;
  }

  // ---------- فیلدهای فرم ----------
  function dateField(name, value, chips) {
    const { y, m, d } = C.jParse(value || today());
    const cy = C.jParse(today()).y;
    let ys = ''; for (let i = cy - 4; i <= cy + 12; i++) ys += `<option value="${i}" ${i === y ? 'selected' : ''}>${faDigits(i)}</option>`;
    const ms = MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${n}</option>`).join('');
    let ds = ''; for (let i = 1; i <= 31; i++) ds += `<option value="${i}" ${i === d ? 'selected' : ''}>${faDigits(i)}</option>`;
    return `<div class="datef" data-date="${name}">
      <select data-p="d" aria-label="روز">${ds}</select><select data-p="m" aria-label="ماه">${ms}</select><select data-p="y" aria-label="سال">${ys}</select>
      ${chips ? `<div class="chips mini"><button type="button" class="chip" data-setdate="0">امروز</button><button type="button" class="chip" data-setdate="-1">دیروز</button></div>` : ''}
    </div>`;
  }
  function readDate(root, name) {
    const w = $(`[data-date="${name}"]`, root);
    const y = +$('[data-p=y]', w).value, m = +$('[data-p=m]', w).value;
    const d = Math.min(+$('[data-p=d]', w).value, C.monthLen(y, m));
    return C.jStr(y, m, d);
  }
  function setDate(root, name, js) {
    const w = $(`[data-date="${name}"]`, root); const { y, m, d } = C.jParse(js);
    $('[data-p=y]', w).value = y; $('[data-p=m]', w).value = m; $('[data-p=d]', w).value = d;
  }
  function ymField(name, value, allowEmpty) {
    const cy = C.jParse(today()).y;
    const [y, m] = value ? value.split('/').map(Number) : [0, 0];
    let ys = allowEmpty ? `<option value="">—</option>` : '';
    for (let i = cy - 4; i <= cy + 12; i++) ys += `<option value="${i}" ${i === y ? 'selected' : ''}>${faDigits(i)}</option>`;
    const ms = (allowEmpty ? `<option value="">—</option>` : '') + MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === m ? 'selected' : ''}>${n}</option>`).join('');
    return `<div class="datef" data-ym="${name}"><select data-p="m" aria-label="ماه">${ms}</select><select data-p="y" aria-label="سال">${ys}</select></div>`;
  }
  function readYm(root, name) {
    const w = $(`[data-ym="${name}"]`, root);
    const y = $('[data-p=y]', w).value, m = $('[data-p=m]', w).value;
    return y && m ? `${y}/${C.pad(m)}` : null;
  }
  const amountInput = (name, rial, ph) =>
    `<div class="amtwrap"><input class="amt" name="${name}" inputmode="numeric" autocomplete="off" placeholder="${ph || '۰'}" value="${rial ? faNum(disp(rial)) : ''}" data-orig="${rial || ''}" data-init="${rial ? faNum(disp(rial)) : ''}"><span>${unitLabel()}</span></div>`;
  function readAmount(root, name) {
    const inp = $(`[name="${name}"]`, root);
    // اگه مبلغ دست نخورده، مقدار دقیق ریالی (مثلاً از پیامک) حفظ بشه
    if (inp.dataset.orig && inp.value === inp.dataset.init) return Number(inp.dataset.orig);
    const v = Number(C.normDigits(inp.value).replace(/[^\d]/g, ''));
    return toRial(v || 0);
  }

  // ---------- تعهدات ----------
  function findOb(kind, id) { return kind === 'loan' ? S.loans.find(l => l.id === id) : S.fixed.find(f => f.id === id); }
  function markPaid(kind, id, key, info) {
    const o = findOb(kind, id); if (!o) return;
    o.paid = o.paid || {}; o.paid[key] = info;
  }
  function unmarkPaid(kind, id, key) {
    const o = findOb(kind, id); if (!o || !o.paid) return;
    const info = o.paid[key]; delete o.paid[key];
    if (info && info.txId) {
      const t = S.tx.find(x => x.id === info.txId);
      if (t) { if (t.auto) S.tx = S.tx.filter(x => x !== t); else delete t.link; }
    }
  }
  function openObligations(fromOffset = -3, toOffset = 1) {
    const cur = ym(today()); let all = [];
    for (let i = fromOffset; i <= toOffset; i++) all = all.concat(C.obligationsForMonth(S, C.addYm(cur, i)));
    return all.filter(o => !o.paid);
  }

  // ---------- بدهی و طلب ----------
  const debtLeft = d => d.amount - (d.settles || []).reduce((s, x) => s + x.amount, 0);
  const openDebts = () => S.debts.filter(d => debtLeft(d) > 0);
  function debtTotals() {
    let owe = 0, owed = 0;
    openDebts().forEach(d => { if (d.dir === 'owe') owe += debtLeft(d); else owed += debtLeft(d); });
    return { owe, owed };
  }
  const debtTitle = d => (d.dir === 'owe' ? 'بدهکار به ' : 'طلبکار از ') + d.person;

  // ---------- حساب‌ها ----------
  function accountFor(bank, num) {
    let a = S.accounts.find(x => x.bank === bank && (x.num || '') === (num || ''));
    if (!a) { a = { id: uid(), bank, num: num || '', name: bank + (num ? ' ' + num : ''), balance: null, stamp: '' }; S.accounts.push(a); }
    return a;
  }
  const accName = id => (S.accounts.find(a => a.id === id) || {}).name || '';

  // ---------- UI عمومی ----------
  let toastTimer;
  function toast(msg, kind) {
    const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (kind || '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 3200);
  }
  function openSheet(title, html, mount) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="x" data-close aria-label="بستن">✕</button></div>
      <div class="sheet-body">${html}</div></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) closeSheet(ov); });
    $$('.sheet input.amt', ov).forEach(bindAmount);
    $$('[data-setdate]', ov).forEach(b => b.addEventListener('click', () => {
      setDate(ov, b.closest('[data-date]').dataset.date, C.addDays(today(), +b.dataset.setdate));
    }));
    if (mount) mount(ov);
    return ov;
  }
  function closeSheet(ov) {
    ov = ov || $$('.overlay').pop(); if (!ov) return;
    ov.classList.remove('open'); setTimeout(() => ov.remove(), 220);
  }
  function bindAmount(inp) {
    inp.addEventListener('input', () => {
      const n = C.normDigits(inp.value).replace(/[^\d]/g, '');
      inp.value = n ? faNum(Number(n)) : '';
    });
  }

  // ---------- صفحه‌ها ----------
  let tab = 'home', txMonth = ym(today()), txFilter = 'all', repMonth = ym(today()), obTab = 'loan';

  function render() {
    $$('.tabbar button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
    const v = $('#view');
    v.innerHTML = ({ home: homeView, tx: txView, ob: obView, rep: repView, set: setView })[tab]();
    $$('input.amt', v).forEach(bindAmount);
    window.scrollTo(0, 0);
  }

  function obRow(o) {
    const late = o.due < today();
    return `<li class="ob ${late ? 'late' : ''}">
      <div class="ob-main"><strong>${esc(o.name)}</strong><span>${o.sub} · ${dateTitle(o.due)}</span></div>
      <div class="ob-side"><b>${money(o.amount, false)}</b><em>${relDay(o.due)}</em></div>
      <button class="btn small" data-act="pay" data-k="${o.kind}" data-id="${o.id}" data-key="${o.key}">پرداخت شد</button>
    </li>`;
  }

  function homeView() {
    const t = today(), cur = ym(t), st = C.monthStats(S, cur);
    const { y, m, d } = C.jParse(t); const daysLeft = C.monthLen(y, m) - d + 1;
    const due = openObligations(-3, 1).filter(o => o.due <= C.addDays(t, 7));
    const backupDays = S.settings.lastBackup ? Math.floor((Date.now() - S.settings.lastBackup) / 864e5) : null;
    const hasData = S.tx.length + S.loans.length + S.fixed.length > 0;
    const needBackup = hasData && (backupDays === null || backupDays >= 7);
    const neg = st.free < 0;
    return `
    <header class="top"><h1>${monthTitle(cur)}</h1><span>${C.weekday(t)} ${dateTitle(t)}</span></header>
    <section class="hero ${neg ? 'deficit' : ''}">
      <p class="hero-label">${neg ? 'کسری این ماه' : 'پول آزاد این ماه'}</p>
      <p class="hero-num">${faNum(Math.abs(disp(st.free)))}<small>${unitLabel()}</small></p>
      ${!neg && st.free > 0 ? `<p class="hero-daily">یعنی روزی حدود ${money(st.free / daysLeft)} تا آخر ${MONTHS[m - 1]}</p>` : ''}
      <dl class="eq">
        <div><dt>درآمد${st.usedExpected ? ' <i>(پیش‌بینی)</i>' : ''}</dt><dd>${money(st.base, false)}</dd></div>
        <div><dt>اقساط و پرداخت‌های ثابت${st.obPaid ? ` <i>(${faNum(disp(st.obPaid))} پرداخت‌شده)</i>` : ''}</dt><dd><bdi dir="ltr">${st.obTotal ? '−' : ''}${money(st.obTotal, false)}</bdi></dd></div>
        <div><dt>خرج‌های روزمره</dt><dd><bdi dir="ltr">${st.variable ? '−' : ''}${money(st.variable, false)}</bdi></dd></div>
      </dl>
      ${!st.base ? `<p class="hero-hint">درآمد این ماه هنوز ثبت نشده. <button class="linkbtn" data-act="goset">درآمد ماهانه رو در تنظیمات وارد کن</button> یا یه واریز ثبت کن.</p>` : ''}
    </section>
    <nav class="quick" aria-label="کارهای سریع">
      <button data-act="add" data-type="expense"><span class="qi">−</span>ثبت برداشت</button>
      <button data-act="paste"><span class="qi">⎘</span>چسباندن پیامک</button>
      <button data-act="duelist"><span class="qi">✓</span>پرداخت قسط</button>
      <button data-act="add" data-type="income"><span class="qi">+</span>ثبت واریز</button>
    </nav>
    ${needBackup ? `<div class="banner"><span>${backupDays === null ? 'هنوز از داده‌ها بکاپ نگرفتی.' : `${faDigits(backupDays)} روزه که بکاپ نگرفتی.`} اگه گوشی عوض بشه یا Safari داده‌ها رو پاک کنه، بکاپ تنها راه برگشته.</span><button class="btn small" data-act="backup">بکاپ بگیر</button></div>` : ''}
    <section class="block">
      <h2>سررسیدهای نزدیک</h2>
      ${due.length ? `<ul class="oblist">${due.map(obRow).join('')}</ul>` :
        `<p class="empty">${S.loans.length + S.fixed.length ? 'تا یک هفته‌ی دیگه سررسیدی نداری.' : 'وام‌ها و پرداخت‌های ثابتت رو اضافه کن تا سررسیدها اینجا بیان.'} <button class="linkbtn" data-act="goob">اقساط و تعهدات</button></p>`}
    </section>
    ${homeDebts()}
    ${S.accounts.length ? `<section class="block"><h2>موجودی حساب‌ها</h2><ul class="accs">${S.accounts.map(a => `
      <li><span>${esc(a.name)}</span><b>${a.balance === null ? '—' : money(a.balance)}</b>${a.stamp ? `<em>طبق آخرین پیامک، ${dateTitle(a.stamp.slice(0, 10))}</em>` : ''}</li>`).join('')}</ul></section>` : ''}
    `;
  }

  function homeDebts() {
    if (!openDebts().length) return '';
    const { owe, owed } = debtTotals(), t = today();
    const soon = openDebts().filter(d => d.due && d.due <= C.addDays(t, 7)).sort((a, b) => a.due.localeCompare(b.due));
    return `<section class="block"><h2>بدهی و طلب</h2>
      <div class="sums"><button class="sumbtn" data-act="godebt"><span>بدهی من</span><b class="neg">${money(owe)}</b></button><button class="sumbtn" data-act="godebt"><span>طلب من</span><b class="pos">${money(owed)}</b></button></div>
      ${soon.length ? `<ul class="oblist">${soon.map(debtRow).join('')}</ul>` : ''}</section>`;
  }
  function debtRow(d) {
    const late = d.due && d.due < today();
    return `<li class="ob ${late ? 'late' : ''}">
      <div class="ob-main"><strong>${esc(debtTitle(d))}</strong><span>${d.due ? 'موعد ' + dateTitle(d.due) : 'بدون موعد'}${d.note ? ' · ' + esc(d.note) : ''}</span></div>
      <div class="ob-side"><b class="${d.dir === 'owe' ? 'neg' : 'pos'}">${money(debtLeft(d), false)}</b>${d.due ? `<em>${relDay(d.due)}</em>` : ''}</div>
      <button class="btn small" data-act="debt" data-id="${d.id}">${d.dir === 'owe' ? 'پرداخت کردم' : 'دریافت کردم'}</button>
    </li>`;
  }

  function monthSwitch(cur, act) {
    return `<div class="mswitch"><button data-act="${act}" data-d="-1" aria-label="ماه قبل">›</button><strong>${monthTitle(cur)}</strong><button data-act="${act}" data-d="1" aria-label="ماه بعد">‹</button></div>`;
  }

  function txView() {
    const list = S.tx.filter(t => ym(t.date) === txMonth && (txFilter === 'all' || t.type === txFilter))
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const st = C.monthStats(S, txMonth);
    const out = S.tx.filter(t => ym(t.date) === txMonth && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const groups = {}; list.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
    return `
    <header class="top"><h1>تراکنش‌ها</h1></header>
    ${monthSwitch(txMonth, 'txm')}
    <div class="sums"><div><span>درآمد</span><b class="pos">${money(st.income)}</b></div><div><span>خرج کل</span><b class="neg">${money(out)}</b></div></div>
    <div class="chips seg">${[['all', 'همه'], ['expense', 'خرج'], ['income', 'درآمد'], ['transfer', 'انتقال']].map(([k, n]) =>
      `<button class="chip ${txFilter === k ? 'on' : ''}" data-act="txf" data-f="${k}">${n}</button>`).join('')}</div>
    ${list.length ? Object.keys(groups).map(dt => `
      <section class="day"><h3>${C.weekday(dt)} ${dateTitle(dt)}</h3><ul class="txlist">${groups[dt].map(txRow).join('')}</ul></section>`).join('')
      : `<p class="empty">توی ${monthTitle(txMonth)} تراکنشی ثبت نشده.</p>`}
    <button class="fab" data-act="add" data-type="expense" aria-label="ثبت تراکنش">+</button>`;
  }
  function txRow(t) {
    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '⇄';
    const sub = [t.link ? 'قسط/تعهد' : '', accName(t.account), t.time ? faDigits(t.time) : ''].filter(Boolean).join(' · ');
    return `<li><button class="txrow" data-act="edit" data-id="${t.id}">
      <span class="tx-main"><strong>${esc(t.cat || (t.debt ? 'بدهی و طلب' : t.type === 'transfer' ? 'انتقال داخلی' : 'بدون دسته'))}</strong>${t.note ? `<span>${esc(t.note)}</span>` : ''}${sub ? `<span class="meta">${sub}</span>` : ''}</span>
      <b class="${t.type === 'income' ? 'pos' : t.type === 'expense' ? 'neg' : ''}"><bdi dir="ltr">${sign}${money(t.amount, false)}</bdi></b></button></li>`;
  }

  function obView() {
    const loanCard = l => {
      const s = C.loanSummary(l); const pct = Math.round(s.paidCount / l.count * 100);
      return `<li><button class="card loan" data-act="loan" data-id="${l.id}">
        <div class="lc-top"><strong>${esc(l.name)}</strong><span>${esc(l.lender || '')}</span></div>
        <div class="bar" role="img" aria-label="${faDigits(pct)} درصد پرداخت شده"><i style="width:${pct}%"></i></div>
        <div class="lc-grid">
          <div><span>قسط ماهانه</span><b>${money(l.amount, false)}</b></div>
          <div><span>پرداخت‌شده</span><b>${faDigits(s.paidCount)} از ${faDigits(l.count)}</b></div>
          <div><span>مانده‌ی بدهی</span><b>${money(s.remainingAmount, false)}</b></div>
          <div><span>${s.next ? 'قسط بعدی' : 'وضعیت'}</span><b>${s.next ? dateTitle(s.next.due) : 'تسویه شد'}</b></div>
        </div>
        ${s.remainingCount ? `<p class="lc-end">آخرین قسط: ${dateFull(s.last)}</p>` : ''}
      </button></li>`;
    };
    const activeL = S.loans.filter(l => C.loanSummary(l).remainingCount > 0), doneL = S.loans.filter(l => C.loanSummary(l).remainingCount <= 0);
    const loans = activeL.map(loanCard).join('') ;
    const loansDone = doneL.length ? `<details class="closed"><summary>تسویه‌شده‌ها (${faDigits(doneL.length)})</summary><ul class="cards">${doneL.map(loanCard).join('')}</ul></details>` : '';
    const cur = ym(today());
    const fixedCard = f => {
      const active = (!f.start || cur >= f.start) && (!f.end || cur <= f.end);
      const paid = f.paid && f.paid[cur];
      return `<li><button class="card fixed" data-act="fixed" data-id="${f.id}">
        <div class="lc-top"><strong>${esc(f.name)}</strong><span>روز ${faDigits(f.day)} هر ماه</span></div>
        <div class="fx-row"><b>${money(f.amount)}</b><em class="${paid ? 'ok' : ''}">${!active ? 'غیرفعال' : paid ? 'این ماه پرداخت شد' : 'این ماه پرداخت نشده'}</em></div>
      </button></li>`;
    };
    const fxActive = S.fixed.filter(f => !f.end || f.end >= cur), fxEnded = S.fixed.filter(f => f.end && f.end < cur);
    const fixed = fxActive.map(fixedCard).join('') + (fxEnded.length ? `</ul><details class="closed"><summary>پایان‌یافته‌ها (${faDigits(fxEnded.length)})</summary><ul class="cards">${fxEnded.map(fixedCard).join('')}</ul></details><ul class="cards">` : '');
    const totalDebt = S.loans.reduce((s, l) => s + C.loanSummary(l).remainingAmount, 0);
    const monthly = C.obligationsForMonth(S, cur).reduce((s, o) => s + o.amount, 0);
    return `
    <header class="top"><h1>اقساط و تعهدات</h1></header>
    ${obTab !== 'debt' ? `<div class="sums"><div><span>تعهد این ماه</span><b>${money(monthly)}</b></div><div><span>کل مانده‌ی وام‌ها</span><b>${money(totalDebt)}</b></div></div>` : ''}
    <div class="chips seg"><button class="chip ${obTab === 'loan' ? 'on' : ''}" data-act="obt" data-t="loan">وام‌ها</button><button class="chip ${obTab === 'fixed' ? 'on' : ''}" data-act="obt" data-t="fixed">پرداخت‌های ثابت</button><button class="chip ${obTab === 'debt' ? 'on' : ''}" data-act="obt" data-t="debt">بدهی و طلب</button></div>
    ${obTab === 'loan'
      ? (loans ? `<ul class="cards">${loans}</ul>` : `<p class="empty">${doneL.length ? 'وام فعالی نداری.' : 'وامی ثبت نشده. مبلغ قسط، تعداد اقساط و تاریخ اولین قسط رو از قرارداد بانک بردار.'}</p>`) + loansDone
      : obTab === 'fixed' ? (fixed ? `<ul class="cards">${fixed}</ul>` : `<p class="empty">اجاره، شارژ ساختمان، اشتراک‌ها و هر پرداختی که هر ماه تکرار می‌شه رو اینجا اضافه کن.</p>`)
      : debtList()}
    ${obTab === 'debt'
      ? `<div class="btnrow"><button class="btn wide" data-act="newdebt" data-dir="owe">بدهکارم به…</button><button class="btn wide ghost" data-act="newdebt" data-dir="owed">طلبکارم از…</button></div>`
      : `<button class="btn wide" data-act="${obTab === 'loan' ? 'newloan' : 'newfixed'}">${obTab === 'loan' ? 'افزودن وام' : 'افزودن پرداخت ثابت'}</button>`}`;
  }
  function debtList() {
    const { owe, owed } = debtTotals();
    const open = openDebts().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const done = S.debts.filter(d => debtLeft(d) <= 0).sort((a, b) => (b.closed || '').localeCompare(a.closed || ''));
    const card = d => {
      const left = debtLeft(d), paid = d.amount - left;
      return `<li><button class="card debt ${d.dir}" data-act="debtd" data-id="${d.id}">
        <div class="lc-top"><strong>${esc(debtTitle(d))}</strong><span>${left > 0 ? (d.due ? 'موعد ' + dateTitle(d.due) : 'بدون موعد') : 'تسویه شد'}</span></div>
        <div class="fx-row"><b class="${left > 0 ? (d.dir === 'owe' ? 'neg' : 'pos') : ''}">${money(left > 0 ? left : d.amount)}</b>${paid > 0 && left > 0 ? `<em>${money(paid, false)} از ${money(d.amount, false)} تسویه شده</em>` : ''}</div>
        ${d.note ? `<p class="lc-end">${esc(d.note)}</p>` : ''}
      </button></li>`;
    };
    return `<div class="sums"><div><span>بدهی من</span><b class="neg">${money(owe)}</b></div><div><span>طلب من</span><b class="pos">${money(owed)}</b></div></div>
      ${open.length ? `<ul class="cards">${open.map(card).join('')}</ul>` : `<p class="empty">بدهی یا طلب بازی نداری.</p>`}
      ${done.length ? `<details class="closed"><summary>تسویه‌شده‌ها (${faDigits(done.length)})</summary><ul class="cards">${done.map(card).join('')}</ul></details>` : ''}`;
  }

  function repView() {
    const txs = S.tx.filter(t => ym(t.date) === repMonth && t.type === 'expense' && !t.link);
    const byCat = {}; txs.forEach(t => byCat[t.cat || 'سایر'] = (byCat[t.cat || 'سایر'] || 0) + t.amount);
    const st = C.monthStats(S, repMonth);
    if (st.obPaid) byCat['اقساط و تعهدات'] = st.obPaid;
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = rows.length ? rows[0][1] : 1;
    const months = []; for (let i = -5; i <= 0; i++) months.push(C.addYm(repMonth, i));
    const hist = months.map(mm => { const s = C.monthStats(S, mm); return { mm, inc: s.income, out: s.variable + s.obPaid }; });
    const hmax = Math.max(1, ...hist.map(h => Math.max(h.inc, h.out)));
    const cur = ym(today());
    return `
    <header class="top"><h1>گزارش</h1></header>
    ${monthSwitch(repMonth, 'repm')}
    <section class="block"><h2>خرج بر اساس دسته</h2>
      ${rows.length ? `<ul class="catbars">${rows.map(([c, v]) => `<li><div><span>${esc(c)}</span><b>${money(v, false)}</b></div><i style="width:${Math.max(2, v / max * 100)}%"></i></li>`).join('')}</ul>` : `<p class="empty">خرجی برای این ماه ثبت نشده.</p>`}
    </section>
    <section class="block"><h2>شش ماه اخیر</h2>
      <div class="hist">${hist.map(h => `<div class="hcol"><div class="hbars"><i class="inc" style="height:${h.inc / hmax * 100}%"></i><i class="out" style="height:${h.out / hmax * 100}%"></i></div><span>${MONTHS[+h.mm.split('/')[1] - 1]}</span></div>`).join('')}</div>
      <p class="legend"><span class="k inc"></span>درآمد <span class="k out"></span>خرج (با اقساط پرداخت‌شده)</p>
    </section>
    <section class="block"><h2>خروجی اکسل</h2>
      <p class="note">تراکنش‌ها، خلاصه‌ی ماهانه، خرج هر دسته و وضعیت وام‌ها، هر کدوم در یک شیت.</p>
      <div class="formrow"><label>از</label>${ymField('xfrom', C.addYm(cur, -2))}</div>
      <div class="formrow"><label>تا</label>${ymField('xto', cur)}</div>
      <button class="btn wide" data-act="excel">ساخت فایل اکسل</button>
    </section>
    <section class="block"><h2>یادآورها در تقویم آیفون</h2>
      <p class="note">یه فایل تقویم از همه‌ی اقساط و پرداخت‌های ثابت پرداخت‌نشده‌ی ۱۲ ماه آینده ساخته می‌شه، با هشدار سه روز قبل و صبح روز سررسید. بعد از اضافه کردن وام یا تعهد جدید دوباره بسازش.</p>
      <button class="btn wide ghost" data-act="ics">ساخت فایل یادآور</button>
    </section>`;
  }

  function setView() {
    const chipsFor = type => S.categories[type].map((c, i) => `<span class="chip tag">${esc(c)}<button data-act="delcat" data-type="${type}" data-i="${i}" aria-label="حذف ${esc(c)}">✕</button></span>`).join('');
    return `
    <header class="top"><h1>تنظیمات</h1></header>
    <section class="block"><h2>واحد نمایش</h2>
      <div class="chips seg"><button class="chip ${S.settings.unit === 'toman' ? 'on' : ''}" data-act="unit" data-u="toman">تومان</button><button class="chip ${S.settings.unit === 'rial' ? 'on' : ''}" data-act="unit" data-u="rial">ریال</button></div>
      <p class="note">داده‌ها همیشه به ریال ذخیره می‌شن؛ این فقط نمایش و ورود مبلغ رو عوض می‌کنه.</p>
    </section>
    <section class="block"><h2>درآمد ماهانه‌ی مورد انتظار</h2>
      ${amountInput('expected', S.settings.expectedIncome)}
      <p class="note">تا وقتی درآمد واقعی این ماه ثبت نشده، «پول آزاد» با این عدد حساب می‌شه. اگه درآمدت ثابت نیست، خالی بذار.</p>
      <button class="btn small" data-act="saveexp">ذخیره</button>
    </section>
    <section class="block"><h2>دسته‌های خرج</h2><div class="chips wrap">${chipsFor('expense')}</div>
      <div class="addcat"><input id="newcat-expense" placeholder="دسته‌ی جدید"><button class="btn small" data-act="addcat" data-type="expense">افزودن</button></div></section>
    <section class="block"><h2>دسته‌های درآمد</h2><div class="chips wrap">${chipsFor('income')}</div>
      <div class="addcat"><input id="newcat-income" placeholder="دسته‌ی جدید"><button class="btn small" data-act="addcat" data-type="income">افزودن</button></div></section>
    ${S.accounts.length ? `<section class="block"><h2>حساب‌ها</h2><ul class="accs edit">${S.accounts.map(a => `<li><input data-accname="${a.id}" value="${esc(a.name)}" aria-label="نام حساب"><button class="btn small ghost" data-act="delacc" data-id="${a.id}">حذف</button></li>`).join('')}</ul>
      <button class="btn small" data-act="saveacc">ذخیره‌ی نام‌ها</button></section>` : ''}
    <section class="block"><h2>بکاپ</h2>
      <p class="note">${S.settings.lastBackup ? `آخرین بکاپ: ${faDigits(Math.floor((Date.now() - S.settings.lastBackup) / 864e5))} روز پیش.` : 'هنوز بکاپی گرفته نشده.'} فایل بکاپ رو در Files یا iCloud Drive نگه دار.</p>
      <div class="btnrow"><button class="btn" data-act="backup">گرفتن بکاپ</button><label class="btn ghost">بازگردانی از فایل<input type="file" accept=".json,application/json" id="restore" hidden></label></div>
    </section>
    <section class="block help"><h2>راهنما</h2>${HELP}</section>
    <section class="block"><button class="btn danger wide" data-act="wipe">پاک کردن همه‌ی داده‌ها</button></section>
    <p class="ver">حساب‌وکتاب · نسخه‌ی ۴ · همه‌ی داده‌ها فقط روی همین گوشی</p>`;
  }

  const HELP = `
  <details><summary>ثبت پیامک بانک با یک لمس</summary>
    <p>در اپ Shortcuts به تب Automation برو، New Automation و بعد Message رو بزن. در Sender شماره‌ی پیامک بانک رو انتخاب کن و Run Immediately رو روشن کن. اکشن Copy to Clipboard رو اضافه کن و ورودیش رو Message (متن پیامک) بذار، بعد اکشن Show Notification با متن «پیامک بانک کپی شد». از این به بعد با رسیدن پیامک، کافیه اپ رو باز کنی و «چسباندن پیامک» رو بزنی. برای هر بانک یک اتوماسیون جدا بساز.</p></details>
  <details><summary>ویجت دکمه‌های سریع</summary>
    <p>در Shortcuts میان‌بُرهایی بساز که هر کدوم فقط اکشن Open URLs دارن، با آدرس اپ و یکی از این انتهاها: <code>#out</code> برای ثبت برداشت، <code>#in</code> برای ثبت واریز، <code>#paste</code> برای چسباندن پیامک (برداشت و واریز رو خودش تشخیص می‌ده) و <code>#pay</code> برای پرداخت قسط. اگه جا کمه، <code>#new</code> با یک دکمه می‌پرسه برداشت یا واریز. بعد ویجت Shortcuts رو روی صفحه‌ی اصلی بذار و این پوشه رو براش انتخاب کن. اگه لینک‌ها به جای اپ داخل Safari باز شدن، از خود آیکون اپ استفاده کن؛ صفحه‌ی اولش همین چهار دکمه رو داره.</p></details>
  <details><summary>یادآور اقساط</summary>
    <p>در تب گزارش، «ساخت فایل یادآور» رو بزن و گزینه‌ی افزودن به تقویم رو انتخاب کن. بهتره در اپ Calendar یه تقویم جدا به اسم «مالی» بسازی و رویدادها رو اونجا اضافه کنی؛ این‌طوری هر بار که فایل جدید می‌سازی، می‌تونی تقویم قبلی رو پاک کنی تا رویدادها تکراری نشن. ویجت Calendar آیفون هم سررسیدها رو روی صفحه‌ی اصلی نشون می‌ده.</p></details>`;

  // ---------- فرم تراکنش ----------
  function catChips(type, selected) {
    const list = S.categories[type] || [];
    return list.map(c => `<button type="button" class="chip ${c === selected ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  }
  function linkOptions(current) {
    const obs = openObligations(-3, 1);
    let opts = `<option value="">— نه، خرج روزمره است —</option>`;
    if (current) opts += `<option value="${current.kind}|${current.id}|${current.key}" selected>${esc(obLabel(current))} (فعلی)</option>`;
    opts += obs.map(o => `<option value="${o.kind}|${o.id}|${o.key}">${esc(o.name)} · ${o.sub} · ${money(o.amount)}</option>`).join('');
    return opts;
  }
  function obLabel(link) {
    const o = findOb(link.kind, link.id); if (!o) return 'تعهد حذف‌شده';
    return link.kind === 'loan' ? `${o.name} · قسط ${faDigits(+link.key + 1)}` : `${o.name} · ${monthTitle(link.key)}`;
  }

  function openTxForm(opts = {}) {
    const t = opts.id ? S.tx.find(x => x.id === opts.id) : null;
    const p = opts.prefill || {};
    const data = t ? { ...t } : { type: opts.type || p.type || 'expense', amount: p.amount || 0, date: p.date || today(), time: p.time || '', note: p.note || '', account: p.accountId || '', cat: '' };
    if (!t && !data.cat) data.cat = S.lastCat && S.lastCat[data.type] || '';
    let type = data.type, cat = data.cat;
    const dupe = p.sms && S.tx.find(x => x.amount === p.amount && x.date === p.date && x.time === p.time && x.account === p.accountId);
    const html = `
      ${p.sms ? `<p class="smsinfo">از پیامک ${esc(p.bank)}${p.balance != null ? ` · مانده ${money(p.balance)}` : ''}</p>` : ''}
      ${dupe ? `<p class="warn">یه تراکنش با همین مبلغ و زمان قبلاً ثبت شده. احتمالاً این پیامک تکراریه.</p>` : ''}
      <div class="chips seg" id="ttype">${[['expense', 'برداشت (خرج)'], ['income', 'واریز (درآمد)'], ['transfer', 'انتقال داخلی']].map(([k, n]) => `<button type="button" class="chip ${type === k ? 'on' : ''}" data-t="${k}">${n}</button>`).join('')}</div>
      <p class="note tnote" ${type === 'transfer' ? '' : 'hidden'}>جابه‌جایی پول بین حساب‌های خودت؛ در درآمد و خرج حساب نمی‌شه. برای واریزی که درآمد نیست (مثلاً از حساب دیگه‌ی خودت) همین رو بزن.</p>
      <label class="lbl">مبلغ</label>${amountInput('amount', data.amount)}
      <label class="lbl">تاریخ</label>${dateField('date', data.date, true)}
      <div id="catwrap" ${type === 'transfer' ? 'hidden' : ''}><label class="lbl">دسته</label><div class="chips wrap" id="cats">${catChips(type === 'transfer' ? 'expense' : type, cat)}</div></div>
      <div id="linkwrap" ${type === 'expense' ? '' : 'hidden'}><label class="lbl">مربوط به قسط یا پرداخت ثابت؟</label><select id="link">${linkOptions(t && t.link)}</select></div>
      <label class="lbl">حساب</label><select id="acc"><option value="">بدون حساب</option>${S.accounts.map(a => `<option value="${a.id}" ${a.id === data.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <label class="lbl">توضیح</label><input id="note" value="${esc(data.note)}" placeholder="${type === 'income' ? 'مثلاً حقوق مهر' : 'مثلاً خرید هفتگی'}">
      <div class="btnrow"><button class="btn wide" id="savetx">${t ? 'ذخیره‌ی تغییرات' : 'ثبت'}</button>${t ? `<button class="btn danger" id="deltx">حذف</button>` : ''}</div>`;
    openSheet(t ? 'ویرایش تراکنش' : type === 'income' ? 'ثبت واریز' : 'ثبت برداشت', html, ov => {
      $('#ttype', ov).addEventListener('click', e => {
        const b = e.target.closest('[data-t]'); if (!b) return;
        type = b.dataset.t; cat = S.lastCat && S.lastCat[type] || '';
        $$('#ttype .chip', ov).forEach(c => c.classList.toggle('on', c === b));
        $('#cats', ov).innerHTML = catChips(type === 'transfer' ? 'expense' : type, cat);
        $('#catwrap', ov).hidden = type === 'transfer'; $('#linkwrap', ov).hidden = type !== 'expense';
        $('.tnote', ov).hidden = type !== 'transfer';
        $('#note', ov).placeholder = type === 'income' ? 'مثلاً حقوق مهر' : type === 'transfer' ? 'مثلاً از خاورمیانه به بلو' : 'مثلاً خرید هفتگی';
        $('.sheet-head h2', ov).textContent = t ? 'ویرایش تراکنش' : type === 'income' ? 'ثبت واریز' : type === 'transfer' ? 'ثبت انتقال' : 'ثبت برداشت';
      });
      $('#cats', ov).addEventListener('click', e => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat; $$('#cats .chip', ov).forEach(c => c.classList.toggle('on', c === b));
      });
      if (!t && !p.amount) setTimeout(() => $('[name=amount]', ov).focus(), 250);
      $('#savetx', ov).addEventListener('click', () => {
        const amount = readAmount(ov, 'amount');
        if (!amount) { toast('مبلغ رو وارد کن.', 'bad'); return; }
        const rec = t || { id: uid(), created: Date.now() };
        const oldLink = t && t.link ? { ...t.link } : null;
        Object.assign(rec, { type, amount, date: readDate(ov, 'date'), time: data.time || '', cat: type === 'transfer' ? '' : cat,
          account: $('#acc', ov).value, note: $('#note', ov).value.trim() });
        const lv = type === 'expense' ? $('#link', ov).value : '';
        const newLink = lv ? (([kind, id, key]) => ({ kind, id, key }))(lv.split('|')) : null;
        const same = oldLink && newLink && oldLink.kind === newLink.kind && oldLink.id === newLink.id && oldLink.key === newLink.key;
        if (oldLink && !same) { const o = findOb(oldLink.kind, oldLink.id); if (o && o.paid) delete o.paid[oldLink.key]; delete rec.link; }
        if (newLink && !same) { rec.link = newLink; markPaid(newLink.kind, newLink.id, newLink.key, { date: rec.date, txId: rec.id }); }
        if (!t) S.tx.push(rec);
        if (cat && type !== 'transfer') { S.lastCat = S.lastCat || {}; S.lastCat[type] = cat; }
        if (p.sms && p.balance != null && rec.account) {
          const a = S.accounts.find(x => x.id === rec.account); const stamp = rec.date + ' ' + (rec.time || '00:00');
          if (a && (!a.stamp || stamp >= a.stamp)) { a.balance = p.balance; a.stamp = stamp; }
        }
        save(); closeSheet(ov); render();
        toast(t ? 'تغییرات ذخیره شد.' : 'ثبت شد.');
      });
      if (t) $('#deltx', ov).addEventListener('click', () => {
        if (!confirm('این تراکنش حذف بشه؟')) return;
        if (t.link) { const o = findOb(t.link.kind, t.link.id); if (o && o.paid) delete o.paid[t.link.key]; }
        if (t.debt) { const d = S.debts.find(x => x.id === t.debt); if (d) { d.settles = (d.settles || []).filter(x => x.txId !== t.id); delete d.closed; } }
        S.tx = S.tx.filter(x => x !== t); save(); closeSheet(ov); render(); toast('حذف شد.');
      });
    });
  }

  // یک دکمه برای هر دو: انتخاب برداشت یا واریز
  function openChooser() {
    openSheet('ثبت تراکنش', `<nav class="quick big">
      <button data-pick="expense"><span class="qi">−</span>برداشت</button>
      <button data-pick="income"><span class="qi">+</span>واریز</button>
      <button data-pick="paste" style="grid-column:1/-1"><span class="qi">⎘</span>چسباندن پیامک (خودش تشخیص می‌ده)</button></nav>`, ov => {
      $('.quick', ov).addEventListener('click', e => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        closeSheet(ov);
        b.dataset.pick === 'paste' ? openPaste() : openTxForm({ type: b.dataset.pick });
      });
    });
  }

  // ---------- چسباندن پیامک ----------
  function openPaste() {
    const html = `
      <p class="note">متن پیامک بانک رو کپی کن و «چسباندن» رو بزن. اگه اتوماسیون Shortcuts رو ساخته باشی، متن از قبل کپی شده.</p>
      <button class="btn wide" id="clip">چسباندن از کلیپ‌بورد</button>
      <textarea id="smstext" rows="7" placeholder="یا متن پیامک رو اینجا بچسبون"></textarea>
      <button class="btn wide ghost" id="parse">بررسی متن</button>`;
    openSheet('چسباندن پیامک', html, ov => {
      const go = () => {
        const r = C.parseSMS($('#smstext', ov).value);
        if (!r) { toast('متنی وارد نشده.', 'bad'); return; }
        if (r.error) { toast(r.error + ' مبلغ رو دستی وارد کن.', 'bad'); }
        const acc = accountFor(r.bank, r.account); save();
        closeSheet(ov);
        openTxForm({ prefill: { ...r, accountId: acc.id, sms: true } });
      };
      $('#clip', ov).addEventListener('click', async () => {
        try { const txt = await navigator.clipboard.readText(); $('#smstext', ov).value = txt; if (txt.trim()) go(); else toast('کلیپ‌بورد خالیه.', 'bad'); }
        catch (e) { toast('دسترسی به کلیپ‌بورد داده نشد. متن رو دستی بچسبون.', 'bad'); $('#smstext', ov).focus(); }
      });
      $('#parse', ov).addEventListener('click', go);
    });
  }

  // ---------- پرداخت قسط ----------
  function openDueList() {
    const list = openObligations(-3, 1);
    openSheet('پرداخت قسط یا تعهد', list.length ? `<ul class="oblist">${list.map(obRow).join('')}</ul>` : `<p class="empty">قسط یا پرداخت ثابت پرداخت‌نشده‌ای نداری.</p>`);
  }
  function openPay(kind, id, key) {
    const o = C.obligationsForMonth(S, kind === 'loan' ? ym(C.loanDue(findOb(kind, id), +key)) : key).find(x => x.kind === kind && x.id === id && x.key === key);
    if (!o) return;
    const recent = S.tx.filter(t => t.type === 'expense' && !t.link && C.diffDays(t.date, today()) <= 45)
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
    const html = `
      <p class="payhead"><strong>${esc(o.name)}</strong><span>${o.sub} · سررسید ${dateTitle(o.due)}</span></p>
      <label class="check"><input type="checkbox" id="already"> قبلاً از روی پیامک ثبتش کردم</label>
      <div id="newpay">
        <label class="lbl">مبلغ پرداختی</label>${amountInput('amount', o.amount)}
        <label class="lbl">تاریخ پرداخت</label>${dateField('date', today(), true)}
        <label class="lbl">از حساب</label><select id="acc"><option value="">بدون حساب</option>${S.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
      </div>
      <div id="pickpay" hidden>
        <label class="lbl">کدوم تراکنش؟</label>
        <select id="pick"><option value="">فقط علامت بزن، به تراکنشی وصل نکن</option>${recent.map(t => `<option value="${t.id}">${dateTitle(t.date)} · ${money(t.amount)}${t.note ? ' · ' + esc(t.note) : ''}</option>`).join('')}</select>
      </div>
      <button class="btn wide" id="dopay">ثبت پرداخت</button>`;
    openSheet('ثبت پرداخت', html, ov => {
      $('#already', ov).addEventListener('change', e => { $('#newpay', ov).hidden = e.target.checked; $('#pickpay', ov).hidden = !e.target.checked; });
      $('#dopay', ov).addEventListener('click', () => {
        if ($('#already', ov).checked) {
          const tid = $('#pick', ov).value;
          const t = S.tx.find(x => x.id === tid);
          if (t) { t.link = { kind, id, key }; markPaid(kind, id, key, { date: t.date, txId: t.id }); }
          else markPaid(kind, id, key, { date: today() });
        } else {
          const amount = readAmount(ov, 'amount'); if (!amount) { toast('مبلغ رو وارد کن.', 'bad'); return; }
          const t = { id: uid(), created: Date.now(), type: 'expense', amount, date: readDate(ov, 'date'), time: '', cat: (findOb(kind, id) || {}).cat || (kind === 'loan' ? 'قسط وام' : 'پرداخت ثابت'),
            account: $('#acc', ov).value, note: `${o.name} · ${o.sub}`, link: { kind, id, key }, auto: true };
          S.tx.push(t); markPaid(kind, id, key, { date: t.date, txId: t.id });
        }
        save(); $$('.overlay').forEach(x => closeSheet(x)); render(); toast('پرداخت ثبت شد.');
      });
    });
  }

  // ---------- وام ----------
  function openLoanForm(id) {
    const l = id ? S.loans.find(x => x.id === id) : null;
    const html = `
      <label class="lbl">نام وام</label><input id="lname" value="${esc(l ? l.name : '')}" placeholder="مثلاً وام خرید خودرو">
      <label class="lbl">بانک یا وام‌دهنده</label><input id="llender" value="${esc(l ? l.lender : '')}" placeholder="اختیاری">
      <label class="lbl">مبلغ هر قسط</label>${amountInput('lamount', l ? l.amount : 0)}
      <label class="lbl">تعداد کل اقساط</label><input id="lcount" inputmode="numeric" value="${l ? faDigits(l.count) : ''}" placeholder="مثلاً ۳۶">
      <label class="lbl">تاریخ سررسید اولین قسط</label>${dateField('lfirst', l ? l.first : today())}
      <p class="note">اقساط بعدی هر ماه همین روز سررسید دارن. اگه ماهی این روز رو نداشت، آخرین روز همون ماه حساب می‌شه.</p>
      ${!l ? `<label class="lbl">چند قسط تا حالا پرداخت شده؟</label><input id="lpaid" inputmode="numeric" placeholder="۰">` : ''}
      <div class="btnrow"><button class="btn wide" id="lsave">${l ? 'ذخیره‌ی تغییرات' : 'افزودن وام'}</button>${l ? `<button class="btn danger" id="ldel">حذف</button>` : ''}</div>`;
    openSheet(l ? 'ویرایش وام' : 'وام جدید', html, ov => {
      $('#lsave', ov).addEventListener('click', () => {
        const name = $('#lname', ov).value.trim(), amount = readAmount(ov, 'lamount');
        const count = Number(C.normDigits($('#lcount', ov).value).replace(/\D/g, ''));
        if (!name || !amount || !count) { toast('نام، مبلغ قسط و تعداد اقساط لازمه.', 'bad'); return; }
        const rec = l || { id: uid(), paid: {} };
        Object.assign(rec, { name, lender: $('#llender', ov).value.trim(), amount, count, first: readDate(ov, 'lfirst') });
        if (!l) {
          const pc = Math.min(count, Number(C.normDigits($('#lpaid', ov).value).replace(/\D/g, '')) || 0);
          for (let i = 0; i < pc; i++) rec.paid[i] = { date: C.loanDue(rec, i), prior: true };
          S.loans.push(rec);
        } else Object.keys(rec.paid).forEach(k => { if (+k >= count) delete rec.paid[k]; });
        save(); $$('.overlay').forEach(x => closeSheet(x)); obTab = 'loan'; render(); toast(l ? 'ذخیره شد.' : 'وام اضافه شد.');
      });
      if (l) $('#ldel', ov).addEventListener('click', () => {
        if (!confirm(`«${l.name}» و سابقه‌ی اقساطش حذف بشه؟ تراکنش‌هایی که ثبت کردی می‌مونن.`)) return;
        S.tx.forEach(t => { if (t.link && t.link.id === l.id) delete t.link; });
        S.loans = S.loans.filter(x => x !== l); save(); $$('.overlay').forEach(x => closeSheet(x)); render(); toast('حذف شد.');
      });
    });
  }
  function openLoanDetail(id) {
    const l = S.loans.find(x => x.id === id); if (!l) return;
    const s = C.loanSummary(l); const t = today();
    let rows = '';
    for (let i = 0; i < l.count; i++) {
      const due = C.loanDue(l, i), paid = l.paid && l.paid[i];
      rows += `<li class="${paid ? 'paid' : due < t ? 'late' : ''}"><button data-inst="${i}">
        <span class="n">${faDigits(i + 1)}</span><span>${dateFull(due)}</span>
        <em>${paid ? 'پرداخت شد' : due < t ? 'عقب‌افتاده' : ''}</em></button></li>`;
    }
    const html = `
      <div class="sums"><div><span>مانده‌ی بدهی</span><b>${money(s.remainingAmount)}</b></div><div><span>اقساط باقی‌مانده</span><b>${faDigits(s.remainingCount)}</b></div></div>
      <p class="note">روی هر قسط بزن تا پرداختش رو ثبت کنی یا برگردونیش.</p>
      <ul class="inst">${rows}</ul>
      <button class="btn wide ghost" id="ledit">ویرایش وام</button>`;
    openSheet(l.name, html, ov => {
      $('.inst', ov).addEventListener('click', e => {
        const b = e.target.closest('[data-inst]'); if (!b) return;
        const i = b.dataset.inst;
        if (l.paid && l.paid[i]) {
          if (!confirm('این قسط به «پرداخت‌نشده» برگرده؟')) return;
          unmarkPaid('loan', l.id, i); save(); closeSheet(ov); render(); openLoanDetail(l.id);
        } else openPay('loan', l.id, i);
      });
      $('#ledit', ov).addEventListener('click', () => openLoanForm(l.id));
    });
  }

  // ---------- پرداخت ثابت ----------
  function openFixedForm(id) {
    const f = id ? S.fixed.find(x => x.id === id) : null;
    const cur = ym(today()), paid = f && f.paid && f.paid[cur];
    const html = `
      ${f ? `<div class="btnrow"><button class="btn ${paid ? 'ghost' : ''} wide" id="fpay">${paid ? 'برگرداندن پرداخت این ماه' : 'پرداخت این ماه ثبت شود'}</button></div>` : ''}
      <label class="lbl">عنوان</label><input id="fname" value="${esc(f ? f.name : '')}" placeholder="مثلاً اجاره یا شارژ ساختمان">
      <label class="lbl">مبلغ ماهانه</label>${amountInput('famount', f ? f.amount : 0)}
      <label class="lbl">روز سررسید در ماه</label><input id="fday" inputmode="numeric" value="${f ? faDigits(f.day) : ''}" placeholder="۱ تا ۳۱">
      <label class="lbl">از ماه</label>${ymField('fstart', f ? f.start : cur)}
      <label class="lbl">تا ماه</label>${ymField('fend', f ? f.end : null, true)}
      <p class="note">اگه پایان مشخصی نداره، «تا ماه» رو خالی بذار.</p>
      <div class="btnrow"><button class="btn wide" id="fsave">${f ? 'ذخیره‌ی تغییرات' : 'افزودن'}</button>${f ? `<button class="btn danger" id="fdel">حذف</button>` : ''}</div>`;
    openSheet(f ? f.name : 'پرداخت ثابت جدید', html, ov => {
      if (f) $('#fpay', ov).addEventListener('click', () => {
        if (paid) { unmarkPaid('fixed', f.id, cur); save(); closeSheet(ov); render(); toast('برگردانده شد.'); }
        else { closeSheet(ov); openPay('fixed', f.id, cur); }
      });
      $('#fsave', ov).addEventListener('click', () => {
        const name = $('#fname', ov).value.trim(), amount = readAmount(ov, 'famount');
        const day = Number(C.normDigits($('#fday', ov).value).replace(/\D/g, ''));
        if (!name || !amount || !(day >= 1 && day <= 31)) { toast('عنوان، مبلغ و روز سررسید (۱ تا ۳۱) لازمه.', 'bad'); return; }
        const rec = f || { id: uid(), paid: {} };
        Object.assign(rec, { name, amount, day, start: readYm(ov, 'fstart'), end: readYm(ov, 'fend') });
        if (!f) S.fixed.push(rec);
        save(); closeSheet(ov); obTab = 'fixed'; render(); toast(f ? 'ذخیره شد.' : 'اضافه شد.');
      });
      if (f) $('#fdel', ov).addEventListener('click', () => {
        if (!confirm(`«${f.name}» حذف بشه؟`)) return;
        S.tx.forEach(t => { if (t.link && t.link.id === f.id) delete t.link; });
        S.fixed = S.fixed.filter(x => x !== f); save(); closeSheet(ov); render(); toast('حذف شد.');
      });
    });
  }

  // ---------- بدهی و طلب: فرم‌ها ----------
  function openDebtForm(id, dir) {
    const d = id ? S.debts.find(x => x.id === id) : null;
    dir = d ? d.dir : dir || 'owe';
    const people = [...new Set(S.debts.map(x => x.person))];
    const html = `
      <div class="chips seg" id="ddir"><button type="button" class="chip ${dir === 'owe' ? 'on' : ''}" data-d="owe">بدهکارم به</button><button type="button" class="chip ${dir === 'owed' ? 'on' : ''}" data-d="owed">طلبکارم از</button></div>
      <label class="lbl">شخص</label><input id="dperson" list="dpeople" value="${esc(d ? d.person : '')}" placeholder="نام">
      <datalist id="dpeople">${people.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <label class="lbl">مبلغ</label>${amountInput('damount', d ? d.amount : 0)}
      <label class="lbl">تاریخ</label>${dateField('ddate', d ? d.date : today(), true)}
      <label class="check"><input type="checkbox" id="hasdue" ${d && d.due ? 'checked' : ''}> موعد تسویه داره</label>
      <div id="duewrap" ${d && d.due ? '' : 'hidden'}><label class="lbl">موعد تسویه</label>${dateField('ddue', d && d.due ? d.due : C.addMonths(today(), 1))}</div>
      <label class="lbl">توضیح</label><input id="dnote" value="${esc(d ? d.note : '')}" placeholder="مثلاً قرض برای تعمیر ماشین">
      <div class="btnrow"><button class="btn wide" id="dsave">${d ? 'ذخیره‌ی تغییرات' : 'ثبت'}</button>${d ? `<button class="btn danger" id="ddel">حذف</button>` : ''}</div>`;
    openSheet(d ? 'ویرایش' : 'بدهی یا طلب جدید', html, ov => {
      $('#ddir', ov).addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; dir = b.dataset.d; $$('#ddir .chip', ov).forEach(c => c.classList.toggle('on', c === b)); });
      $('#hasdue', ov).addEventListener('change', e => $('#duewrap', ov).hidden = !e.target.checked);
      if (!d) setTimeout(() => $('#dperson', ov).focus(), 250);
      $('#dsave', ov).addEventListener('click', () => {
        const person = $('#dperson', ov).value.trim(), amount = readAmount(ov, 'damount');
        if (!person || !amount) { toast('نام شخص و مبلغ لازمه.', 'bad'); return; }
        const rec = d || { id: uid(), settles: [] };
        Object.assign(rec, { dir, person, amount, date: readDate(ov, 'ddate'), due: $('#hasdue', ov).checked ? readDate(ov, 'ddue') : null, note: $('#dnote', ov).value.trim() });
        if (!d) S.debts.push(rec);
        save(); $$('.overlay').forEach(x => closeSheet(x)); obTab = 'debt'; render(); toast(d ? 'ذخیره شد.' : 'ثبت شد.');
      });
      if (d) $('#ddel', ov).addEventListener('click', () => {
        if (!confirm(`«${debtTitle(d)}» حذف بشه؟`)) return;
        S.debts = S.debts.filter(x => x !== d); save(); $$('.overlay').forEach(x => closeSheet(x)); render(); toast('حذف شد.');
      });
    });
  }
  function openDebtDetail(id) {
    const d = S.debts.find(x => x.id === id); if (!d) return;
    const left = debtLeft(d), verb = d.dir === 'owe' ? 'پرداخت' : 'دریافت';
    const hist = (d.settles || []).map((x, i) => `<li><span>${dateFull(x.date)}</span><b>${money(x.amount)}</b><button class="x" data-undo="${i}" aria-label="حذف این ${verb}">✕</button></li>`).join('');
    const html = `
      <div class="sums"><div><span>کل مبلغ</span><b>${money(d.amount)}</b></div><div><span>باقی‌مانده</span><b class="${left > 0 ? (d.dir === 'owe' ? 'neg' : 'pos') : ''}">${money(Math.max(left, 0))}</b></div></div>
      <p class="note">از ${dateFull(d.date)}${d.due ? ` · موعد ${dateFull(d.due)}` : ''}${d.note ? ` · ${esc(d.note)}` : ''}</p>
      ${left > 0 ? `
        <label class="lbl">مبلغ ${verb}</label>${amountInput('samount', left)}
        <p class="note">برای تسویه‌ی بخشی از مبلغ، عدد رو کمتر کن.</p>
        <label class="lbl">تاریخ</label>${dateField('sdate', today(), true)}
        <label class="lbl">${d.dir === 'owe' ? 'از حساب' : 'به حساب'}</label><select id="sacc"><option value="">بدون حساب</option>${S.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" id="stx" checked> در تراکنش‌ها هم ثبت بشه</label>
        <button class="btn wide" id="settle">ثبت ${verb}</button>` : ''}
      ${hist ? `<h3 class="subh">سابقه‌ی ${verb}‌ها</h3><ul class="settles">${hist}</ul>` : ''}
      <button class="btn wide ghost" id="dedit">ویرایش</button>`;
    openSheet(debtTitle(d), html, ov => {
      if (left > 0) $('#settle', ov).addEventListener('click', () => {
        const amount = Math.min(readAmount(ov, 'samount'), left); if (!amount) { toast('مبلغ رو وارد کن.', 'bad'); return; }
        const date = readDate(ov, 'sdate'), rec = { amount, date };
        if ($('#stx', ov).checked) {
          const t = { id: uid(), created: Date.now(), type: 'transfer', amount, date, time: '', cat: '', account: $('#sacc', ov).value,
            note: `${d.dir === 'owe' ? 'پرداخت بدهی به' : 'دریافت طلب از'} ${d.person}`, debt: d.id };
          S.tx.push(t); rec.txId = t.id;
        }
        d.settles = d.settles || []; d.settles.push(rec);
        if (debtLeft(d) <= 0) d.closed = date;
        save(); $$('.overlay').forEach(x => closeSheet(x)); render(); toast(debtLeft(d) <= 0 ? 'تسویه شد.' : `${verb} ثبت شد.`);
      });
      $$('[data-undo]', ov).forEach(b => b.addEventListener('click', () => {
        if (!confirm(`این ${verb} حذف بشه؟`)) return;
        const [x] = d.settles.splice(+b.dataset.undo, 1);
        if (x && x.txId) S.tx = S.tx.filter(t => t.id !== x.txId);
        delete d.closed; save(); closeSheet(ov); render(); openDebtDetail(d.id);
      }));
      $('#dedit', ov).addEventListener('click', () => openDebtForm(d.id));
    });
  }

  // ---------- خروجی‌ها ----------
  async function shareFile(blob, name, type) {
    const file = new File([blob], name, { type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
    } catch (e) { if (e.name === 'AbortError') return false; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return true;
  }
  const typeFa = { expense: 'خرج', income: 'درآمد', transfer: 'انتقال داخلی' };

  function exportExcel() {
    if (!window.XLSX) { toast('کتابخانه‌ی اکسل بارگذاری نشده. یک بار با اینترنت اپ رو باز کن.', 'bad'); return; }
    const root = $('#view'); let from = readYm(root, 'xfrom'), to = readYm(root, 'xto');
    if (from > to) [from, to] = [to, from];
    const months = []; for (let m = from; m <= to; m = C.addYm(m, 1)) months.push(m);
    const inRange = t => ym(t.date) >= from && ym(t.date) <= to;
    const txs = S.tx.filter(inRange).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const X = window.XLSX, wb = X.utils.book_new();
    const add = (rows, name, widths) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name); };
    add([['تاریخ', 'ساعت', 'نوع', 'دسته', 'مبلغ (ریال)', 'مبلغ (تومان)', 'حساب', 'توضیح', 'مربوط به']]
      .concat(txs.map(t => [t.date, t.time || '', typeFa[t.type], t.cat || '', t.amount, t.amount / 10, accName(t.account), t.note || '', t.link ? obLabel(t.link) : ''])),
      'تراکنش‌ها', [12, 7, 12, 16, 16, 14, 22, 32, 26]);
    add([['ماه', 'درآمد (ریال)', 'اقساط و تعهدات پرداخت‌شده', 'خرج روزمره', 'کل خرج', 'مانده']]
      .concat(months.map(m => { const s = C.monthStats(S, m); return [monthTitle(m), s.income, s.obPaid, s.variable, s.obPaid + s.variable, s.income - s.obPaid - s.variable]; })),
      'خلاصه ماهانه', [16, 16, 24, 16, 16, 16]);
    const cats = [...new Set(txs.filter(t => t.type === 'expense').map(t => t.link ? 'اقساط و تعهدات' : (t.cat || 'سایر')))];
    add([['دسته'].concat(months.map(monthTitle), ['جمع'])].concat(cats.map(c => {
      const vals = months.map(m => txs.filter(t => t.type === 'expense' && ym(t.date) === m && (t.link ? 'اقساط و تعهدات' : (t.cat || 'سایر')) === c).reduce((s, t) => s + t.amount, 0));
      return [c].concat(vals, [vals.reduce((a, b) => a + b, 0)]);
    })), 'خرج هر دسته', [18].concat(months.map(() => 14), [16]));
    add([['وام', 'وام‌دهنده', 'مبلغ قسط (ریال)', 'تعداد کل', 'پرداخت‌شده', 'باقی‌مانده', 'مانده‌ی بدهی (ریال)', 'اولین قسط', 'آخرین قسط', 'قسط بعدی']]
      .concat(S.loans.map(l => { const s = C.loanSummary(l); return [l.name, l.lender || '', l.amount, l.count, s.paidCount, s.remainingCount, s.remainingAmount, l.first, s.last, s.next ? s.next.due : 'تسویه']; })),
      'وام‌ها', [22, 16, 16, 9, 10, 10, 18, 12, 12, 12]);
    add([['عنوان', 'مبلغ ماهانه (ریال)', 'روز سررسید', 'از ماه', 'تا ماه']].concat(S.fixed.map(f => [f.name, f.amount, f.day, f.start || '', f.end || ''])),
      'پرداخت‌های ثابت', [22, 18, 11, 10, 10]);
    add([['نوع', 'شخص', 'مبلغ (ریال)', 'تسویه‌شده', 'باقی‌مانده', 'تاریخ', 'موعد', 'توضیح']]
      .concat(S.debts.map(d => [d.dir === 'owe' ? 'بدهکارم به' : 'طلبکارم از', d.person, d.amount, d.amount - Math.max(debtLeft(d), 0), Math.max(debtLeft(d), 0), d.date, d.due || '', d.note || ''])),
      'بدهی و طلب', [12, 18, 16, 16, 16, 12, 12, 30]);
    wb.Workbook = { Views: [{ RTL: true }] };
    const buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
    const name = `hesab-${from.replace('/', '-')}_${to.replace('/', '-')}.xlsx`;
    shareFile(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  function exportICS() {
    const t = today(), cur = ym(t); let obs = [];
    for (let i = 0; i <= 12; i++) obs = obs.concat(C.obligationsForMonth(S, C.addYm(cur, i)));
    obs = obs.filter(o => !o.paid && o.due >= t);
    openDebts().filter(d => d.due && d.due >= t).forEach(d => obs.push({ kind: 'debt', id: d.id, key: 'd', due: d.due,
      name: debtTitle(d), sub: d.dir === 'owe' ? 'موعد پرداخت بدهی' : 'موعد دریافت طلب', amount: debtLeft(d) }));
    if (!obs.length) { toast('سررسید یا موعد بازی در ۱۲ ماه آینده نیست.', 'bad'); return; }
    const fold = line => { const out = []; let s = line; while (s.length > 36) { out.push(s.slice(0, 36)); s = ' ' + s.slice(36); } out.push(s); return out.join('\r\n'); };
    const gd = js => { const g = C.toG(js); return `${g.gy}${C.pad(g.gm)}${C.pad(g.gd)}`; };
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hesab//fa', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:مالی'];
    obs.forEach(o => {
      const next = C.addDays(o.due, 1);
      lines.push('BEGIN:VEVENT', `UID:${o.kind}-${o.id}-${o.key.replace('/', '')}@hesab`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${gd(o.due)}`, `DTEND;VALUE=DATE:${gd(next)}`,
        fold(`SUMMARY:${o.kind === 'loan' ? 'قسط ' : ''}${o.name} - ${money(o.amount)}`),
        fold(`DESCRIPTION:${o.sub} - سررسید ${dateFull(o.due)}`),
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:سه روز دیگه: ${o.name}`), 'TRIGGER:-P2DT15H', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:امروز سررسید ${o.name}`), 'TRIGGER:PT9H', 'END:VALARM',
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    shareFile(new Blob([lines.join('\r\n')], { type: 'text/calendar' }), 'yadavar-aghsat.ics', 'text/calendar');
  }

  async function backup() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const ok = await shareFile(blob, `hesab-backup-${today().replace(/\//g, '-')}.json`, 'application/json');
    if (ok) { S.settings.lastBackup = Date.now(); save(); render(); toast('فایل بکاپ ساخته شد.'); }
  }
  function restore(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.tx) || !Array.isArray(d.loans)) throw 0;
        if (!confirm(`بکاپ شامل ${faDigits(d.tx.length)} تراکنش و ${faDigits(d.loans.length)} وامه. جایگزین داده‌های فعلی بشه؟`)) return;
        S = Object.assign(defaults(), d); save(); render(); toast('داده‌ها بازگردانی شد.');
      } catch (e) { toast('این فایل بکاپ معتبر نیست.', 'bad'); }
    };
    r.readAsText(file);
  }

  // ---------- رویدادها ----------
  document.addEventListener('click', e => {
    const tb = e.target.closest('.tabbar button'); if (tb) { tab = tb.dataset.tab; render(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    const acts = {
      add: () => openTxForm({ type: b.dataset.type }), paste: openPaste, duelist: openDueList,
      pay: () => openPay(b.dataset.k, b.dataset.id, b.dataset.key),
      edit: () => openTxForm({ id: b.dataset.id }),
      goset: () => { tab = 'set'; render(); }, goob: () => { tab = 'ob'; render(); },
      txm: () => { txMonth = C.addYm(txMonth, +b.dataset.d); render(); },
      repm: () => { repMonth = C.addYm(repMonth, +b.dataset.d); render(); },
      txf: () => { txFilter = b.dataset.f; render(); }, obt: () => { obTab = b.dataset.t; render(); },
      newloan: () => openLoanForm(), newfixed: () => openFixedForm(),
      newdebt: () => openDebtForm(null, b.dataset.dir), debt: () => openDebtDetail(b.dataset.id), debtd: () => openDebtDetail(b.dataset.id),
      godebt: () => { tab = 'ob'; obTab = 'debt'; render(); },
      loan: () => openLoanDetail(b.dataset.id), fixed: () => openFixedForm(b.dataset.id),
      excel: exportExcel, ics: exportICS, backup,
      unit: () => { S.settings.unit = b.dataset.u; save(); render(); },
      saveexp: () => { S.settings.expectedIncome = readAmount($('#view'), 'expected'); save(); toast('ذخیره شد.'); },
      addcat: () => { const inp = $('#newcat-' + b.dataset.type); const v = inp.value.trim(); if (!v) return;
        if (!S.categories[b.dataset.type].includes(v)) S.categories[b.dataset.type].push(v); save(); render(); },
      delcat: () => { S.categories[b.dataset.type].splice(+b.dataset.i, 1); save(); render(); },
      saveacc: () => { $$('[data-accname]').forEach(i => { const ac = S.accounts.find(x => x.id === i.dataset.accname); if (ac && i.value.trim()) ac.name = i.value.trim(); }); save(); toast('ذخیره شد.'); },
      delacc: () => { if (!confirm('این حساب حذف بشه؟ تراکنش‌هاش می‌مونن ولی بدون حساب.')) return;
        S.tx.forEach(t => { if (t.account === b.dataset.id) t.account = ''; }); S.accounts = S.accounts.filter(x => x.id !== b.dataset.id); save(); render(); },
      wipe: () => { if (prompt('برای پاک کردن همه‌چیز، کلمه‌ی «پاک» رو بنویس. این کار برگشت‌پذیر نیست.') !== 'پاک') return;
        S = defaults(); save(); render(); toast('همه‌ی داده‌ها پاک شد.'); }
    };
    if (acts[a]) acts[a]();
  });
  document.addEventListener('change', e => { if (e.target.id === 'restore' && e.target.files[0]) restore(e.target.files[0]); });

  // لینک‌های مستقیم برای ویجت Shortcuts
  function route() {
    const raw = location.hash.replace('#', '');
    if (!raw) return;
    const [h, qs] = raw.split('?');
    const q = new URLSearchParams(qs || '');
    const a = Number(C.normDigits(q.get('a') || '').replace(/\D/g, ''));
    const pre = a ? { amount: toRial(a), note: q.get('n') || '' } : { note: q.get('n') || '' };
    history.replaceState(null, '', location.pathname + location.search);
    $$('.overlay').forEach(x => x.remove());
    tab = 'home'; render();
    if (h === 'add' || h === 'out') openTxForm({ type: 'expense', prefill: pre });
    else if (h === 'income' || h === 'in') openTxForm({ type: 'income', prefill: pre });
    else if (h === 'new') openChooser();
    else if (h === 'paste') openPaste();
    else if (h === 'pay') openDueList();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('.overlay')) render(); });

  // ---------- شروع ----------
  load(); render(); route();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
