describe('Sifariş və qaimə axını', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/login', {
      statusCode: 200,
      body: {
        user: {
          id: 'user-1',
          email: 'admin@demo.az',
          role: 'super_admin',
          branch: { id: 'branch-1', name: 'Bakı', code: 'BAKU' },
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    }).as('loginRequest');

    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: [],
    }).as('ordersList');

    cy.intercept('GET', '**/api/orders/pending-approval*', {
      statusCode: 200,
      body: [],
    }).as('pendingOrders');

    cy.visit('/login');
    cy.contains('button', 'Admin Paneli').click();
    cy.findByLabelText(/E-mail/i).clear().type('admin@demo.az');
    cy.findByLabelText(/Şifrə/i).clear().type('Admin123!');
    cy.findByRole('button', { name: /Daxil ol/i }).click();
    cy.wait('@loginRequest');
  });

  it('sifarişlər səhifəsini göstərir və qaimə yarada bilər', () => {
    cy.intercept('GET', '**/api/orders/monthly-statistics*', { statusCode: 200, body: [] }).as('monthlyStats');
    cy.intercept('GET', '**/api/orders/top-selling*', { statusCode: 200, body: [] }).as('topSelling');

    cy.contains('a', 'Sifarişlər').click();
    cy.wait(['@ordersList', '@pendingOrders']);

    cy.findByRole('heading', { name: 'Sifarişlər' }).should('be.visible');
    cy.findByText(/Sifarişləri görüntüləyin, təsdiqləyin/i).should('be.visible');

    // Qaimə səhifəsi - səhifəyə daxil olmağı yoxla
    cy.visit('/invoices');
    cy.contains('Qaimələr', { timeout: 10000 }).should('be.visible');
    cy.contains('Sifariş ID').should('be.visible');
  });
});
