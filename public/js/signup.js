(function () {
  var form = document.getElementById('apply');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var go = $('go'), msg = $('formmsg');
  var slugTouched = false;

  function suggest(name) {
    return String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  }
  $('business_name').addEventListener('input', function () { if (!slugTouched) $('slug').value = suggest(this.value); });
  $('slug').addEventListener('input', function () { slugTouched = true; this.value = this.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); });

  function clearErrors() {
    msg.hidden = true; msg.textContent = '';
    Array.prototype.forEach.call(form.querySelectorAll('.field'), function (f) {
      f.classList.remove('bad');
      var e = f.querySelector('.err'); if (e) e.remove();
    });
  }
  function showErrors(fields) {
    var first = null;
    Object.keys(fields || {}).forEach(function (k) {
      var f = form.querySelector('[data-f="' + k + '"]'); if (!f) return;
      f.classList.add('bad');
      var p = document.createElement('p'); p.className = 'err'; p.textContent = fields[k]; f.appendChild(p);
      if (!first) first = f.querySelector('input,textarea');
    });
    if (first) first.focus();
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearErrors();
    var body = {
      business_name: $('business_name').value, slug: $('slug').value, contact_name: $('contact_name').value,
      contact_email: $('contact_email').value, contact_phone: $('contact_phone').value, message: $('message').value,
      company_website: $('company_website').value,
      accept_contract: $('accept_contract').checked, accept_responsibilities: $('accept_responsibilities').checked
    };
    go.disabled = true; go.textContent = 'Sending...';
    fetch('/api/signup/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (x) {
        if (x.ok) {
          $('ref').textContent = x.d.reference || '';
          $('doneemail').textContent = body.contact_email;
          $('formwrap').hidden = true; var done = $('done'); done.hidden = false; done.focus();
          return;
        }
        if (x.d && x.d.fields) showErrors(x.d.fields);
        msg.textContent = x.status === 429 ? 'You have sent several applications. Please wait a while and try again.' : ((x.d && x.d.error) || 'We could not send your application. Please try again.');
        msg.hidden = false;
      })
      .catch(function () { msg.textContent = 'We could not reach the server. Check your connection and try again.'; msg.hidden = false; })
      .then(function () { go.disabled = false; go.textContent = 'Send application'; });
  });
})();
