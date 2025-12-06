const path = require('path');
const fs = require('fs');

// Load the actual frontend script
const scriptPath = path.join(
  __dirname,
  '../../../public/script/validateform.js'
);
const scriptContent = fs.readFileSync(scriptPath, 'utf8');


const setupDomAndScript = () => {
  document.body.innerHTML = `
    <form class="needs-validation" id="test-form" novalidate>
      <input id="field" required />
      <button type="submit">Submit</button>
    </form>
  `;


  eval(scriptContent);

  window.dispatchEvent(new Event('load'));
};

describe('public/script/validateform.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('prevents submission and adds was-validated when form is invalid', () => {
    setupDomAndScript();

    const form = document.getElementById('test-form');

    // Force invalid form
    form.checkValidity = jest.fn(() => false);

    const submitEvent = new Event('submit', { cancelable: true });
    form.dispatchEvent(submitEvent);

    expect(form.classList.contains('was-validated')).toBe(true);
  });

  test('allows submission when form is valid', () => {
    setupDomAndScript();

    const form = document.getElementById('test-form');

    // Force valid form
    form.checkValidity = jest.fn(() => true);

    const preventDefaultSpy = jest.fn();
    const submitEvent = new Event('submit', { cancelable: true });
    submitEvent.preventDefault = preventDefaultSpy;

    form.dispatchEvent(submitEvent);

    expect(form.classList.contains('was-validated')).toBe(true);
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
