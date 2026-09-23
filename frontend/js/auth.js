(function initAuthPage() {
  // If already logged in, skip straight to the dashboard.
  if (API.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const tabs = document.querySelectorAll('.auth-tab');
  const forms = {
    login: document.getElementById('login-form'),
    register: document.getElementById('register-form'),
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      Object.values(forms).forEach((f) => f.classList.remove('active'));
      forms[tab.dataset.tab].classList.add('active');
    });
  });

  function showError(bannerId, message) {
    const banner = document.getElementById(bannerId);
    banner.textContent = message;
    banner.classList.add('visible');
  }

  function hideError(bannerId) {
    document.getElementById(bannerId).classList.remove('visible');
  }

  function setLoading(button, loading, label) {
    button.disabled = loading;
    button.textContent = loading ? 'Please wait…' : label;
  }

  forms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('login-error');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const button = document.getElementById('login-submit');

    setLoading(button, true, 'Log in');
    try {
      const res = await API.post('/auth/login', { email, password });
      API.setSession(res.data.token, res.data.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError('login-error', err.message || 'Could not log in');
    } finally {
      setLoading(button, false, 'Log in');
    }
  });

  forms.register.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('register-error');

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const button = document.getElementById('register-submit');

    if (password.length < 6) {
      showError('register-error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(button, true, 'Create account');
    try {
      const res = await API.post('/auth/register', { name, email, password });
      API.setSession(res.data.token, res.data.user);
      UI.toast('Account created — welcome to HabitSync!');
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError('register-error', err.message || 'Could not create account');
    } finally {
      setLoading(button, false, 'Create account');
    }
  });
})();
