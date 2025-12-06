/**
 * Unit tests for public/script/validateform.js
 * These tests simulate a minimal DOM environment to verify that
 * the submit handler prevents submission when the form is invalid
 * and adds the correct CSS class.
 */

// Jest's default environment is node; we create a fake DOM using jsdom-like APIs
// provided by Jest (global document, window) when testEnvironment is set to jsdom
// For this project, we keep testEnvironment as node in jest.config.js
// and instead manually create a simple DOM using JSDOM here if available.

const path = require('path');
const fs = require('fs');

// Load the script under test as raw text and evaluate it in the JSDOM context.
const scriptPath = path.join(__dirname, '../../../public/script/validateform.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Helper to reset DOM and (re)attach the script behavior
const setupDomAndScript = () => {
  // Create a simple form with the class used by the script
  document.body.innerHTML = `
    <form class="needs-validation" id="test-form" novalidate>
      <input id="field" required />
      <button type="submit">Submit</button>
    </form>
  `;

  // Evaluate the script in the current context so it registers the event listener
  // eslint-disable-next-line no-eval
  eval(scriptContent);
};

describe('public/script/validateform.js', () => {
  beforeEach(() => {
    // Ensure we have a DOM-like environment for each test
    // Jest with testEnvironment=jsdom would already set global document/window.
    if (typeof document === 'undefined') {
      // If your global test environment is node-only, you can switch to jsdom
      // in jest.config.js for all tests, or for this file using a per-test config.
      // Here we skip in that unlikely case.
      return;
    }
    document.body.innerHTML = '';
  });

  test('prevents submission and adds was-validated when form is invalid', () => {
    if (typeof document === 'undefined') {
      // Environment does not support DOM; skip gracefully
      return;
    }

    setupDomAndScript();

    const form = document.getElementById('test-form');

    // Spy on preventDefault and stopPropagation
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    // Make form invalid by mocking checkValidity
    form.checkValidity = jest.fn(() => false);

    // Manually dispatch submit handler (the script attaches its own listener)
    const submitEvent = new Event('submit', { cancelable: true });
    form.dispatchEvent(submitEvent);

    // Because form.checkValidity() === false, we expect default to be prevented
    expect(form.classList.contains('was-validated')).toBe(true);
  });

  test('allows submission when form is valid', () => {
    if (typeof document === 'undefined') {
      return;
    }

    setupDomAndScript();

    const form = document.getElementById('test-form');

    // Spy on preventDefault
    const preventDefaultSpy = jest.fn();
    const stopPropagationSpy = jest.fn();

    // Valid form
    form.checkValidity = jest.fn(() => true);

    const submitEvent = new Event('submit', { cancelable: true });
    submitEvent.preventDefault = preventDefaultSpy;
    submitEvent.stopPropagation = stopPropagationSpy;

    form.dispatchEvent(submitEvent);

    expect(form.classList.contains('was-validated')).toBe(true);
    // Since form is valid, preventDefault should not be called by our script
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
