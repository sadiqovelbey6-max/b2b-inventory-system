import '@testing-library/cypress/add-commands';

beforeEach(() => {
  cy.clearLocalStorage();
  cy.clearCookies();
});

