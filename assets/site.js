/* 율이공방 — 공통 스크립트
   1) 모바일 메뉴  2) 대상별 탭  3) 관리자 수정 내용 불러오기/편집 */
(function () {
  'use strict';

  /* ── 모바일 메뉴 ─────────────────────────────────── */
  var burger = document.querySelector('.burger');
  var nav = document.querySelector('.nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && window.innerWidth <= 1000) {
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── 세부 페이지의 [← 뒤로] 단추 ─────────────────
     위치 표시(홈 › …) 앞에 뒤로가기 단추를 붙인다.
     홈과는 역할이 다르다 — 바로 앞 화면으로 돌아간다.
     처음부터 이 페이지로 들어와 돌아갈 곳이 없으면 홈으로 보낸다. */
  var crumb = document.querySelector('.crumb');
  if (crumb) {
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'back';
    back.textContent = '뒤로';
    back.addEventListener('click', function () {
      if (history.length > 1 && document.referrer.indexOf(location.host) !== -1) history.back();
      else location.href = 'index.html';
    });
    crumb.insertBefore(back, crumb.firstChild);
  }

  /* ── 주소 뒤 #표시가 가리키는 자리로 내려주기 ─────
     예) why.html#promises 로 들어오면 「네 가지 약속」이 바로 보이게.
     브라우저가 이 이동을 건너뛰는 경우가 있고, 사진이 늦게 붙으면서
     위치가 밀리기도 해서 직접 잡아 준다. */
  /* 목표가 접이식 상자(details)면 펼쳐 준다.
     메뉴의 「진행 구성」·「정기 과정」·「자격」이 접힌 상자라서,
     눌러서 이동해도 닫힌 채로 도착해 "안 열린다"는 말을 들었다.
     상자 안의 상자까지 거슬러 올라가며 전부 펼친다. */
  function openIfCollapsed(t) {
    var d = (t.tagName === 'DETAILS') ? t : (t.closest ? t.closest('details') : null);
    while (d) {
      d.open = true;
      d = d.parentElement && d.parentElement.closest ? d.parentElement.closest('details') : null;
    }
  }

  function jumpToHash() {
    if (!location.hash || location.hash.length < 2) return;
    var t;
    try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch (e) { return; }
    if (!t) return;
    openIfCollapsed(t);          // 먼저 펼치고 나서 위치를 재야 정확하다
    var head = document.querySelector('.hd');
    var pad = (head ? head.getBoundingClientRect().height : 0) + 16;
    var y = t.getBoundingClientRect().top + window.pageYOffset - pad;
    window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
  }
  if (location.hash) {
    jumpToHash();
    // 사진이 다 붙은 뒤 한 번 더 — 그 사이 높이가 달라졌을 수 있다
    window.addEventListener('load', function () { setTimeout(jumpToHash, 60); });
  }
  // 한 페이지 안에서 #자리로 이동할 때도 같은 처리를 한다.
  // (페이지가 새로 열리지 않으므로 위의 코드만으로는 안 걸린다)
  window.addEventListener('hashchange', function () { jumpToHash(); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var t = document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    openIfCollapsed(t);
    var head = document.querySelector('.hd');
    var pad = (head ? head.getBoundingClientRect().height : 0) + 16;
    window.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + window.pageYOffset - pad),
                      behavior: 'smooth' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ── 첫 화면 사진 순환 ───────────────────────────── */
  var slides = document.querySelectorAll('.hero .slide');
  var dots = document.querySelectorAll('.hero-dots button');

  // 2~4번 사진은 첫 화면이 다 그려진 뒤에 받아온다.
  // 처음부터 4장을 같이 받으면 첫 화면이 뜨는 게 그만큼 늦어진다.
  function loadRest() {
    document.querySelectorAll('.hero picture[data-lazy]').forEach(function (pic) {
      pic.querySelectorAll('source[data-srcset]').forEach(function (s) {
        s.srcset = s.dataset.srcset; s.removeAttribute('data-srcset');
      });
      var img = pic.querySelector('img[data-src]');
      if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
      pic.removeAttribute('data-lazy');
    });
    // 관리자에서 바꾼 사진이 있으면 다시 덮어쓴다
    if (window.cmsApplyImages) window.cmsApplyImages();
  }
  if (slides.length > 1) {
    var at = 0, timer = null;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 사진이 넘어갈 때 어두워지지 않게 하는 방법
       ────────────────────────────────────────────────
       둘을 동시에 흐리게/진하게 하면, 중간에 둘 다 반투명이 되어
       뒤에 있는 짙은 바탕(#1B241B)이 비쳐 화면이 확 어두워진다.
       그래서 「지나간 사진은 그대로 진하게 깔아 두고, 새 사진만 그 위로
       서서히 덮는다」. 덮는 내내 바탕이 한 번도 드러나지 않는다.
       다 덮은 뒤에 아래 사진을 끄는데, 이미 가려져 있어 보이지 않는다. */
    var fade = null;
    slides[0].style.zIndex = 2;
    function show(i) {
      var prev = at;
      at = (i + slides.length) % slides.length;
      if (at === prev) return;
      slides.forEach(function (s, n) {
        if (n !== at && n !== prev) { s.classList.remove('is-on'); s.style.zIndex = 0; }
      });
      slides[prev].style.zIndex = 1;   // 아래에서 진하게 버틴다
      slides[at].style.zIndex = 2;     // 위에서 서서히 나타난다
      slides[at].classList.add('is-on');

      // 다 덮은 뒤에 아래 사진을 끈다. 시간(0.8초)을 어림잡지 않고
      // 「덮기가 끝났다」는 신호를 직접 받는다. 신호가 없는 경우
      // (움직임 줄이기 설정 등)를 대비해 시간제한도 함께 둔다.
      clearTimeout(fade);
      var off = function () {
        clearTimeout(fade);
        slides[at].removeEventListener('transitionend', off);
        slides[prev].classList.remove('is-on');
        slides[prev].style.zIndex = 0;
      };
      slides[at].addEventListener('transitionend', off);
      fade = setTimeout(off, 2400);   // 겹침(1.4초)보다 넉넉하게
      dots.forEach(function (d, n) { d.setAttribute('aria-selected', n === at ? 'true' : 'false'); });
    }
    // 3.4초마다 다음 사진으로.
    // 겹침이 1.4초이므로, 한 장이 또렷하게 머무는 시간은 딱 2초다.
    // (폰에서는 기다리지 않고 바로 내려 보므로, 첫 장만 보고 지나가지 않게 줄였다)
    function play() { if (!still) { stop(); timer = setInterval(function () { show(at + 1); }, 3400); } }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d, n) {
      d.addEventListener('click', function () { show(n); play(); });
    });
    // 마우스를 올리면 멈추게 했더니, 첫 화면이 화면 전체를 덮어서
    // 마우스가 거의 항상 그 위에 있어 계속 멈춰 있었다. 그래서 뺐다.

    // 다른 탭을 보고 있을 때는 굳이 돌리지 않는다
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else play();
    });

    // 2~4번 사진을 받아온 뒤에 돌리기 시작한다.
    // 먼저 돌리면 아직 안 받아온 사진 차례에 빈 화면이 스친다.
    function begin() { loadRest(); play(); }
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin);
  }

  /* ── 대상별 탭 ───────────────────────────────────── */
  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var btns = group.querySelectorAll('.tabs button');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
        b.setAttribute('aria-selected', 'true');
        group.querySelectorAll('.tab-panel').forEach(function (p) {
          p.hidden = (p.id !== b.getAttribute('aria-controls'));
        });
      });
    });
  });

  /* ── 수업 후기 보여주기 ──────────────────────────
     관리자 페이지에서 등록한 후기를 현장 기록 페이지에 뿌린다. */
  var reviewBox = document.getElementById('reviewList');
  if (reviewBox) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('cms_reviews') || '[]'); } catch (e) {}
    // 관리자 페이지에서 「보이기」로 둔 후기만 내보낸다
    list = list.filter(function (r) { return r && r.on !== false; });
    var empty = document.getElementById('reviewEmpty');
    if (list.length) {
      reviewBox.innerHTML = list.map(function (r) {
        var esc = function (s) {
          return String(s || '').replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
          });
        };
        return '<div class="review"><p>“' + esc(r.text) + '”</p>' +
               (r.who ? '<p class="who">' + esc(r.who) + '</p>' : '') + '</div>';
      }).join('');
      reviewBox.hidden = false;
      // 후기가 3개 미만이면 빈약해 보이므로 안내문을 함께 남겨 둔다
      if (empty && list.length >= 3) empty.hidden = true;
    }
  }

  /* ── 후기 남기기 ─────────────────────────────────
     서버가 없어서 글이 바로 올라가지는 않는다.
     적으신 내용을 메일·문자로 대표님께 보내면, 관리자 페이지에서 올린다. */
  var rvOpen = document.getElementById('rvOpen');
  if (rvOpen) {
    var rvForm = document.getElementById('rvForm');
    rvOpen.addEventListener('click', function () {
      rvForm.hidden = !rvForm.hidden;
      if (!rvForm.hidden) {
        document.getElementById('rvMsg').focus();
        rvForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    document.getElementById('rvClose').addEventListener('click', function () {
      rvForm.hidden = true;
      rvOpen.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.getElementById('rvSend').addEventListener('click', function () {
      var msg = document.getElementById('rvMsg').value.trim();
      if (!msg) { alert('후기를 적어주세요.'); document.getElementById('rvMsg').focus(); return; }
      var name = document.getElementById('rvName').value.trim();
      var when = document.getElementById('rvWhen').value.trim();
      var text = ['[율이공방 수업 후기]', '', msg, ''].concat(
        name ? ['· 성함/기관 : ' + name] : [],
        when ? ['· 참여 시기 : ' + when] : []).join('\n');
      document.getElementById('rvText2').textContent = text;
      document.getElementById('rvOut').hidden = false;
      document.getElementById('rvMail').href =
        'mailto:bluelove1214@naver.com?subject=' + encodeURIComponent('[수업 후기] ' + (name || '')) +
        '&body=' + encodeURIComponent(text);
      document.getElementById('rvSms').href = 'sms:01065550497?body=' + encodeURIComponent(text);
      document.getElementById('rvCopy').onclick = function () {
        navigator.clipboard.writeText(text).then(
          function () { alert('복사했습니다. 원하시는 곳에 붙여넣어 보내주세요.'); },
          function () { alert('복사가 안 되면 위 내용을 직접 선택해 복사해 주세요.'); });
      };
      document.getElementById('rvOut').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }


  /* ── 이벤트 배너 ─────────────────────────────────
     관리자 페이지에서 켜 두면 모든 페이지 맨 위에 한 줄로 떠오릅니다.
     방문자가 닫으면 그 브라우저 창에서는 다시 뜨지 않습니다. */
  (function eventBar(){
    var on = localStorage.getItem('cms_event_on') === '1';
    var text = localStorage.getItem('cms_event_text') || '';
    if (!on || !text.trim()) return;
    var stamp = localStorage.getItem('cms_event_stamp') || '0';
    try { if (sessionStorage.getItem('evt_closed') === stamp) return; } catch (e) {}
    var link = (localStorage.getItem('cms_event_link') || '').trim();
    var bar = document.createElement('div');
    bar.className = 'evt-bar';
    var inner = document.createElement('span');
    inner.innerHTML = text;
    if (link) {
      var a = document.createElement('a');
      a.href = link; a.textContent = ' 자세히 보기 →';
      inner.appendChild(a);
    }
    bar.appendChild(inner);
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'evt-x'; x.setAttribute('aria-label', '이벤트 안내 닫기');
    x.innerHTML = '&times;';
    x.addEventListener('click', function(){
      try { sessionStorage.setItem('evt_closed', stamp); } catch (e) {}
      document.documentElement.style.setProperty('--evt-h', '0px');
      document.body.classList.remove('has-evt');
      bar.remove();
    });
    bar.appendChild(x);
    document.body.insertBefore(bar, document.body.firstChild);
    function fit(){
      document.documentElement.style.setProperty('--evt-h', bar.offsetHeight + 'px');
    }
    document.body.classList.add('has-evt');
    fit();
    window.addEventListener('resize', fit);
  })();

  /* ── 관리자 수정 내용 ────────────────────────────── */
  var K = 'cms_';
  document.querySelectorAll('[data-cms]').forEach(function (el) {
    var v = localStorage.getItem(K + el.dataset.cms);
    if (v !== null) el.innerHTML = v;
  });

  // 사진은 파일 이름을 열쇠로 쓴다. 그래야 페이지마다 표시를 달지 않아도
  // 사이트의 모든 사진을 관리자 페이지에서 바꿀 수 있다.
  window.cmsImgKey = function (src) {
    return String(src || '').split('?')[0].split('/').pop()
      .replace(/\.(jpe?g|png|webp|gif|svg)$/i, '');
  };
  function applyImages() {
    document.querySelectorAll('img').forEach(function (el) {
      var key = el.dataset.cmsImg ||
        window.cmsImgKey(el.getAttribute('src') || el.getAttribute('data-src'));
      if (!key) return;
      var v = localStorage.getItem(K + 'img_' + key);
      if (!v) return;
      // <picture> 안에서는 <source> 가 우선하므로 걷어내야 바뀐 사진이 보인다
      var pic = el.closest && el.closest('picture');
      if (pic) pic.querySelectorAll('source').forEach(function (s) { s.remove(); });
      el.removeAttribute('srcset');
      el.removeAttribute('data-src');
      el.src = v;
    });
    document.querySelectorAll('[data-cms-img]').forEach(function (el) {
      if (el.tagName === 'IMG') return;
      var v = localStorage.getItem(K + 'img_' + el.dataset.cmsImg);
      if (v) el.style.backgroundImage = "url('" + v + "')";
    });
  }
  window.cmsApplyImages = applyImages;
  applyImages();

  // 편집 모드가 아니면 여기서 끝. 편집 권한도 지운다.
  if (!/[?&]edit=1/.test(location.search)) {
    try { sessionStorage.removeItem('cms_session'); } catch (e) {}
    return;
  }
  var until = parseInt(localStorage.getItem('cms_until') || '0', 10);
  if (Date.now() > until) {
    alert('편집 권한이 없습니다. 관리자 페이지에서 들어와 주세요.');
    return;
  }
  /* 고칠 수 있는 곳이 700곳 가까이 되므로 전부 점선을 두르면 화면이 어지럽다.
     평소에는 옅게만 표시하고, 마우스를 올리거나 누른 곳만 뚜렷하게 보여 준다. */
  document.body.classList.add('cms-on');
  // 접혀 있는 질문은 전부 펴 둔다. 접힌 채로는 답을 고칠 수가 없고,
  // 글자를 고치는 상태에서는 제목을 눌러도 잘 펴지지 않는다.
  document.querySelectorAll('details').forEach(function (d) { d.open = true; });
  document.querySelectorAll('[data-cms]').forEach(function (el) {
    el.contentEditable = true;
    el.spellcheck = false;
    if (localStorage.getItem(K + el.dataset.cms) !== null) el.classList.add('cms-hit');
    /* 저장은 「바깥을 클릭할 때」만이 아니라 「고치는 중에도」 한다.
       바깥을 누르지 않은 채 다른 페이지로 넘어가면 고친 게 날아가기 때문이다. */
    var was = el.innerHTML, hold = null;
    function save() {
      if (el.innerHTML === was) return;
      was = el.innerHTML;
      localStorage.setItem(K + el.dataset.cms, was);
      el.classList.add('cms-hit', 'cms-just');
      setTimeout(function () { el.classList.remove('cms-just'); }, 1400);
      countHits();
    }
    el.addEventListener('input', function () {
      clearTimeout(hold);
      hold = setTimeout(save, 400);   // 타자를 잠깐 멈추면 저장
    });
    el.addEventListener('blur', function () { clearTimeout(hold); save(); });
    el.addEventListener('keydown', function (e) {
      // 문단 안에서 엔터를 치면 이상한 상자가 생기므로 줄바꿈으로 바꿔 준다
      if (e.key === 'Enter' && !e.shiftKey && el.tagName !== 'DIV') {
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
      if (e.key === 'Escape') el.blur();
    });
  });

  /* 아래 띠 — 몇 곳을 고쳤는지, 되돌리기, 관리자로 돌아가기 */
  function countHits() {
    var n = document.querySelectorAll('.cms-hit').length;
    var s = document.getElementById('cmsCount');
    if (s) s.textContent = n ? '이 페이지에서 ' + n + '곳 고쳤습니다' : '아직 고친 곳이 없습니다';
  }
  var bar = document.createElement('div');
  bar.className = 'cms-bar';
  bar.innerHTML =
    '<span><b>편집 중</b> — 글을 눌러 고치면 <b>저절로 저장</b>됩니다. 노란 테두리가 고친 자리입니다.</span>' +
    '<span id="cmsCount" class="cms-n"></span>' +
    '<button type="button" id="cmsUndo">이 페이지만 되돌리기</button>' +
    '<button type="button" id="cmsDone" class="on">편집 끝내기</button>';
  document.body.appendChild(bar);
  countHits();
  document.getElementById('cmsDone').addEventListener('click', function () {
    location.href = 'admin.html';
  });
  document.getElementById('cmsUndo').addEventListener('click', function () {
    if (!confirm('이 페이지에서 고친 글을 모두 처음 상태로 되돌립니다. 계속할까요?')) return;
    document.querySelectorAll('[data-cms]').forEach(function (el) {
      localStorage.removeItem(K + el.dataset.cms);
    });
    location.reload();
  });

})();
