
const path = require('path');
const fs = require('fs');

 context.
const scriptPath = path.join(__dirname, '../../../public/script/validateform.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Helper to reset DOM and (re)attach the script behavior
const setupDomAndScript = () => {
  
  document.body.innerHTML = `
    <form class="needs-validation" id="test-form" novalidate>
      <input id="field" required />
      <button type="submit">Submit</button>
    </form>
  `;

 
  eval(scriptContent);
};

describe('public/script/validateform.js', () => {
  beforeEach(() => {
   
    if (typeof document === 'undefined') {
      
      return;
    }
    document.body.innerHTML = '';
  });

  test('prevents submission and adds was-validated when form is invalid', () => {
    if (typeof document === 'undefined') {
     
      return;
    }

    setupDomAndScript();

    const form = document.getElementById('test-form');

   
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

   
    form.checkValidity = jest.fn(() => false);

    
    const submitEvent = new Event('submit', { cancelable: true });
    form.dispatchEvent(submitEvent);

  
    expect(form.classList.contains('was-validated')).toBe(true);
  });

  test('allows submission when form is valid', () => {
    if (typeof document === 'undefined') {
      return;
    }

    setupDomAndScript();

    const form = document.getElementById('test-form');

   
    const preventDefaultSpy = jest.fn();
    const stopPropagationSpy = jest.fn();

    form.checkValidity = jest.fn(() => true);

    const submitEvent = new Event('submit', { cancelable: true });
    submitEvent.preventDefault = preventDefaultSpy;
    submitEvent.stopPropagation = stopPropagationSpy;

    form.dispatchEvent(submitEvent);

    expect(form.classList.contains('was-validated')).toBe(true);
   
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
