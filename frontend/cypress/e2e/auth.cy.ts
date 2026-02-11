describe('Giriş axını', () => {
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

    cy.intercept('GET', '**/api/products*', {
      statusCode: 200,
      body: [
        {
          id: 'prod-1',
          code: 'PRD001',
          name: 'Demo məhsul',
          description: 'Test məhsul',
          category: 'Elektronika',
          unit: 'əd',
          price: 12.5,
          inventory: {
            currentBranch: {
              branchId: 'branch-1',
              branchName: 'Bakı',
              availableQty: 5,
              inTransitQty: 3,
              reservedQty: 1,
            },
            byBranch: [],
          },
        },
      ],
    }).as('productsRequest');

    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: [
        {
          id: 'order-1',
          status: 'confirmed',
          total: 25,
          createdAt: new Date().toISOString(),
          branch: { id: 'branch-1', name: 'Bakı', code: 'BAKU' },
          items: [
            {
              id: 'item-1',
              product: { id: 'prod-1', code: 'PRD001', name: 'Demo məhsul' },
              quantity: 2,
              unitPrice: 12.5,
              lineTotal: 25,
            },
          ],
        },
      ],
    }).as('ordersRequest');
  });

  it('istifadəçinin uğurla daxil olmasına icazə verir', () => {
    cy.visit('/login');

    cy.contains('button', 'Admin Paneli').click();
    cy.findByLabelText(/E-mail/i).clear().type('admin@demo.az');
    cy.findByLabelText(/Şifrə/i).clear().type('Admin123!');
    cy.findByRole('button', { name: /Daxil ol/i }).click();

    cy.wait('@loginRequest');

    cy.url().should('match', /\/(dashboard|products)/);
    cy.findByText('Xoş gəldiniz').should('be.visible');
  });

  it('səhv şifrə zamanı xəta mesajı göstərir', () => {
    cy.intercept('POST', '**/api/login', {
      statusCode: 401,
      body: { message: 'Email və ya şifrə yanlışdır' },
    }).as('loginFail');

    cy.visit('/login');

    cy.contains('button', 'Admin Paneli').click();
    cy.findByLabelText(/E-mail/i).clear().type('wrong@example.com');
    cy.findByLabelText(/Şifrə/i).clear().type('wrongpass');
    cy.findByRole('button', { name: /Daxil ol/i }).click();

    cy.wait('@loginFail');
    cy.findAllByText('Email və ya şifrə yanlışdır')
      .first()
      .should('be.visible');
    cy.url().should('include', '/login');
  });
});
